// # Leads

import { Factory } from 'administer';
import util from './utilities';
import Database from './database';
import Configuration from './configuration';
import Email from './email';
import _ from 'highland';

const Leads = Factory( 'Leads', {
  _db: Database,
  _email: Email,
  _config: Configuration,
})
.methods({
  create ( props ) {
    var person;
    props.id = util.helper.generateId();

    var query = [
      'MERGE (acct:Person { email: { email } })',
      'SET',
      '  acct.lead_name = { name },',
      '  acct.id = { id },',
      '  acct.from_lead = 1,',
      '  acct.lead_at = timestamp()',
      'RETURN acct as node',
    ];

    // To handle a few consecutive operations, we create a pipeline.
    var pipeline = _.pipeline(
      _.flatMap( person => {
        return this._db.queryOne( query, person );
      }),

      _.flatMap( account => {
        person = account;
        return this._email.send( 'lead-acquisition', 'New iFeis Lead', props )
          .to( this._config.email.contact_address );
      }),

      _.map( res => {
        return person;
      })
    );

    // Let's pass the config into the pipeline and return the result.
    return _([ props ]).pipe( pipeline ).head();
  },
})
;

export default Leads;

