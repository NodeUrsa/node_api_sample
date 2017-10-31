// # DanceRoutes
import express from 'express';

import Server from '../index';
import Dances from '../../lib/dances';
import isGod from '../ext/is-god';

function DancesRoutes ( dances ) {
  // ## Routes
  const router = express.Router();

  router.get( '/', ( req, res ) => {
    res.send( dances.get() );
  });

  router.post( '/', isGod, ( req, res ) => {
    res.send( dances.create( req.body ) );
  });

  router.put( '/:id', isGod, ( req, res ) => {
    res.send( dances.update( req.params.id, req.body ) );
  });

  router.delete( '/:id', isGod, ( req, res ) => {
    res.send( dances.delete( req.params.id ) );
  });

  return router;
}

DancesRoutes.$inject = [
  Dances,
];

export default DancesRoutes;

