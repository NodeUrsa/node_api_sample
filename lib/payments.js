// # Payments

import { Factory } from 'administer';
import Database from './database';
import Configuration from './configuration';
import { BadRequestObject } from '../server/ext/errors';
import util from './utilities';
import _ from 'highland';
import stripe from 'stripe';

const PaymentsForFeisAccount = Factory( 'PaymentsForFeisAccount' )
.methods({
  get () {},

  debits () {
    var query = [
      'MATCH (acct:Account {id:{aid}})-[reg:SAVED]->(feis:Feis {id:{fid}})',
      'OPTIONAL MATCH feis<-[:TO]-(payment:Payment)-[:FROM]->acct',
      'WITH feis, acct, min(payment.created_at) as firstPaymentDate, reg, sum( payment.amt ) as credits',
      'OPTIONAL MATCH acct<-[:DEPENDENT_OF*0..1]-(person:Person)-[:PARTICIPANT]->(event:Event)-[:OF]->feis',
      'WHERE event.inactive IS NULL or event.inactive <> 1',
      'RETURN',
      '  feis',
      ', reg',
      ', firstPaymentDate',
      ', credits',
      ', person',
      ', event',
      ', CASE WHEN event.fee IS NOT NULL THEN event.fee WHEN feis.event_fee IS NOT NULL THEN feis.event_fee ELSE 0.00 END AS fee'
    ];

    return this._db.queryMultiple( query, { fid: this.fid, aid: this.aid } )
      .collect()
      .map( res => {
        const fees = [];

        const { feis, firstPaymentDate , credits } = res[ 0 ];
        const hasPaid = credits > 0;
        let lateFeePaid = false;
        let lateFeeDue = false;
        if (hasPaid) {
          lateFeePaid = feis.dt_reg_late < firstPaymentDate;
        } else {
          const isAfterLateReg = feis.dt_reg_late && feis.dt_reg_late < Date.now();
          lateFeeDue = isAfterLateReg && feis.late_fee;
        }

        if ( lateFeePaid ||  lateFeeDue) {
          fees.push({
            type: 'LATE_REG',
            description: 'Late Fee',
            amt: feis.late_fee,
          });
        }

        if ( feis.acct_fee ) {
          fees.push({
            type: 'ACCT_FEE',
            description: 'Family Fee',
            amt: feis.acct_fee,
          });
        }

        return fees.concat( res.filter( r => r.event ).map( r => ({
          type: 'REG',
          description: r.event.$name,
          event: r.event.id,
          person: r.person.id,
          amt: r.fee,
        })));
      })
      .flatten()
      ;
  },

  credits () {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:TO]-(payment:Payment)-[:FROM]->(acct:Account {id:{aid}})',
      'RETURN payment as node'
    ];

    return this._db.query( query, { fid: this.fid, aid: this.aid } );
  },

  _credit ( payment ) {
    payment.id = payment.id || util.helper.generateId();

    var query = [
      'MATCH (feis:Feis {id:{fid}}), (acct:Account {id:{aid}})',
      'CREATE feis<-[:TO]-(payment:Payment {payment})-[:FROM]->acct',
      'SET payment.created_at = timestamp()',
      'RETURN payment as node'
    ];

    return this._db.queryOne( query, { fid: this.fid, aid: this.aid, payment } );
  },

  credit ( amt, description = null ) {
    return this._credit({ amt, description, ifeis_fee: 0, medium: 'offline', paid: 1, currency: 'usd' });
  },

  creditFromStripe ( amount, source ) {
    return this._stripe.charge( this.fid, this.aid, amount, source )
    .flatMap( charge => {
      return this._credit( charge );
    });
  },
})
;

