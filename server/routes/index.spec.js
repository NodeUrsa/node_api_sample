import Administer from 'administer';
import { expect, getServer } from '../../util/test-helpers';
import { RootRoutes } from './index';

describe( 'RootRoutes', () => {
  describe( 'GET /api', () => {
    it( 'should return the authentication status when not logged in', () => {
      const adm = Administer();
      return getServer( adm, RootRoutes )
      .then( s => s.get( '/api' ) )
      .then( res => {
        expect( res.body ).to.have.deep.property( 'data.authenticated', false );
      });
    });

    it( 'should return the authentication status when logged in', () => {
      const adm = Administer();
      return getServer( adm, RootRoutes, { user: { id: '1' } } )
      .then( s => s.get( '/api' ) )
      .then( res => {
        expect( res.body ).to.have.deep.property( 'data.authenticated', true );
      });
    });
  });
});

