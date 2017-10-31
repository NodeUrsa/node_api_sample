import express from 'express';

import FeisAuthChecks from '../../ext/auth/feiseanna';
import Feiseanna from '../../../lib/feiseanna';
import isGod from '../../ext/is-god';

function InvitationRoutes ( feiseanna, auth ) {
  // ## Routes
  const router = express.Router();

  let { canSeeInvite } = auth.middleware;

  // ### Invitations
  //
  // Get all invitations.
  router.get( '/', isGod, ( req, res ) => {
    res.send( feiseanna.invitations() );
  });

  // Create an invitation.
  router.post( '/', isGod, ( req, res ) => {
    res.send( feiseanna.createInvitation( req.body ) );
  });

  // Get a specific invitation.
  router.get( '/:iid', canSeeInvite(), ( req, res ) => {
    res.send( feiseanna.invitation( req.params.iid ) );
  });

  // Invalidate a specific invitation.
  router.delete( '/:iid', isGod, ( req, res ) => {
    res.send( feiseanna.invalidateInvitation( req.params.iid ) );
  });

  return router;
}

InvitationRoutes.$inject = [
  Feiseanna,
  FeisAuthChecks,
];

export default InvitationRoutes;