const PaymentsForAccount = Factory( 'PaymentsForAccount' )
.methods({
  forFeis ( id ) {
    return PaymentsForFeisAccount({
      _db: this._db,
      _stripe: this._stripe,
      aid: this.aid,
      fid: id,
    });
  },

  // return all outstanding balances
  due () {
    const query = [
      'MATCH (acct:Account {id:{aid}})-[reg:SAVED]->(feis:Feis)', 
      ', acct<-[:DEPENDENT_OF*0..1]-(person:Person)-[:PARTICIPANT]->(event:Event)-[:OF]->feis', 
      'WHERE event.inactive IS NULL or event.inactive <> 1',
      'WITH',
      '  acct',
      ', feis',
      ', reg',
      ', event',
      ', CASE WHEN event.fee IS NOT NULL THEN event.fee WHEN feis.event_fee IS NOT NULL THEN feis.event_fee ELSE 0.00 END as fee',
      'WITH',
      '  acct',
      ', feis',
      ', CASE WHEN feis.acct_fee IS NOT NULL THEN feis.acct_fee ELSE 0 END as acct_fee',
      ', sum( CASE WHEN event.exclude_from_max = 1 THEN fee ELSE 0.00 END ) as no_max_debits',
      ', sum( CASE WHEN event.exclude_from_max IS NULL OR event.exclude_from_max = 0 THEN fee ELSE 0.00 END ) as max_debits',
      'WITH',
      '  acct',
      ', feis',
      ', sum( no_max_debits + acct_fee ) as no_max_debits',
      ', sum( max_debits ) as max_debits',
      'OPTIONAL MATCH feis<-[:TO]-(payment:Payment)-[:FROM]->acct',
      'WITH feis, sum( payment.amt ) as credits, no_max_debits, max_debits',
      'WITH feis, credits, CASE WHEN max_debits > feis.acct_max THEN feis.acct_max ELSE max_debits END as max_debits, no_max_debits',
      'WITH feis, credits, max_debits + no_max_debits AS debits, ((max_debits + no_max_debits) - credits) as balance, max_debits, no_max_debits',
      'WHERE balance > 0',
      'RETURN feis, credits, balance, max_debits, no_max_debits',
    ];

    return this._db.queryMultiple( query, { aid: this.aid } )
      .map( bal => {
        const { feis, credits } = bal;
        const hasPaid = credits > 0;
        const isAfterLateReg = feis.dt_reg_late && feis.dt_reg_late < Date.now();

        if ( ! hasPaid && isAfterLateReg && feis.late_fee ) {
          bal.no_max_debits_debits = bal.no_max_debits + feis.late_fee;
          bal.balance = bal.balance + feis.late_fee;
        }

        return bal;
      });
  },

  recent () {
    const query = [
      'MATCH (feis:Feis)<-[:TO]-(payment:Payment)-[:FROM]->(acct:Account {id:{aid}})',
      'RETURN feis, payment',
      'ORDER BY payment.created_at DESC',
    ];

    return this._db.queryMultiple( query, { aid: this.aid } )
      .map( res => {
        const payment = res.payment;
        payment.feis = res.feis;

        return payment;
      })
      ;
  }
})
;

const Stripe = Factory( 'Stripe', {
  _db: Database,
})
.refs({
  getStripeQuery: [
    'MATCH (feis:Feis {id:{fid}})-[:PAYEE]->(stripe:StripeAccount), (acct:Account {id:{aid}})',
    ', feis-[:FROM]-(invite:FeisInvite)',
    'OPTIONAL MATCH acct<-[:FROM]-(pmt:Payment)-[:TO]-feis',
    'RETURN feis, invite.fee as fee, stripe.token as token, acct, sum(pmt.ifeis_fee) as fees_paid',
  ]
})
.methods({
  charge ( fid, aid, amount, source ) {
    const charge = {
      amount: amount * 100, // stripe requires amounts in cents
      source,
      currency: 'usd',
    };

    return _( ( push, next ) => {
      this._db.queryMultiple( this.getStripeQuery, { fid, aid } )
      .apply( args => {
        if ( ! args || ! args.token ) {
          return push( BadRequestObject( 'This feis cannot accept payments yet.' ) );
        }

        let { token, acct, feis, fee, fees_paid } = args;

        charge.statement_descriptor = `iFeis: ${feis.name}`.substr( 0, 22 );
        charge.description = `[${feis.name}] ${acct.fname} ${acct.lname}`;
        charge.receipt_email = acct.email;
        charge.metadata = {
          payment_id: util.helper.generateId(),
          ifeis_account_id: aid,
          email_address: acct.email,
          fname: acct.fname,
          lname: acct.lname,
        };

        // This is the amount due to iFeis, if it has not already been paid.
        if ( fees_paid < fee ) {
          charge.application_fee = Math.min( amount, fee - fees_paid ) * 100; // in cents
        } else {
          charge.application_fee = 0;
        }

        stripe( token ).charges.create( charge, ( err, response ) => {
          if ( err ) {
            push( err );
            push( null, _.nil );
            return;
          }

          const payment = {
            vnd_id: response.id,
            vendor: 'stripe',
            medium: 'cc',
            livemode: response.livemode,
            ifeis_fee: charge.application_fee / 100,
            paid: response.paid ? 1 : 0,
            id: response.metadata.payment_id,
            amt: charge.amount / 100,
            currency: response.currency,
          };

          push( err, payment );
          push( null, _.nil );
        });
      });
    });
  },
})
;

const PaymentsForFeis = Factory( 'PaymentsForFeis' )
.methods({
  summary () {
    var query = [
      'MATCH (feis:Feis {id:{fid}})',
      'OPTIONAL MATCH feis<-[:TO]-(pmt:Payment)',
      'RETURN feis, sum(pmt.ifeis_fee) as total_fees, sum(pmt.amt) as total_charges',
    ];

    return this._db.queryMultiple( query, { fid: this._fid } )
    .map( res => {
      const summary = {};

      return summary;
    })
    ;
  }
})
;

// The `Payments` class is responsible for CRUD operations as it relates to payments.
const Payments = Factory( 'Payments', {
  _db: Database,
  _stripe: Stripe,
})
.methods({
  forAccount ( aid ) {
    return PaymentsForAccount({
      aid,
      _db: this._db,
      _stripe: this._stripe,
    });
  },

  forFeis ( fid ) {
    return PaymentsForFeis({
      fid,
      _db: this._db,
    });
  },
})
;

export { Stripe as Stripe };
export default Payments;

