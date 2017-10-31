import Administer from 'administer';
import { expect } from '../util/test-helpers';
import Configuration from './configuration'

describe( 'Configuration', () => {
  beforeEach( function () {
    this.adm = Administer();
  });

  it( 'should use default values', function () {
    return expect( this.adm.get( Configuration ) ).to.eventually.have.deep.property( 'server.port', 8000 );
  });

  it( 'should use custom values when the env var is set', function () {
    var env_val = 'hello';
    process.env[ 'IFEIS_PORT' ] = env_val;
    process.env[ 'IFEIS_HOSTNAME' ] = env_val;

    return this.adm.get( Configuration ).then( config => {
      config.server.host.should.equal( env_val );
      config.server.port.should.equal( env_val );

      delete process.env[ 'IFEIS_PORT' ];
      delete process.env[ 'IFEIS_HOSTNAME' ];
    });
  });

  it( 'should house a reference to the package definition' , function () {
    return expect( this.adm.get( Configuration ) ).to.eventually.have.deep.property( 'pkg.name', 'ifeis-api' );
  });

});

