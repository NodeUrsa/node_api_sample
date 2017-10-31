import Administer from 'administer';
import {getServer,sinon,expect} from '../../util/test-helpers';
import AccountRoutes from './accounts';
import Accounts from '../../lib/accounts';

describe( 'AccountRoutes', () => {
  var user;

  beforeEach( function () {
    this.adm = Administer();

    user = {
      id: '1234'
    }; 
  });

  describe( 'routes', function () {
    var accts;

    beforeEach( function () {
      accts = {
        getOne: sinon.spy(),
        update: sinon.spy(),
        getFromPerson: sinon.spy( () => ({}) ),
      };

      this.adm.provide( Accounts, accts );

      return getServer( this.adm, null, { user } )
        .then( s => this.server = s )
        ;
    });

    describe( 'GET /api/accounts/me', function () {
      it( 'should get the account currently logged in', function () {
        return this.server.get( '/api/accounts/me' )
        .then( res => {
          accts.getOne.called.should.be.true;
          accts.getOne.calledWith( user.id ).should.be.true;
        });
      });
    });

    describe( 'PUT /api/accounts/me', function () {
      var body = { fname: 'Test', lname: 'User' };

      it( 'should update the account currently logged in', function () {
        return this.server.put( '/api/accounts/me' ).send( body )
        .then( res => {
          accts.update.called.should.be.true;
          accts.update.calledWith( user.id, body ).should.be.true;
        });
      });
    });

    describe( 'GET /api/accounts/for-person/:pid', function () {
      const id = '123';

      it( 'should return 200 with the requested account', function () {
        return this.server.get( `/api/accounts/for-person/${id}` )
          .expect( 200 )
          .then( () => {
            expect( accts.getFromPerson ).to.have.been.calledWith( id );
          })
          ;
      });
    });

    describe( 'GET /api/accounts/:id', function () {
      it( 'should get the account specified', function () {
        return this.server.get( '/api/accounts/4567' )
        .then( ({  res } ) => {
          accts.getOne.called.should.be.true;
          accts.getOne.calledWith( '4567' ).should.be.true;
        });
      });
    });
  });
});

