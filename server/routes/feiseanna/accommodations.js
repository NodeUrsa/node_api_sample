// # AccommodationRoutes
import express from 'express';

import Accommodations from '../../../lib/accommodations';

function AccommodationsRoutes ( accommodations ) {
  const router = express.Router();

  // ## Routes

  router.get( '/:fid/accommodations', ( req, res ) => {
    res.send( accommodations.for( req.params.fid ).all() );
  });

  router.post( '/:fid/accommodations', ( req, res ) => {
    res.send( accommodations.for( req.params.fid ).create( req.body ) );
  });

  router.put( '/:fid/accommodations/:id', ( req, res ) => {
    res.send( accommodations.for( req.params.fid ).update( req.params.id, req.body ) );
  });

  router.delete( '/:fid/accommodations/:id', ( req, res ) => {
    res.send( accommodations.for( req.params.fid ).delete( req.params.id ) );
  });

  return router;
}
AccommodationsRoutes.$inject = [
  Accommodations,
];

export default AccommodationsRoutes;

