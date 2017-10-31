// # RegistrationsRoutes
import express from 'express';

import Registrations from '../../../lib/registrations';

function RegistrationsRoutes ( registrations ) {
  const router = express.Router();

  // Return all registrations for a person-feis combination
  router.get( '/:fid/registrations/:person', ( req, res ) => {
    res.send( registrations.feis( req.params.fid ).person( req.params.person ).all() );
  });

  // Create a new registration for a person-feis combination
  router.post( '/:fid/registrations/:person', ( req, res ) => {
    res.send( registrations.feis( req.params.fid ).person( req.params.person ).create( req.body.event_id ) );
  });

  // Change the competitor number for a person
  router.put( '/:fid/registrations/:person', ( req, res ) => {
    res.send( registrations.feis( req.params.fid ).person( req.params.person ).changeNum( req.body.num ) );
  });

  // Delete a single registration
  router.delete( '/:fid/registrations/:person/:event', ( req, res ) => {
    res.send( registrations.feis( req.params.fid ).person( req.params.person ).delete( req.params.event ) );
  });

  return router;
};

RegistrationsRoutes.$inject = [
  Registrations,
];

export default RegistrationsRoutes;

