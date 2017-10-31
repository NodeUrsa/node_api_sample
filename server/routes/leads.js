// # LeadRoutes
import express from 'express';

import Server from '../index';
import Leads from '../../lib/leads';

function LeadsRoutes ( leads ) {
  // ## Routes
  const router = express.Router();

  router.post( '/', ( req, res ) => {
    let person = JSON.parse( JSON.stringify( req.body ) );
    res.send( leads.create( person ) );
  });

  return router;
}

LeadsRoutes.$inject = [
  Leads,
];

export default LeadsRoutes;

