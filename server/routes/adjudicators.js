// # AdjudicatorRoutes
import express from 'express';

import Server from '../index';
import Adjudicators from '../../lib/adjudicators';
import isGod from '../ext/is-god';

function AdjudicatorsRoutes ( adjudicators ) {
  // ## Routes
  const router = express.Router();

  router.get( '/', ( req, res ) => {
    res.send( adjudicators.get() );
  });

  router.post( '/', isGod, ( req, res ) => {
    res.send( adjudicators.create( req.body ) );
  });

  router.get( '/:id', ( req, res ) => {
    res.send( adjudicators.one( req.params.id ) );
  });

  router.put( '/:id', isGod, ( req, res ) => {
    res.send( adjudicators.update( req.params.id, req.body ) );
  });

  router.delete( '/:id', isGod, ( req, res ) => {
    res.send( adjudicators.delete( req.params.id ) );
  });

  return router;
}

AdjudicatorsRoutes.$inject = [
  Adjudicators,
];

export default AdjudicatorsRoutes;

