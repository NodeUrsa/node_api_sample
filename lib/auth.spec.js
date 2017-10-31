import Administer from 'administer';
import {expect,_,emptyGraph,queryGraph,sinon} from '../util/test-helpers';
import {EmailMock,EmailMockInner,mockOutEmail} from '../util/mocks';
import Auth2 from './auth';
import Email from './email';
import util from './utilities';

describe( 'Auth2', () => {
  var auth2, email, adm;

  beforeEach( function () {
    adm = Administer();
    mockOutEmail( adm );

    return adm.get([ Auth2, Email ]).then( ([ a, e ]) => {
      auth2 = a;
      email = e;
    });
  });

  it( 'should define an entity with the provided info', () => {
    var name = 'test';
    var conf = {};
    auth2.entity( name, conf );

    (auth2._entities[name] === undefined).should.be.false;
    auth2._entities[name].should.equal( conf );
  });

  it( 'should throw error if missing name', () => {
    ( () => { auth2.entity( undefined, {} ); }).should.throw();
  });

  it( 'should throw error if missing config', () => {
    ( () => { auth2.entity( 'test' ); }).should.throw();
  });

  describe( 'check', () => {
    it( 'should return stream error if invalid entity', ( done ) => {
      auth2.check( 'test' )
        .stopOnError( ( err ) => {
          expect( err ).to.have.property( 'statusCode', 500 );
          done();
        })
        .toArray( () => {} );
    });

    it( 'should return stream error if check doesn\'t exist', ( done ) => {
      auth2.entity( 'test', { 'write': () => {} } );
      auth2.check( 'test', 'read' )
        .stopOnError( ( err ) => {
          expect( err ).to.have.property( 'statusCode', 500 );
          done();
        })
        .toArray( () => {} );
    });

    it( 'should return stream error if check doesn\'t return a stream', ( done ) => {
      auth2.entity( 'test', { 'read': () => { return 'hello'; } } );
      auth2.check( 'test', 'read' )
        .stopOnError( ( err ) => {
          expect( err ).to.have.property( 'statusCode', 500 );
          done();
        })
        .toArray( () => {} );
    });

    it( 'should return stream with valid input', ( done ) => {
      auth2.entity( 'test', { 'read': () => { return _([ true ]); } } );
      auth2.check( 'test', 'read' )
        .toArray( ( res ) => {
          res.length.should.equal( 1 );
          res[0].should.be.true;
          done();
        });
    });
  });

  describe( 'getOrCreateAccount', () => {
    var existingAcct = {
      name: {
        givenName: 'Existing',
        familyName: 'User'
      },
      emails: [{ value: 'existing@test.com' }],
    };

    var newAcct = {
      name: {
        givenName: 'New',
        familyName: 'User'
      },
      emails: [{ value: 'new@test.com' }],
    };

    var oauthId = '0123456789';

    function getUsers () {
      return queryGraph( adm, 'MATCH (a:Account) RETURN count(a) as num;' );
    }

    function getIds () {
      return queryGraph( adm, 'MATCH (o:OAuthIdentifier) RETURN count(o) as num;' );
    }

    beforeEach( function () {
      return emptyGraph( adm );
    });

    describe( 'existing accounts', () => {
      beforeEach( function () {
        return queryGraph( adm, [
          'CREATE',
          '(a:Account:Person {email:"existing@test.com",new:0,id:"123456789"})',
          '  <-[:FOR]-',
          '(o:OAuthIdentifier {id:"123456789"})',
          '  -[:FROM]->',
          '(g:OAuthProvider {name:"Google"})'
        ].join( " \n" ) );
      });

      it( 'should find an existing account by OAuth identifier', ( done ) => {
        const id = '123456789';

        auth2.getOrCreateAccount( id, existingAcct )
        .toArray( ( res ) => {
          var user = res[0];

          res.length.should.equal( 1 );
          (user === undefined).should.not.be.ok;
          user.id.should.be.a.String;
          user.email.should.equal( existingAcct.emails[0].value );
          user.new.should.not.be.ok;

          email.send.called.should.not.be.ok;

          getUsers().then( accts => {
            accts[0].num.should.be.exactly( 1 );

            getIds().then( ids => {
              ids[0].num.should.be.exactly( 1 );

              done();
            });
          });
        });
      });

      it( 'should find an existing account by email and create identifier', ( done ) => {
        const id = '012345678';

        auth2.getOrCreateAccount( id, existingAcct )
        .toArray( ( res ) => {
          var user = res[0];

          res.length.should.equal( 1 );
          (user === undefined).should.not.be.ok;
          user.id.should.be.a.String;
          user.email.should.equal( existingAcct.emails[0].value );
          user.new.should.not.be.ok;

          email.send.called.should.not.be.ok;

          getUsers().then( accts => {
            accts[0].num.should.be.exactly( 1 );

            getIds().then( ids => {
              ids[0].num.should.be.exactly( 2 );

              done();
            });
          });
        });
      });
    });
    
    it( 'should create a new account and identifier', ( done ) => {
      auth2.getOrCreateAccount( oauthId, newAcct )
        .toArray( ( res ) => {
          var user = res[0];

          res.length.should.equal( 1 );
          (user === undefined).should.not.be.ok;
          user.id.should.be.a.String;
          user.email.should.equal( newAcct.emails[0].value );
          user.new.should.not.be.ok;

          email.send.called.should.be.ok;
          EmailMockInner.to.called.should.be.ok;

          getUsers().then( accts => {
            accts[0].num.should.be.exactly( 1 );

            getIds().then( ids => {
              ids[0].num.should.be.exactly( 1 );

              done();
            });
          });
        });
    });
  });

  describe( 'grants', function () {
    var onEmail = 'on@test.com';
    var byEmail = 'by@test.com';
    var onAcct, target, byAcct;

    beforeEach( function () {
      onAcct = util.helper.generateId();
      byAcct = util.helper.generateId();
      target = util.helper.generateId();

      return emptyGraph( adm )
        .then( () => queryGraph( adm, [
          'CREATE (a:Account {email:{one},id:{oid}}), (a2:Account {name:{bye},id:{bid}})',
          ', (o:Test {id:{tid}})',
          ', a<-[:FOR]-(g1:Grant {role:"role1"})-[:ON]->o',
          ', a<-[:FOR]-(g2:Grant {role:"role2"})-[:ON]->o',
          ', g1-[:BY]->a2',
          ', g2-[:BY]->a2',
          'RETURN a as acct1, a2 as acct2, o as target'
        ].join( " \n" ), { one: onEmail, bye: byEmail, oid: onAcct, bid: byAcct, tid: target } ) );
    });

    describe( 'getGrantsOn', () => {
      it( 'should return existing grants for an account', ( done ) => {
        auth2.getGrantsOn( target ).for( onAcct )
          .toArray( ( grants ) => {
            grants.length.should.be.exactly( 2 );
            grants.should.eql([{role: 'role1'},{role: 'role2'}]);
            done();
          });
      });
    });

    describe( 'createGrantOn', () => {
      it( 'should create a new grant from an account to an arbitrary object', ( done ) => {
        auth2.createGrantOn( target, "newrole" ).for( onAcct ).by( byAcct )
          .toArray( ( grants ) => {
            grants.length.should.be.exactly( 1 );
            grants[0].role.should.equal( 'newrole' );
            done();
          });
      });
    });

    describe( 'hasGrant', () => {
      it( 'should not find an non-existing grant for an account-target', ( done ) => {
        auth2.hasGrant( 'non-existent-role' ).on( target ).for( onAcct )
          .apply( ( hasGrant ) => {
            hasGrant.should.be.false;
            done();
          });
      });

      it( 'should not find any grants for an account-target without grants', ( done ) => {
        auth2.hasGrant( 'non-existent-role' ).on( target ).for( byAcct )
          .apply( ( hasGrant ) => {
            hasGrant.should.be.false;
            done();
          });
      });

      it( 'should find an existing grant for an account-target', ( done ) => {
        auth2.hasGrant( 'role1' ).on( target ).for( onAcct )
          .apply( ( hasGrant ) => {
            hasGrant.should.be.true;
            done();
          });
      });
    });
  });
});

