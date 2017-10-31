import Administer from 'administer';
import { getServer, sinon } from '../../util/test-helpers';
import LeadRoutes from './leads';
import Leads from '../../lib/leads';

describe( 'LeadRoutes', () => {
  beforeEach( function () {
    this.adm = Administer();
  });

  describe( 'routes', function () {
    var leads;

    beforeEach( function () {
      leads = {
        create: sinon.spy()
      };

      this.adm.provide( Leads, leads );
    });

    describe( 'POST /api/contact', function () {
      var body = { name: 'Test User', message: 'Hello there', email: 'test@gmail.com' };

      it( 'should create a new lead', function () {
        return getServer( this.adm, LeadRoutes )
        .then( s => s.post( '/api/contact' ).send( body ) )
        .then( res => {
          leads.create.called.should.be.true;
          leads.create.calledWith( body ).should.be.true;
        });
      });
    });
  });
});

