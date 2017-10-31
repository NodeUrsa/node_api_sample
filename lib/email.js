// # Email

import { Factory } from 'administer';
import SimpleEmailService from '../vendor/aws/ses';
import Configuration from './configuration';
import util from './utilities';
import _ from 'highland';
import path from 'path';

// The `Email` service is responsible for - wait for it - sending email. It connects to AWS and
// sends email through SES based on HTML and text templates.
const Email = Factory( 'Email', { _ses: SimpleEmailService, _config: Configuration } )
.init( ({ instance }) => {
    // This is where the templates are located.
    var TPL_DIR = path.join( __dirname, '..', 'templates' );

    // We convert the standard email callback into a stream-based response. We wrap it in a function
    // as well in order to preserve `this` binding.
    instance._email = _.wrapCallback(( ...args ) => {
      return instance._ses.sendEmail( ...args );
    });

    // We store all the templates in an exportable variable for unit testing.
    instance._templates = {};

    // From the configuration, we get the email address from which we're supposed to send mail.
    instance._fromAddress = instance._config.email.from_address;

    var options = {
      interpolate: /\{\{=(.+?)\}\}/g
    };

    // Each template is then loaded synchronously so we have to do it but once. Upon load, the
    // template is processed as a [`doT`](http://olado.github.io/doT/) template and the function
    // cached for later use.
    [ 'welcome', 'feis-invite', 'feis-invite-new', 'lead-acquisition' ].forEach( ( file ) => {
      instance._templates[ file ] = {
        html: util.template.fromFile( path.join( TPL_DIR, `${file}.tpl.html` ) )( options ),
        text: util.template.fromFile( path.join( TPL_DIR, `${file}.tpl.text` ) )( options )
      };
    });
})
.methods({

  // For convenience, we define a simple method for using the template functions by name, and export
  // it for unit testing.
  _tpl ( name, data ) {
    data = data || {};
    data.$base_url = this._config.base_url;

    return {
      html: this._templates[ name ].html( data ),
      text: this._templates[ name ].text( data )
    };
  },

  // ## Email::send
  //
  // The `send` method is the public interface of this service. It uses a simple DSL to define what
  // to do:
  //
  //   email.send( 'welcome', account ).to( account.email );
  //
  // The template must be one of the templates loaded above, but the subject is completely
  // arbitrary. The data passed to the method will be used to populate the template and the `to`
  // email address should be self-explanatory.
  send ( tplName, subject, data ) {
    var email = this._tpl( tplName, data );

    return {
      to: ( to_address ) => {
        return this._email({
          Destination: {
            ToAddresses: [ to_address ]
          },
          Message: {
            Body: {
              Html: {
                Data: email.html
              },
              Text: {
                Data: email.text
              }
            },
            Subject: {
              Data: subject
            }
          },
          Source: this._fromAddress
        });
      }
    };
  },
})
;

export default Email;

