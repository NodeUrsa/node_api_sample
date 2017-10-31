import Administer from 'administer';

import Adjudicators from '../../lib/adjudicators';
import {expect,getServer,sinon} from '../../util/test-helpers';

describe( 'AdjudicatorsRoutes', function () {
  beforeEach( function () {
    this.endpoint = ( path = '' ) => `/api/adjudicators${path}`;

    this.adjudicators = [{
      id: '1',
      fname: 'Judge',
      lname: 'Dredd',
    }, {
      id: '2',
      fname: 'Judge',
      lname: 'Dreddmore',
    }];

    this.MockAdjudicators = {
      get: sinon.spy( () => this.adjudicators ),
      create: sinon.spy( () => this.adjudicators[0] ),
      one: sinon.spy( () => this.adjudicators[0] ),
      update: sinon.spy( () => this.adjudicators[0] ),
      delete: sinon.spy(),
    };
    this.mockUser = {};

    this.adm = Administer();
    this.adm.provide( Adjudicators, this.MockAdjudicators );

    return getServer( this.adm, null, { user: this.mockUser } )
      .then( s => this.server = s )
      ;
  });

  describe( 'GET /', function () {
    it( 'should call Adjudicators.get', function () {
      return this.server.get( this.endpoint() )
        .expect( 200 )
        .then( () => {
          expect( this.MockAdjudicators.get ).to.have.been.called;
        })
        ;
    });
  });

  describe( 'POST /', function () {
    describe( 'when not a god', function () {
      it( 'should return 403', function () {
        return this.server.post( this.endpoint() )
          .send( this.adjudicators[0] )
          .expect( 403 )
          ;
      });
    });

    describe( 'when a god', function () {
      beforeEach( function () {
        this.mockUser.is_god = 1;
      });

      it( 'should call Adjudicators.create', function () {
        return this.server.post( this.endpoint() )
          .send( this.adjudicators[0] )
          .expect( 200 )
          .then( () => {
            expect( this.MockAdjudicators.create ).to.have.been.calledWith( this.adjudicators[0] );
          })
          ;
      });
    });
  });

  describe( 'GET /:id', function () {
    it( 'should call Adjudicators.one(id)', function () {
      const id = '1';

      return this.server.get( this.endpoint( `/${id}` ) )
        .expect( 200 )
        .then( () => {
          expect( this.MockAdjudicators.one ).to.have.been.calledWith( id );
        })
        ;
    });
  });

  describe( 'DELETE /:id', function () {
    describe( 'when not a god', function () {
      it( 'should return 403', function () {
        return this.server.delete( this.endpoint( `/1` ) )
          .send( this.adjudicators[0] )
          .expect( 403 )
          ;
      });
    });

    describe( 'when a god', function () {
      beforeEach( function () {
        this.mockUser.is_god = 1;
      });

      it( 'should call Adjudicators.delete(id)', function () {
        const id = '1';

        return this.server.delete( this.endpoint( `/${id}` ) )
          .expect( 200 )
          .then( () => {
            expect( this.MockAdjudicators.delete ).to.have.been.calledWith( id );
          })
          ;
      });
    });
  });

  describe( 'PUT /:id', function () {
    describe( 'when not a god', function () {
      it( 'should return 403', function () {
        return this.server.put( this.endpoint( '/1' ) )
          .send( this.adjudicators[0] )
          .expect( 403 )
          ;
      });
    });

    describe( 'when a god', function () {
      beforeEach( function () {
        this.mockUser.is_god = 1;
      });

      it( 'should call Adjudicators.update', function () {
        const id = '1';

        return this.server.put( this.endpoint( `/${id}` ) )
          .send( this.adjudicators[0] )
          .expect( 200 )
          .then( () => {
            expect( this.MockAdjudicators.update ).to.have.been.calledWith( id, this.adjudicators[0] );
          })
          ;
      });
    });
  });

});

