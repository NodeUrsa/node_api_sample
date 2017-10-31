// # SchoolRoutes
import express from 'express';

import Server from '../index';
import Schools from '../../lib/schools';
import isGod from '../ext/is-god';

function SchoolsRoutes ( schools ) {
  // ## Routes
  const router = express.Router();

  router.get( '/', ( req, res ) => {
    res.send( schools.get() );
  });

  router.post( '/', isGod, ( req, res ) => {
    res.send( schools.create( req.body ) );
  });

  router.put( '/:id', isGod, ( req, res ) => {
    res.send( schools.update( req.params.id, req.body ) );
  });

  router.delete( '/:id', isGod, ( req, res ) => {
    res.send( schools.delete( req.params.id ) );
  });

  return router;
}

SchoolsRoutes.$inject = [
  Schools,
];

export default SchoolsRoutes;

