// # Feiseanna

import { Factory } from 'administer';
import util from './utilities';
import Database from './database';
import Payments from './payments';
import Email from './email';
import _ from 'highland';
import transformEvent from './transform-event'
import { NotFound, NotAuthorized } from '../server/ext/errors';

const mergeFeisInfo = () => _.pipeline(
    // Reduce all feiseanna to a single map. E.g. de-dupe the feiseanna across the three resultsets.
  _.reduce( {}, ( feisMap, res ) => {
    const fid = res.feis.id;

    if ( ! feisMap[ fid ] ) {
      feisMap[ fid ] = { feis: res.feis };
    }

    const result = feisMap[ fid ];

    switch ( res.type ) {
      case 'G':
        result.grants = res.grants;
        break;
      case 'S':
        result.saved = res.saved;
        result.registered = res.registered;
        break;
      case 'B':
        result.balance = res.balance;
        break;
    }
    
    return feisMap;
  }),

  _.map( map => {
    // Convert the feis map to an array and add in any missing properties (e.g. registered but no
    // grants).
    return Object.getOwnPropertyNames( map ).map( n => {
      const res = map[ n ];

      if ( ! res.hasOwnProperty( 'balance' ) ) {
        res.balance = 0;
      }

      if ( ! res.hasOwnProperty( 'registered' ) ) {
        res.registered = 0;
      }

      if ( ! res.hasOwnProperty( 'saved' ) ) {
        res.saved = 0;
      }

      if ( ! res.hasOwnProperty( 'grants' ) ) {
        res.grants = [];
      }

      return res;
    }).sort( ( a, b ) => b.feis.dt_start - a.feis.dt_start );
  }),

  _.flatten()
);

