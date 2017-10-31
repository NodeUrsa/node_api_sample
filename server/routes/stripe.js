// # StripeRoutes

import express from 'express';

import Server from '../index';
import Accounts from '../../lib/accounts';
import Configuration from '../../lib/configuration';
import qs from 'querystring';
import request from 'request';
import isLoggedIn from '../ext/is-logged-in';
import FeisAuthChecks from '../ext/auth/feiseanna';

function StripeRoutes ( accts, config, feisAuthChecks ) {
  // ## Routes

  const router = express.Router();

  let { isChair, isWritable } = feisAuthChecks.middleware;

  // ### Payment configuration
  //

  router.get( '/authorize/:fid', isWritable(), isChair(), ( req, res ) => {
    const query = qs.stringify({
      response_type: 'code',
      scope: 'read_write',
      client_id: config.stripe.client_id,
      'stripe_user[email]': req.user.email,
      'stripe_user[first_name]': req.user.fname,
      'stripe_user[last_name]': req.user.lname,
      state: req.params.fid,
      redirect_uri: `${config.base_url}/api/stripe/callback`,
    });
    const stripeAuthorizeUri = `https://connect.stripe.com/oauth/authorize?${query}`;
    res.redirect( stripeAuthorizeUri );
  });

  router.get( '/callback', ( req, res ) => {
    const stripeTokenUri = 'https://connect.stripe.com/oauth/token';
    const done = () => res.redirect( '/login/redirect' );
    const fid = req.query.state;
    const aid = req.user.id;

    if ( req.query.error ) {
      console.log( `Stripe Callback Error: ${req.query.error}. ${req.query.error_description}` )
      done();
    }

    request.post({
      url: stripeTokenUri,
      form: {
        grant_type: 'authorization_code',
        client_id: config.stripe.client_id,
        code: req.query.code,
        client_secret: config.stripe.secret_key,
      },
    }, ( err, req, body ) => {
      const response = JSON.parse( body );

      if ( response.error ) {
        console.log( `Error from Stripe: ${response.error}. ${response.error_description}` );
        done();
      } else {
        accts.connectStripe( aid, fid, response.access_token )
          .stopOnError( err => {
            console.log( err );
            console.log( err.stack );
          })
          .apply( done );
      }
    });
  });

  return router;
}
StripeRoutes.$inject = [
  Accounts,
  Configuration,
  FeisAuthChecks,
];

export default StripeRoutes;

