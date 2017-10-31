// # AccountRoutes

import express from 'express';

import Server from '../index';
import Auth2 from '../../lib/auth';
import Accounts from '../../lib/accounts';
import Configuration from '../../lib/configuration';
import Payments from '../../lib/payments';
import Feiseanna from '../../lib/feiseanna';
import qs from 'querystring';
import request from 'request';
import isLoggedIn from '../ext/is-logged-in';
import FeisAuthChecks from '../ext/auth/feiseanna';

function AccountRoutes ( accts, auth2, config, payments, feisAuthChecks, feiseanna ) {
  // ## Routes

  const router = express.Router();

  // We define a nice alias to return the current user information.
  router.get( '/me', isLoggedIn, ( req, res ) => {
    res.send( accts.getOne( req.user.id ) );
  });

  // Update the current user information
  router.put( '/me', isLoggedIn, ( req, res ) => {
    res.send( accts.update( req.user.id, req.body ) );
  });

  // Return the current user's dependents.
  router.get( '/me/dependents', isLoggedIn, ( req, res ) => {
    res.send( accts.getDependents( req.user.id ) );
  });

  // Create a dependents.
  router.post( '/me/dependents', isLoggedIn, ( req, res ) => {
    var school = req.body.school;
    delete req.body.school;

    res.send( accts.createDependent( req.user.id, school, req.body ) );
  });

  router.put( '/me/dependents/:person_id', isLoggedIn, ( req, res ) => {
    var school = req.body.school;
    delete req.body.school;

    res.send( accts.updateDependent( req.user.id, school, req.body ) );
  });
  
  // ### Persons
  //
  // Get an account from a person
  router.get( '/for-person/:pid', ( req, res ) => {
    res.send( accts.getFromPerson( req.params.pid ) );
  });

  // Accounts are fetchable by ID if the user has permission to do so (see above).
  router.get( '/:id', ( req, res ) => {
    res.send( accts.getOne( req.params.id ) );
  });

  // Return the current user's dependents.
  router.get( '/:id/dependents', isLoggedIn, ( req, res ) => {
    res.send( accts.getDependents( req.params.id ) );
  });

  // ### Payment configuration
  //

  router.get( '/api/stripe/authorize/:fid', ( req, res ) => {
    const query = qs.stringify({
      response_type: 'code',
      scope: 'read_write',
      client_id: config.stripe.client_id,
      'stripe_user[email]': req.user.email,
      'stripe_user[first_name]': req.user.fname,
      'stripe_user[last_name]': req.user.lname,
      state: req.params.fid,
    });
    const stripeAuthorizeUri = `https://connect.stripe.com/oauth/authorize?$:query`;
    res.redirect( stripeAuthorizeUri );
  });

  router.get( '/api/stripe/callback', ( req, res ) => {
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

  // # Payments for Accounts
  //

  router.get( '/:aid/payments', isLoggedIn, ( req, res ) => {
    res.send( payments.forAccount( req.params.aid ).recent() );
  });

  router.get( '/:aid/payments-due', isLoggedIn, ( req, res ) => {
    res.send( payments.forAccount( req.params.aid ).due() );
  });


  // # Feiseanna
  //

  router.get( '/:aid/feiseanna', isLoggedIn, ( req, res ) => {
    res.send( feiseanna.forUser( req.user.id ) );
  });

  router.post( '/:aid/feiseanna', isLoggedIn, feisAuthChecks.middleware.isReadable(), ( req, res ) => {
    res.send( feiseanna.star( req.body.id, req.user.id ) );
  });

  router.delete( '/:aid/feiseanna/:fid', isLoggedIn, ( req, res ) => {
    res.send( feiseanna.unstar( req.params.fid, req.user.id ) );
  });

  return router;
}
AccountRoutes.$inject = [
  Accounts,
  Auth2,
  Configuration,
  Payments,
  FeisAuthChecks,
  Feiseanna,
];

export default AccountRoutes;

