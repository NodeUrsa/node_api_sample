// # ContactRoutes
import express from 'express';

import Contacts from '../../../lib/contacts';

function ContactsRoutes ( contacts ) {
  const router = express.Router();

  // ## Routes

  router.get( '/:fid/contacts', ( req, res ) => {
    res.send( contacts.for( req.params.fid ).all() );
  });

  router.post( '/:fid/contacts', ( req, res ) => {
    res.send( contacts.for( req.params.fid ).create( req.body ) );
  });

  router.put( '/:fid/contacts/:id', ( req, res ) => {
    res.send( contacts.for( req.params.fid ).update( req.params.id, req.body ) );
  });

  router.delete( '/:fid/contacts/:id', ( req, res ) => {
    res.send( contacts.for( req.params.fid ).delete( req.params.id ) );
  });

  return router;
}
ContactsRoutes.$inject = [
  Contacts,
];

export default ContactsRoutes;

