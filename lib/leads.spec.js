import Administer from 'administer';
import {expect,emptyGraph,queryGraph,sinon} from '../util/test-helpers.js';
import {mockOutEmail} from '../util/mocks/index';
import Email from './email';
import Leads from './leads';
import util from './utilities';
import Auth2 from './auth';

describe( 'Leads', () => {
  var leads, email;

  beforeEach( function () {
    this.adm = Administer();
    mockOutEmail( this.adm );

    return this.adm.get([ Leads, Email ]).then( ([ l, e ]) => {
      leads = l;
      email = e;
    });
  });

  describe( '#create()', () => {
    var person = {
      email: 'new@test.com',
      name: 'New Lead',
      message: 'Hello, there!',
    };

    it( 'should create a new lead and send an email to ifeis', ( done ) => {
      leads.create( person )
        .apply( lead => {
          expect( lead ).to.be.defined;
          expect( email.send.calledWith( 'lead-acquisition' ) ).to.be.ok;
          expect( lead.lead_name ).to.equal( person.name );
          expect( lead.email ).to.equal( person.email );
          expect( lead.id ).to.be.defined;
          done();
        });
    });
  });
});

