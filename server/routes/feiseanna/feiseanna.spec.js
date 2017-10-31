import Administer from 'administer';
import { getServer, sinon, emptyGraph, queryGraph } from '../../../util/test-helpers';
import { mockOutAuth } from '../../../util/mocks/index';
import FeiseannaRoutes from './';
import Auth2 from '../../../lib/auth';
import Feiseanna from '../../../lib/feiseanna';
import util from '../../../lib/utilities';
import _ from 'highland';

describe( 'FeiseannaRoutes', () => {
  beforeEach( function () {
    this.adm = Administer();
  });

  describe( '#routes', function () {
    var feiseanna;
    var testFeis;
    var testGrants = [];
    let FeiseannaMock;
    let Auth2Mock;
    let user;

    beforeEach( function () {
      testGrants = [];
      testFeis = {
        name: 'Test Feis',
        slug: 'test-feis',
        id: 'testid',
        is_public: 1
      };
      user = {
        id: '1234',
      };

      this.invite = { id: '1234', person: user };

      FeiseannaMock = {
        invitation: sinon.spy( () => _([ this.invite ]) ),
        invitations: sinon.spy(),
        invalidateInvitation: sinon.spy(),
        createInvitation: sinon.spy(),
        one: function () { return _([ testFeis ]); },
        all: sinon.spy(),
        create: sinon.spy(),
        update: sinon.spy(),
        forUser: sinon.spy()
      };
      this.adm.provide( Feiseanna, FeiseannaMock );

      Auth2Mock = {
        getGrantsOn: () => ({ for: () => _( testGrants ) }),
        entity: function () {}
      };
      this.adm.provide( Auth2, Auth2Mock );

      return this.adm.get( Feiseanna ).then( f => {
        feiseanna = f;
      });
    });

    describe( 'invitations', function () {
      beforeEach( function () {
        user.is_god = 1;
      });

      describe( 'GET /api/feiseanna/invitations', function () {
        it( 'should call Feiseanna#invitations()', function () {
          return getServer( this.adm, FeiseannaRoutes, { user } )
          .then( s => s.get( '/api/feiseanna/invitations' ) )
          .then( res => {
            feiseanna.invitations.called.should.be.true;
          });
        });
      });

      describe( 'POST /api/feiseanna/invitations', function () {
        var body = {
          fee: 5.00,
          deposit: 5000.00,
          email: 'joe@joe.com'
        };

        it( 'should call Feiseanna#createInvitation()', function () {
          return getServer( this.adm, FeiseannaRoutes, { user } )
          .then( s => s.post( '/api/feiseanna/invitations' ).send( body ) )
          .then( res => {
            feiseanna.createInvitation.called.should.be.true;
            feiseanna.createInvitation.calledWith( body ).should.be.true;
          } );
        });
      });

      describe( 'GET /api/feiseanna/invitations/:id', function () {
        var id = util.helper.generateId();

        it( 'should call Feiseanna#invitation()', function () {
          return getServer( this.adm, FeiseannaRoutes, { user } )
          .then( s => s.get( '/api/feiseanna/invitations/' + id ) )
          .then( res => {
            feiseanna.invitation.called.should.be.true;
            feiseanna.invitation.calledWith( id ).should.be.true;
          });
        });
      });

      describe( 'DELETE /api/feiseanna/invitations/:id', function () {
        var id = util.helper.generateId();

        it( 'should call Feiseanna#invalidateInvitation()', function () {
          return getServer( this.adm, FeiseannaRoutes, { user } )
          .then( s => s.delete( '/api/feiseanna/invitations/' + id ) )
          feiseanna.invalidateInvitation.called.should.be.true;
          feiseanna.invalidateInvitation.calledWith( id ).should.be.true;
        });
      });
    });

    describe( 'GET /api/feiseanna', function () {
      it( 'should call Feiseanna#all()', function () {
        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.get( '/api/feiseanna' ) )
        .then( res => {
          feiseanna.all.called.should.be.true;
        });
      });
    });

    describe( 'GET /api/feiseanna/mine', function () {
      it( 'should call Feiseanna#forUser()', function () {
        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.get( '/api/feiseanna/mine' ) )
        .then( res => {
          feiseanna.forUser.calledWith( user.id ).should.be.true;
        });
      });
    });

    describe( 'POST /api/feiseanna', function () {
      var body = {
        id: util.helper.generateId(),
        name: 'Test Feis',
        dt_start: Date.now(),
        dt_end: Date.now()
      };

      it( 'should call Feiseanna#create() with the body', function () {
        const expectedProps = body;
        expectedProps.account_id = user.id;
        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.post( '/api/feiseanna' ).send( body ).expect( 200 ) )
        .then( res => {
          feiseanna.create.calledWith( expectedProps ).should.be.true;
        });
      });
    });

    describe( 'PUT /api/feiseanna/:feis_id', function () {
      var body = {
        id: 'testid',
        name: 'Test Feis',
        slug: 'test-feis',
        dt_start: Date.now(),
        dt_end: Date.now(),
        is_public: 0
      };

      it( 'should call Feiseanna#update() with the body', function () {
        testGrants.push([ 'chair' ]);

        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.put( '/api/feiseanna/testid' ).send( body ) )
        .then( res => {
          feiseanna.update.calledWith( body ).should.be.true;
        });
      });
    });

    describe( 'GET /api/feiseanna/:id', function () {
      it( 'should return a not found for a nonexistent feis', function () {
        feiseanna.one = function () { return _([]); };

        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.get( '/api/feiseanna/nonexistent' ) )
        .then( res => {
          res.body.errors.should.be.an.Array.with.lengthOf( 1 );
          res.body.errors[0].code.should.be.exactly( 404 );
        })
        ;
      });

      it( 'should return a public feis', function () {
        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.get( '/api/feiseanna/testid' ) )
        .then( res => {
          res.body.data.should.be.an.Object.with.property( 'id' );
          res.body.data.id.should.be.exactly( testFeis.id );
        });
      });

      it( 'should return unauthorized for a non-public feis when unauthenticated', function () {
        testFeis.is_public = 0;
        return getServer( this.adm, FeiseannaRoutes )
        .then( s => s.get( '/api/feiseanna/testid' ) )
        .then( res => {
          res.body.errors.should.be.an.Array.with.lengthOf( 1 );
          res.body.errors[0].code.should.be.exactly( 401 );
        });
      });

      it( 'should return a private feis when the user is god', function () {
        testFeis.is_public = 0;
        user.is_god = 1;
        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.get( '/api/feiseanna/testid' ).expect( 200 ) )
        .then( res => {
          res.body.data.should.be.an.Object.with.property( 'id' );
          res.body.data.id.should.be.exactly( testFeis.id );
        });
      });

      it( 'should return a private feis when the user has grants', function () {
        testFeis.is_public = 0;
        testGrants = [ 'grant1' ];
        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.get( '/api/feiseanna/testid' ) )
        .then( res => {
          res.body.data.should.be.an.Object.with.property( 'id' );
          res.body.data.id.should.be.exactly( testFeis.id );
        });
      });

      it( 'should return forbidden for a private feis when the user has no grants', function () {
        testFeis.is_public = 0;
        return getServer( this.adm, FeiseannaRoutes, { user } )
        .then( s => s.get( '/api/feiseanna/testid' ) )
        .then( res => {
          res.body.errors.should.be.an.Array.with.lengthOf( 1 );
          res.body.errors[0].code.should.be.exactly( 403 );
        });
      });
    });
  });
});

