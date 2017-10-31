// # PaymentRoutes
import express from 'express';

import Payments from '../../../lib/payments';
import qs from 'querystring';

function PaymentsRoutes ( payments ) {
  // ## Payments for feiseanna

  const router = express.Router();

  router.get( '/:fid/payments/credits/:aid', ( req, res ) => {
    res.send( payments.forAccount( req.params.aid ).forFeis( req.params.fid ).credits() );
  });

  router.post( '/:fid/payments/credits/:aid', ( req, res ) => {
    if ( req.body.stripe_token ) {
      res.send(
        payments.forAccount( req.params.aid ).forFeis( req.params.fid )
          .creditFromStripe( req.body.amount, req.body.stripe_token )
      );
    } else {
      // FIXME: this requires a separate authentication than the above, which is verified by stripe
      res.send(
        payments.forAccount( req.params.aid ).forFeis( req.params.fid )
          .credit( req.body.amount, req.body.description )
      );
    }
  });

  router.get( '/:fid/payments/debits/:aid', ( req, res ) => {
    res.send( payments.forAccount( req.params.aid ).forFeis( req.params.fid ).debits() );
  });

  return router;
}

PaymentsRoutes.$inject = [
  Payments,
];

export default PaymentsRoutes;

