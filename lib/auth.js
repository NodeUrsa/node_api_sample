// # Auth2

import { Factory } from 'administer';
import _ from 'highland';
import util from './utilities';
import Database from './database';
import Email from './email';
import { BadImplementation } from '../server/ext/errors';

// The `Auth2` (Auth Squared) class handles all authentication and authorization for the system.
const Auth2 = Factory( 'Auth2', { _db: Database, _email: Email } )
.props({
  _entities: {},
})
.methods({
  // ## getOrCreateAccount
  //
  // Given a particular profile (e.g. from OpenID/OAuth), this method either creates the user or
  // retrieves the user from the system.
  getOrCreateAccount( id, details ) {
    // There are only a few properties from the OAuth profile that we want to store in the database.
    const profile = {
      email: details.emails[0].value,
      fname: details.name.givenName,
      lname: details.name.familyName
    };

    // This is a convenience object to keep the later query call succinct.
    const oauth = { id };

    // We store this so we can check if an account is new later on.
    let accountIsNew = false;
    let account;

    // As there are multiple queries here, we create a pipeline to which we can pipe the profile.
    // This ensures all errors are propagated to the stream that `getOrCreateAccount` returns.
    // FIXME(jdm): This process should be optimized in some way as it runs a little slow.
    var pipeline = _.pipeline(
      // First, we find or create the account record in the database.
      _.flatMap( ( profile ) => {
        return this._db.queryOne([
          'MERGE (acct:Person {email:{ email }})',
          'ON CREATE SET acct.fname = { fname }, acct.lname = { lname }, acct.new = 1, acct.c_at = timestamp(), acct.id = {id}',
          'SET acct :Account',
          'RETURN acct as node'
        ], { email: profile.email, fname: profile.fname, lname: profile.lname, id: util.helper.generateId() } );
      }),

      // Next, we store the OAuth information that was used to log in, if we need to.
      _.flatMap( account => {
        accountIsNew = account.new === 1;

        const hasFname = ( ! account.fname || account.fname === '' ) && ( profile.fname && profile.fname !== '' );
        const hasLname = ( ! account.lname || account.lname === '' ) && ( profile.lname && profile.lname !== '' );

        return this._db.queryOne([
          'MATCH (acct:Account {id:{aid}})',
          'CREATE UNIQUE acct<-[:FOR]-(oauth:OAuthIdentifier {oauth})',

          // Revert the new account flag that may have been set on the previous query
          'SET acct.new = 0',

          // Set the name if it was missing
          hasFname ? ', acct.fname = {fname}' : '',
          hasLname ? ', acct.lname = {lname}' : '',

          'RETURN acct as node'
        ], { oauth, fname: profile.fname, lname: profile.lname, aid: account.id } );
      }),

      // If we need to, let's send a welcome email.
      _.flatMap( acct => {
        account = acct;

        if ( accountIsNew ) {
          return this._email.send( 'welcome', 'Welcome to ifeis!', account ).to( account.email );
        } else {
          return _([ account ]);
        }
      }),

      // Ensure we return the account
      _.map( () => account )
    );

    // We create a stream from the profile and pipe it to our pipeline, returning the
    // pipeline-created stream.
    return _([ profile ]).pipe( pipeline );
  },

  // ## entity
  //
  // Security checks defined on routes are made through "entity" descriptions. An entity takes a
  // name (e.g. "account") and a configuration object that contains the available checks. E.g.:
  //
  //   auth2.entity( 'account', {
  //     read: methodToCheckForPermissions,
  //     write: methodToCheckForWritePermissions
  //   });
  //
  // The methods in the config object will receive an object filled with the properties that it can
  // be used to check; no properties are guaranteed and no defaults are provided. The methods then
  // must return a stream.
  entity( name, config ) {
    // Of course, the name and configuration object must be valid.
    if ( ! util.types.isString( name ) || ! util.types.isObject( config ) ) {
      throw new Error( 'Invalid Auth2 entity configuration.' );
    }

    this._entities[ name ] = config;
  },

  // ## check
  //
  // The entities defined through `Auth2::entity` can be checked through this method, which takes
  // the name of the entity, the name of the defined method (e.g. `read`), and the set of properties
  // to pass to the method. It should return a stream with a single `true` or `false` item that
  // indicates the success. E.g.:
  //
  //   check( 'account', 'read', props )
  //   .apply( function ( itWasSuccessful ) {
  //     if ( itWasSuccessful ) { // ...
  //     } else { // ...
  //     }
  //   })
  //
  // This method is used by the `CheckAuth` server extension and should not need to be called
  // directly.
  check( name, check, props ) {
    var stream;

    // If the entity doesn't exist, automatically reject, but with a 500 because this was probably
    // not defined at runtime.
    if ( ! this._entities[ name ] ) {
      return BadImplementation( `Auth2 check entity "${name}" not found.` );
    }

    // Next ensure that the check exists and that it is a valid function.
    var fn = this._entities[ name ][ check ];
    if ( ! fn || ! util.types.isFunction( fn ) ) {
      return BadImplementation( `Auth2 check ${name}::${check} not found.` );
    }

    // And then run the check and get the stream. But if it's not a stream, scream like crazy and
    // get the heck out - again, giving 500 because some developer royally screwed up.
    stream = this._entities[ name ][ check ]( props );
    if ( ! util.types.isStream( stream ) ) {
      return BadImplementation( `Auth2 check ${name}::${check} did not return a stream.` );
    }

    // Return the stream for the 
    return stream;
  },

  // ## createGrantOn
  //
  // Permissions are generally managed through "grants". An account is "granted" a role on some node
  // in the database. This method defines a simple DSL for the creation of grants:
  //
  //   accounts.createGrantOn( target_id, 'role-to-give' ).for( user_id ).by( user_id );
  //
  // The target ID, the "by" ID, and the user ID *must* be valid integers that refer to valid
  // accounts in the system or the operation will error out. The name of the role, however is
  // abitrary. A user may have multiple roles to multiple targets, including multiple roles to the
  // same target, and a target may have roles for multiple accounts. The "by" account is used both
  // for auditing and (in theory) for administration of that grant.
  //
  // It returns a stream with the grant as an object on it.
  createGrantOn( tid, grant ) {
    var query = [
      'MATCH (acct:Account {id:{aid}}), (target {id:{tid}}), (by:Account {id:{bid}})',
      'CREATE UNIQUE acct<-[:FOR]-(grant:Grant {role:{grant},id:{gid}})-[:ON]->target',
      ', grant-[:BY]->by',
      'RETURN grant as node',
      'ORDER BY grant.role'
    ];

    var queryForEmail = [
      'MATCH (target {id:{tid}}), (by:Account {id:{bid}})',
      'MERGE (acct:Person { email: {email} })',
      'ON CREATE SET acct.new = 1, acct.id = {aid}',
      'CREATE UNIQUE acct<-[:FOR]-(grant:Grant {role:{grant},id:{gid}})-[:ON]->target',
      ', grant-[:BY]->by',
      'RETURN grant as node',
      'ORDER BY grant.role'
    ];

    return {
      for: ( aid ) => {
        return {
          by: ( bid ) => {
            return this._db.query( query, { aid, tid, bid, grant, gid: util.helper.generateId() });
          }
        };
      },
      forEmail: ( email ) => {
        return {
          by: ( bid ) => {
            return this._db.query( queryForEmail, {
              email,
              tid,
              bid,
              grant,
              aid: util.helper.generateId(),
              gid: util.helper.generateId()
            });
          }
        };
      }
    };
  },

  // ## getGrantsOn
  //
  // Once grants are created, they can be retrieved through a similar DSL:
  //
  //   accounts.getGrantsOn( target_id ).for( user_id );
  //
  // It returns a stream with each role as a separate object.
  getGrantsOn( tid ) {
    var queryFor = [
      'MATCH (acct:Account {id:{aid}})<-[:FOR]-(grant:Grant)-[:ON]->(target {id:{tid}})',
      'RETURN grant as node',
      'ORDER BY grant.role'
    ];

    var queryAll = [
      'MATCH (person:Person)<-[:FOR]-(grant:Grant)-[:ON]->(target {id:{tid}})',
      'RETURN grant, person',
      'ORDER BY grant.role'
    ];

    return {
      for: ( aid ) => {
        return this._db.query( queryFor, { aid, tid } );
      },
      all: () => {
        return this._db.queryMultiple( queryAll, { tid } )
          .map( function ( res ) {
            var grant = res.grant;
            grant.person = res.person;
            return grant;
          });
      }
    };
  },

  // ## hasGrant
  //
  // As a convenience, we the `hasGrant` method will check if an account has been granted a
  // particular role. This is a wrapper around `getGrantsOn` with a similar DSL.  It should return a
  //
  //   hasGrant( 'role' ).on( target ).for( acct )
  //   .apply( function ( sheHasTheGrant ) {
  //     if ( sheHasTheGrant ) { // ...
  //     } else { // ...
  //     }
  //   });
  //
  hasGrant( grant ) {
    return {
      on: ( target_id ) => {
        return {
          for: ( account_id ) => {
            return this.getGrantsOn( target_id ).for( account_id )
              .through( ( stream ) => {
                return stream.collect().map( ( grants ) => {
                  if ( grants.filter( ( g ) => { return g.role === grant }).length > 0 ) {
                    return true;
                  } else {
                    return false;
                  }
                });
              });
          }
        };
      }
    };
  },

  revokeGrant( id ) {
    var query = [
      'MATCH (grant:Grant {id:{id}})-[r]-n',
      'DELETE grant, r'
    ];

    return this._db.query( query, { id } );
  },
});

export default Auth2;

