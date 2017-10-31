import Administer from 'administer';
import {expect,emptyGraph,queryGraph,sinon} from '../util/test-helpers.js';
import {mockOutEmail} from '../util/mocks/index';
import Email from './email';
import Feiseanna from './feiseanna';
import util from './utilities';
import Auth2 from './auth';

describe( 'Feiseanna', () => {
  var feiseanna, email, inviteId, usedInviteId, existingInviteId, existingUsedInviteId, feis1id,
  feis2id, feis3id, person1id, person2id, person3id, grant1id, grant2id;

  beforeEach( function () {
    inviteId = util.helper.generateId();
    usedInviteId = util.helper.generateId();
    existingInviteId = util.helper.generateId();
    existingUsedInviteId = util.helper.generateId();
    person1id = util.helper.generateId();
    person2id = util.helper.generateId();
    grant1id = util.helper.generateId();
    grant2id = util.helper.generateId();
    feis1id = util.helper.generateId();
    feis2id = util.helper.generateId();
    feis3id = util.helper.generateId();

    this.adm = Administer();
    mockOutEmail( this.adm );
    return this.adm.get([ Feiseanna, Email ]).then( ([ f, e ]) => {
      feiseanna = f;
      email = e;

      return emptyGraph( this.adm ).then( () => queryGraph( this.adm, [
        'CREATE (p3:Person:Account {email:"existing@test.com", new: 0, id:{person1id}})',
        ', (p1:Person {email:"null@test.com",id:{person2id}})<-[:FOR]-(i1:FeisInvite {used: 0, id: {inviteId}})',
        ', (p2:Person {id:{person2id},email:"null2@test.com"})<-[:FOR]-(i2:FeisInvite {used: 1, id: {usedInviteId}})',
        ', p3<-[:FOR]-(i3:FeisInvite {used: 0, id: {existingInviteId}})',
        ', p3<-[:FOR]-(i4:FeisInvite {used: 1, id: {existingUsedInviteId}})',
        ', (feis1:Feis {dt_start:timestamp()+(1000*60*60*24*10),dt_end:timestamp()+(1000*60*60*24*11),is_public:1,id:{feis1id}})',
        ', (feis2:Feis {dt_start:timestamp()-(1000*60*60*24*7),dt_end:timestamp()-(1000*60*60*24*6),is_public:1,id:{feis2id}})',
        ', (feis3:Feis {dt_start:timestamp()+(1000*60*60*24*11),dt_end:timestamp()+(1000*60*60*24*12),is_public:0,id:{feis3id}})',
        ', p3<-[:FOR]-(:Grant { role: "chair", id:{grant1id} })-[:ON]->feis1',
        ', p3<-[:FOR]-(:Grant { role: "chair", id:{grant2id} })-[:ON]->feis3',
        'RETURN feis1, feis2, feis3, p3'
      ].join( " \n" ), {
        person1id, feis1id, feis2id, feis3id, inviteId, usedInviteId, existingInviteId,
        existingUsedInviteId, grant1id, grant2id, person2id, person3id
      } ) );
    });
  });

  describe( '#invitations()', () => {
    it( 'should retrieve all invitations', ( done ) => {
      feiseanna.invitations()
        .toArray( ( invites ) => {
          invites.length.should.be.exactly( 4 );
          done();
        });
    });
  });

  describe( '#invitation()', () => {
    it( 'should retrieve an invitation by UUID', ( done ) => {
      feiseanna.invitation( inviteId )
        .apply( ( invite ) => {
          (invite === undefined).should.not.be.ok
          invite.id.should.be.exactly( inviteId );
          done();
        });
    });
  });

  describe( '#invalidateInvitation()', () => {
    it( 'should invalidate an invitation by ID', ( done ) => {
      feiseanna.invalidateInvitation( inviteId )
        .apply( ( invite ) => {
          (invite === undefined).should.not.be.ok
          invite.id.should.be.exactly( inviteId );
          (invite.invalid === undefined).should.not.be.ok
          invite.invalid.should.be.exactly( 1 );
          done();
        });
    });

    it( 'should not invalidate an invitation that\'s been used', ( done ) => {
      feiseanna.invalidateInvitation( usedInviteId )
        .apply( ( invite ) => {
          (invite === undefined).should.be.ok
          done();
        });
    });
  });

  describe( 'inviteIsFor()', () => {
    it( 'should return the invite when the invite is for an account', ( done ) => {
      feiseanna.inviteIsFor( inviteId, 'null@test.com' )
        .apply( res => {
          expect( res ).to.have.property( 'id', inviteId );
          done();
        });
    });

    it( 'should return an error when the invite is for an account', ( done ) => {
      feiseanna.inviteIsFor( inviteId, 'null2@test.com' )
        .stopOnError( err => {
          expect( err ).to.have.property( 'statusCode', 403 );
          done();
        }).apply(()=>{});
    });

    it( 'should return an error when the invite does not exist', ( done ) => {
      feiseanna.inviteIsFor( 'bad-invite-id', 'null@test.com' )
        .stopOnError( err => {
          expect( err ).to.have.property( 'statusCode', 404 );
          done();
        }).apply(()=>{});
    });
  });

  describe( '#createInvitation()', () => {
    var new_invite = {
      email: 'new@test.com',
      fee: 5.00,
      deposit: 5000.00
    };

    var existing_invite = {
      email: 'existing@test.com',
      fee: 5.00,
      deposit: 5000.00
    };

    it( 'should create an invitation and send an email to an existing person', ( done ) => {
      feiseanna.createInvitation( existing_invite )
        .apply( ( invite ) => {
          (invite === undefined).should.not.be.ok;
          email.send.calledWith( 'feis-invite' ).should.be.ok;
          invite.fee.should.be.exactly( 5.00 );
          invite.deposit.should.be.exactly( 5000.00 );
          (invite.id === undefined).should.not.be.ok;
          done();
        });
    });

    it( 'should create an invitation and send an email to a new person', ( done ) => {
      feiseanna.createInvitation( new_invite )
        .apply( ( invite ) => {
          (invite === undefined).should.not.be.ok;
          email.send.calledWith( 'feis-invite-new' ).should.be.ok;
          invite.fee.should.be.exactly( 5.00 );
          invite.deposit.should.be.exactly( 5000.00 );
          (invite.id === undefined).should.not.be.ok;
          done();
        });
    });
  });

  describe( 'all()', () => {
    it( 'should retrieve only those public feiseanna that have not passed', ( done ) => {
      feiseanna.all( 'ignore' ) // we aren't interested feiseanna for a user; this id is meaningless
        .toArray( ( f ) => {
          expect( f ).to.be.an.instanceof( Array ).with.lengthOf( 1 );
          expect( f[0] ).to.have.deep.property( 'feis.id', feis1id );
          done();
        });
    });
  });

  describe( 'one()', () => {
    it( 'should retrieve a public feiseanna by ID', ( done ) => {
      feiseanna.one( feis1id )
        .apply( ( feis ) => {
          (feis === undefined).should.not.be.ok;
          feis.id.should.be.exactly( feis1id );
          done();
        });
    });
  });

  describe( 'forUser()', () => {
    it( 'should retrieve all feiseanna for which the specified user has a role', ( done ) => {
      feiseanna.forUser( person1id )
        .toArray( res => {
          expect( res ).to.be.an.instanceOf( Array ).with.lengthOf( 2 );
          expect( res[0] ).to.have.deep.property( 'feis.id' );

          const ids = res.map( f => f.feis.id );
          expect( ids ).to.include.members([ feis1id, feis3id ]);
          done();
        });
    });
  });

  describe( 'create()', function () {
    it( 'should create a new feis with the proper grant', function () {
      return this.adm.get( Auth2 ).then( auth2 => new Promise( ( resolve ) =>
        feiseanna.create({
          name: 'The Test Feis',
          dt_start: Date.now() + ( 1000 * 60 * 60 * 24 ),
          dt_end: Date.now() + ( 1000 * 60 * 60 * 48 ),
          account_id: person1id,
          id: existingInviteId,
          tz: 'America/Los_Angeles',
        }).apply( ( feis ) => {
            (feis === undefined).should.not.be.ok;
            feis.is_public.should.be.exactly( 0 );
            feis.slug.should.equal( util.string.sluggify( 'The Test Feis' ) );

            auth2.hasGrant( 'chair' ).on( feis.id ).for( person1id )
              .apply( ( res ) => {
                res.should.be.ok;
                resolve();
              });
          })));
    });

    it( 'should mark the invitation as used', function () {
      return this.adm.get( Auth2 ).then( auth2 => new Promise( ( resolve ) =>
        feiseanna.create({
          name: 'The Test Feis',
          dt_start: Date.now() + ( 1000 * 60 * 60 * 24 ),
          dt_end: Date.now() + ( 1000 * 60 * 60 * 48 ),
          account_id: person1id,
          id: existingInviteId,
          tz: 'America/Los_Angeles',
        }).apply( ( feis ) => {
          (feis === undefined).should.not.be.ok;
          feis.is_public.should.be.exactly( 0 );

          feiseanna.invitation( existingInviteId )
            .apply( ( invite ) => {
              invite.used.should.be.exactly( 1 );
              resolve();
            });
        })));
    });

    it( 'should not create a new feis without a valid invitation', function () {
      return this.adm.get( Auth2 ).then( auth2 => new Promise( ( resolve ) =>
        feiseanna.create({
          name: 'The Test Feis',
          dt_start: Date.now() + ( 1000 * 60 * 60 * 24 ),
          dt_end: Date.now() + ( 1000 * 60 * 60 * 48 ),
          account_id: person1id,
          id: 'invalid-id'
        }).apply( ( feis ) => {
          (feis === undefined).should.be.ok;
          resolve();
        })));
    });

    it( 'should not create a new feis with a used invitation', function () {
      return this.adm.get( Auth2 ).then( auth2 => new Promise( ( resolve ) =>
        feiseanna.create({
          name: 'The Test Feis',
          dt_start: Date.now() + ( 1000 * 60 * 60 * 24 ),
          dt_end: Date.now() + ( 1000 * 60 * 60 * 48 ),
          account_id: person1id,
          id: existingUsedInviteId
        }).apply( ( feis ) => {
          (feis === undefined).should.be.ok;
          resolve();
        })));
    });
  });

  describe( 'update()', () => {
    it( 'should update all properties', ( done ) => {
      feiseanna.one( feis1id )
        .apply( ( feis ) => {
          var name = feis.name = 'Renamed Feis';
          var dt_end = feis.dt_end = feis.dt_end * 2;
          feiseanna.update( feis )
            .apply( ( feis ) => {
              feis.name.should.equal( name );
              feis.slug.should.equal( util.string.sluggify( name ) );
              feis.dt_end.should.equal( dt_end );
              done();
            });
        });
    });
  });
});