// The `Feiseanna` class manages objects directly related to a feis. Objects that *belong* to a feis
// (e.g. events or competitors) are managed elsewhere.
const Feiseanna = Factory( 'Feiseanna', {
  _db: Database,
  _email: Email,
  _payments: Payments,
})
.methods({
  // ## Invitations
  //
  // ### createInvitation
  //
  // We define a method to create an "invitation" to create a feis. This is granted from one person
  // (e.g. a "god") to another to allow her to create a new feis in the system. The configuration
  // must have a fee, deposit, and email address, to which we add a UUID to be the public face of
  // this invitation.
  createInvitation ( props ) {
    var invite, account;
    props.id = util.helper.generateId();
    props.aid = util.helper.generateId();

    var query = [
      'MERGE (account:Person { email: {email} })',
      'ON CREATE SET account.new = 1, account.id = {aid}',
      'CREATE account<-[:FOR]-(invite:FeisInvite {',
      '  fee: { fee },',
      '  deposit: { deposit },',
      '  used: 0,',
      '  id: { id }',
      '})',
      'RETURN account, invite'
    ];

    // To handle a few consecutive operations, we create a pipeline.
    var pipeline = _.pipeline(
      // First, we need to get or create a person that matches this email address, then add to that
      // user a new invitation with the specified configuration.
      _.flatMap( ( invite ) => {
        return this._db.queryMultiple( query, props );
      }),

      // Then we need to email the person and let them know they've been invited to create a
      // feis.
      _.flatMap( ( results ) => {
        invite = results.invite;
        account = results.account;
        invite.person = account;

        // If the user has no account yet, send a special email.
        if ( account.new === 1 ) {
          return this._email.send( 'feis-invite-new', 'You\'ve been invited to create a feis!', invite ).to( props.email );
        // Otherwise, send a basic alert.
        // FIXME: Right now, these templates are identical, but probably shouldn't be in production.
        } else {
          return this._email.send( 'feis-invite', 'Create your feis!', invite ).to( props.email );
        }
      }),

      // Lastly, we still want to return just the invitation.
      _.map( ( res ) => {
        return invite;
      })
    );

    // Let's pass the config into the pipeline and return the result.
    return _([props]).pipe( pipeline ).head();
  },

  // ### invitations
  //
  // This is a basic getter for all invitations in the system.
  invitations () {
    var query = [
      'MATCH (invite:FeisInvite)-[:FOR]->(person:Person)',
      'RETURN invite, person'
    ];

    return this._db.queryMultiple( query )
    .map( function ( res ) {
      var invite = res.invite;
      invite.person = res.person;
      return invite;
    });
  },

  // ### invitation
  //
  // This is a basic getter for a specific invitation in the system by its UUID.
  invitation ( id ) {
    var query = [
      'MATCH (invite:FeisInvite { id: { id } })-[:FOR]->(person:Person)',
      'RETURN invite, person'
    ];

    return this._db.queryMultiple( query, { id } )
    .map( function ( res ) {
      var invite = res.invite;
      invite.person = res.person;
      return invite;
    })
    .head();
  },

  // ### invalidateInvitation
  //
  // In order to "take back" that an invitation was ever given, we can "invalidate" it. This cannot
  // be done, however, if the invitation has already been used, because what would that even mean?
  invalidateInvitation ( id ) {
    var query = [
      'MATCH (invite:FeisInvite { id: { id } })',
      'WHERE invite.used = 0',
      'SET invite.invalid = 1',
      'RETURN invite as node'
    ];

    return this._db.queryOne( query, { id } );
  },

  // ### inviteIsFor
  //
  // Lastly, we provide a little convenience check to see if a particular invitation is for a
  // particular person. It will return the invitation if it is and `false` otherwise.
  inviteIsFor ( id, email ) {
    var query = [
      'MATCH (account:Person { email: { email }})',
      'OPTIONAL MATCH (invite:FeisInvite { id: { id } })',
      'OPTIONAL MATCH invite-[isFor:FOR]->account',
      'RETURN account, invite, isFor'
    ];

    return this._db.queryMultiple( query, { id, email } )
      .flatMap( res => {
        if ( ! res.invite ) {
          return NotFound();
        }

        if ( ! res.isFor ) {
          return NotAuthorized();
        }

        return _([ res.invite ]);
      });
  },

  // ## Feis Templates
  //
  // ### templates
  //
  // Get all feis templates
  templates () {
    var query = [
      'MATCH (feis:FeisTemplate)',
      'RETURN feis as node',
      'ORDER BY feis.name'
    ];

    return this._db.query( query );
  },

  // ## Feiseanna
  //
  // ### one
  //
  // This retrieves a single feis by its ID. Nothing special here.
  one ( id ) {
    var query = [
      'MATCH (feis:Feis {id: {id}})',
      'OPTIONAL MATCH feis-[:PAYEE]->(stripe:StripeAccount)',
      'OPTIONAL MATCH (person:Person)-[:REGISTERED]->feis',
      'WITH feis, stripe, count(person) as num_participants',
      'RETURN feis, stripe, num_participants',
    ];

    return this._db.queryMultiple( query, { id } )
      .map( res => {
        const feis = res.feis;
        feis.num_participants = res.num_participants;
        feis.is_payee = res.stripe ? 1 : 0;

        return feis;
      })
      .head()
      ;
  },

  // ### all()
  //
  // This will return *all* feiseanna in the system that both are public and have not yet ended,
  // sorted ascending by the date they start.
  all ( aid, query = {} ) {
    var query = [
      'MATCH (feis:Feis)',
      'WHERE feis.is_public = 1',
      query.include_past ? '' : 'AND feis.dt_end >= timestamp()',
      'RETURN feis',
      'ORDER BY feis.dt_start ASC'
    ];

    return _([
      aid ? this._forUser( aid ) : _([]),
      this._db.queryMultiple( query ),
    ])
    .flatten()
    .pipe( mergeFeisInfo() )
    ;
  },

  // ### forUser
  //
  // For dashboard and other purposes, it can be helpful to get a list of *all* feiseanna for which
  // a user has a role, sorted descending by the date they start (the most recent comes first).
  _forUser( account_id ) {
    const starQuery = [
      'MATCH (acct:Account {id:{account_id}})-[saved:SAVED]->(feis:Feis {is_public: 1})',
      'WITH acct, feis, CASE WHEN saved IS NOT NULL then 1 ELSE 0 END as saved',
      'OPTIONAL MATCH acct<-[:DEPENDENT_OF*0..1]-(:Person)-[reg:REGISTERED]->feis',
      'WITH acct, feis, saved, count(reg) as regs',
      'RETURN DISTINCT feis, saved, CASE WHEN regs > 0 THEN 1 ELSE 0 END AS registered, "S" as type',
    ];

    const grantQuery = [
      'MATCH (feis:Feis)<-[:ON]-(grant:Grant)-[:FOR]->(account:Account {id:{account_id}})',
      'WITH DISTINCT feis, collect(grant.role) as grants',
      'WHERE LENGTH( grants ) > 0',
      'RETURN feis, grants, "G" as type',
    ];

    const err = e => console.log("ERR", e);
    return _([
      this._db.queryMultiple( grantQuery, { account_id } ).stopOnError(err),
      this._db.queryMultiple( starQuery, { account_id } ).stopOnError(err),
      this._payments.forAccount( account_id ).due().map( res => ({
        feis: res.feis,
        balance: res.balance,
        type: "B"
      })).stopOnError(err),
    ])
    .flatten()
    ;
  },

  forUser ( aid ) {
    return this._forUser( aid ).pipe( mergeFeisInfo() );
  },

  // ### create
  //
  // Given a few pieces of critical information, this method creates a new feis. Required
  // configuration properties are `id` (which must refer to a valid and active feis invitation),
  // `account_id`, which must refer to the person to whom that invitation was issued, and some feis
  // properties.
  //
  // Based on the name, we also create a slug of it for use in friendly URLs.
  create ( props ) {
    props.slug = util.string.sluggify( props.name );
    props.fid = util.helper.generateId();

    var createQuery = [
      // Validate the Invitation
      'MATCH (invite:FeisInvite {id: {id}})-[:FOR]->(account:Account {id:{account_id}})',
      'WHERE ( invite.invalid IS NULL OR invite.invalid = 0 )',
      ' AND (invite.used IS NULL OR invite.used = 0 )',

      // Create the Feis
      'CREATE invite<-[:FROM]-(feis:Feis {',
      '  name: { name },',
      '  slug: { slug },',
      '  tz: { tz },',
      '  is_public: 0,',
      '  id: {fid}',
      '})<-[:ON]-(:Grant { role: "chair" })-[:FOR]->account',
      'SET invite.used = 1',
      
      // Return the feis
      'RETURN feis as node'
    ];

    var copySyllabusQuery = [
      'MATCH (feis:Feis {id:{fid}})',
      'MATCH (:FeisTemplate {id:{tid}})<-[:OF]-(tpl:Event)',
      'CREATE feis<-[:OF]-(event:Event)',
      'SET event = tpl',
      'SET event.id = event.id + ":" + feis.id',
      
      // Return the feis
      'RETURN feis as node'
    ];

    return this._db.queryOne( createQuery, props )
      .map( ( feis ) => {
        if ( props.template_id ) {
          return this._db.queryOne( copySyllabusQuery, { fid: props.fid, tid: props.template_id } )
        } else {
          return [ feis ];
        }
      })
      .flatten()
      .head();
  },

  // ### finalize
  finalize ( id ) {
    const query = [
      'MATCH (feis:Feis {id:{id}})',
      'SET feis.is_finalized = 1',
      'RETURN feis as node',
    ];

    return this._db.queryOne( query, { id } );
  },

  // ### publish
  publish ( id ) {
    const query = [
      'MATCH (feis:Feis {id:{id}})',
      'SET feis.is_public = 1',
      'RETURN feis as node',
    ];

    return this._db.queryOne( query, { id } );
  },

  // ### unpublish
  unpublish ( id ) {
    const query = [
      'MATCH (feis:Feis {id:{id}})',
      'SET feis.is_public = 0',
      'RETURN feis as node',
    ];

    return this._db.queryOne( query, { id } );
  },

  // ### update
  //
  // The `update` method updates *all* properties of a feis, and as such they must all be present.
  update ( props ) {
    props.slug = util.string.sluggify( props.name );

    const whitelist = [
      'name',
      'dt_start',
      'dt_end',
      'dt_reg_end',
      'dt_reg_start',
      'dt_reg_late',
      'is_public',
      'is_syllabus_public',
      'is_schedule_public',
      'is_final',
      'url',
      'description',
      'event_fee',
      'acct_fee',
      'acct_max',
      'late_fee',
      'loc_name',
      'loc_addr',
      'tz',
    ];

    var query = [
      'MATCH (feis:Feis {id:{id}})',
      'SET',
    ]
    .concat( whitelist.filter( i => props[i] !== undefined ).map( i => `feis.${i} = { ${i} },` ) )
    .concat([
      'feis.slug = { slug }',
      'RETURN feis as node',
    ]);

    return this._db.queryOne( query, props );
  },

  // ### adjudicators
  //
  // Get all adjudicators assigned to this feis.
  adjudicators ( fid ) {
    var query = [
      'MATCH (adj:Adjudicator)-[:JUDGED]->(feis:Feis {id:{fid}})',
      'RETURN adj as node'
    ];

    return this._db.query( query, { fid } );
  },

  // ### attachAdjudicator
  //
  // Attach an adjudicator to this feis.
  attachAdjudicator ( fid, aid ) {
    var query = [
      'MATCH (adj:Adjudicator {id:{aid}}), (feis:Feis {id:{fid}})',
      'CREATE UNIQUE adj-[rel:JUDGED]->feis',
      'RETURN adj as node'
    ];

    return this._db.queryOne( query, { fid, aid } );
  },

  // ### detachAdjudicator
  //
  // Detach an adjudicator assigned from this feis.
  detachAdjudicator ( fid, aid ) {
    var query = [
      'MATCH (adj:Adjudicator {id:{aid}})-[rel:JUDGED]->(feis:Feis {id:{fid}})',
      'DELETE rel'
    ];

    return this._db.query( query, { fid, aid} );
  },

  // ### participants
  //
  // Get a list of participants in the feis.
  participants ( id, opts ) {
    // WHERE clause for regexp matching against a person's first name, last name, or registration
    // number.
    var filter = [
      '(',
      '   person.fname =~ ("(?i).*" + {filter} + ".*")',
      'OR person.lname =~ ("(?i).*" + {filter} + ".*")',
      'OR tostring(reg.num) =~ ("(?i).*" + {filter} + ".*")',
      ')'
    ].join( ' ' );

    // Get participants, with their feis registration, if it exists, filtering if necessary.
    var query = [
      'MATCH (person:Person)-[:DEPENDENT_OF*0..1]->(acct:Account)-[:SAVED]->(feis:Feis {id:{id}})',
      'OPTIONAL MATCH (school:School)<-[:ATTENDS]-person',
      'OPTIONAL MATCH person-[reg:REGISTERED]->feis',
      'WITH person, school, reg',
      opts.filter ? 'WHERE ' + filter : '',
      'RETURN DISTINCT person, school, reg',
      'ORDER BY person.lname, person.fname, reg.num ASC',
      'SKIP {offset}',
      'LIMIT {limit}'
    ];

    return this._db.queryMultiple( query, { id, offset: opts.offset, limit: opts.limit, filter: opts.filter } )
      .map( ( row ) => {
        if ( row.school ) {
          row.person.school = row.school;
        }

        row.person.competitor = row.reg ? row.reg.num : null;

        return row.person;
      });
  },

  // ### participant
  //
  // Get a single participant in the feis.
  participant ( fid, num ) {
    var query = [
      'MATCH (school:School)<-[:ATTENDS]-(person:Person)-[reg:REGISTERED]->(feis:Feis {id:{fid}})',
      'WHERE reg.num = toInt({num})',
      'RETURN DISTINCT person, school, reg'
    ];

    return this._db.queryMultiple( query, { fid, num } )
      .map( ( row ) => {
        row.person.school = row.school;
        row.person.competitor = row.reg ? row.reg.num : null;

        return row.person;
      })
      .head();
  },

  // ### accountsWithoutPayment
  //
  accountsWithoutPayment ( fid ) {
    const query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(:Event)<-[:PARTICIPANT]-(person:Person)',
      ', person-[:DEPENDENT_OF*0..1]-(acct:Account)',
      'WITH DISTINCT feis, acct',
      'WHERE NOT feis--(:Payment)--acct',
      'RETURN DISTINCT acct as node',
    ];

    return this._db.query( query, { fid } );
  },

  // ### competitorsBySchool
  //
  competitorsBySchool ( fid ) {
    const query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(:Event)<-[:PARTICIPANT]-(person:Person)',
      ', person-[:DEPENDENT_OF*0..1]-(acct:Account)',
      ', person-[:ATTENDS]->(school:School)',

      // Get participant count
      'WITH school, feis, count(DISTINCT person) as participants',

      // Get paid/unpaid counts
      'OPTIONAL MATCH school<-[:ATTENDS]-(person:Person)-[:DEPENDENT_OF*0..1]-(:Account)--(:Payment)--feis',
      ', (person)-[:PARTICIPANT]->(:Event)-[:OF]-(feis)',
      'WITH school, participants, count(DISTINCT person) AS paid',
      'WITH school, participants, paid, (participants - paid) as unpaid',

      'RETURN school.id as id, school.name as name, unpaid, paid, participants',
      'ORDER BY school.name ASC'
    ];

    return this._db.queryMultiple( query, { fid } );
  },

  // ### Placements
  //
  scoresForPerson ( fid, pid ) {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event)<-[score:PARTICIPANT]-(person:Person {id:{pid}})',
      'WHERE event.is_in_results = 1',
      'RETURN event, score'
    ];

    return this._db.queryMultiple( query, { fid, pid } )
      .map( row => {
        transformEvent( row.event );
        row.event.score = row.score;
        return row.event;
      });
  },

  placementsForPerson ( fid, pid ) {
    return this.scoresForPerson( fid, pid ).filter( s => s.score.placed === 1 );
  },

  // ### Starring
  //
  star ( fid, aid ) {
    var query = [
      'MATCH (acct:Account {id:{aid}}), (feis:Feis {id:{fid}})',
      'CREATE UNIQUE acct-[:SAVED]->feis',
      'RETURN feis as node',
    ];

    return this._db.queryOne( query, { fid, aid } );
  },

  unstar ( fid, aid ) {
    var query = [
      'MATCH (acct:Account {id:{aid}})-[saved:SAVED]->(feis:Feis {id:{fid}})',
      'OPTIONAL MATCH feis<-[r:REGISTERED]-(:Person)-[:DEPENDENT_OF*0..1]->acct',
      'WITH acct, saved, feis, count(r) as reg',
      'WHERE reg = 0',
      'DELETE saved',
    ];

    return this._db.query( query, { fid, aid } );
  },
})
;

export default Feiseanna;

