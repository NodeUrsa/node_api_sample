import Administer from 'administer';
import { sinon } from '../util/test-helpers.js'
import Email from './email'
import SimpleEmailService from '../vendor/aws/ses'
import util from './utilities'

describe( 'Email', () => {
  var email, ses, account, adm;

  var SESMock = {
    sendEmail: function ( config, cb ) { cb( null, config ); }
  };
  sinon.spy( SESMock, 'sendEmail' );

  beforeEach( () => {
    adm = Administer();
    adm.provide( SimpleEmailService, SESMock );
    SESMock.sendEmail.reset();

    account = {
      fname: 'Joe',
      lname: 'Test',
      email: 'joe@test.com',
      id: 12345
    };

    return adm.get([ SimpleEmailService, Email]).then( ([ s, e ]) => {
      email = e;
      ses = s;
    });
  });

  it( 'should have templates defined', () => {
    ( email._templates === undefined ).should.not.be.ok;
    email._templates.should.have.property( 'welcome' );
  });

  it( 'should return template string', () => {
    var res = email._tpl( 'welcome', { fname: 'Joe' } );

    res.should.have.properties( 'html', 'text' );
    res.text.should.not.be.empty;
    res.html.should.not.be.empty;
  });

  it( 'should call the AWS SDK to send an email', ( done ) => {
    var s = email.send( 'welcome', 'subject', account ).to( account.email );

    util.types.isStream( s ).should.be.ok;

    s.apply( ( config ) => {
      ses.sendEmail.called.should.be.ok;

      config.should.have.propertyByPath( 'Destination', 'ToAddresses' ).and.containEql( account.email );
      config.should.have.propertyByPath( 'Message', 'Body', 'Html', 'Data' );
      config.should.have.propertyByPath( 'Message', 'Body', 'Text', 'Data' );
      config.should.have.propertyByPath( 'Message', 'Subject', 'Data' ).and.equal( 'subject' );
      done();
    });
  });
});

