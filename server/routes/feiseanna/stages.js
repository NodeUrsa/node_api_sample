// # StagesRoutes
import express from 'express';

import Stages from '../../../lib/stages';

function StagesRoutes ( stages ) {
  const router = express.Router();

  router.get( '/:fid/stages', ( req, res ) => {
    res.send( stages.all( req.params.fid ) );
  });

  router.post( '/:fid/stages', ( req, res ) => {
    res.send( stages.create( req.params.fid, req.body ) );
  });

  router.get( '/:fid/stages/events', ( req, res ) => {
    res.send( stages.events( req.params.fid ) );
  });

  router.get( '/:fid/stages/:stage_id', ( req, res ) => {
    res.send( stages.one( req.params.fid, req.params.stage_id ) );
  });

  router.put( '/:fid/stages/:stage_id', ( req, res ) => {
    res.send( stages.update( req.params.fid, req.params.stage_id, req.body ) );
  });

  router.delete( '/:fid/stages/:stage_id', ( req, res ) => {
    res.send( stages.remove( req.params.fid, req.params.stage_id ) );
  });

  router.get( '/:fid/stages/:stage_id/schedule', ( req, res ) => {
    res.send( stages.schedule( req.params.fid, req.params.stage_id ) );
  });

  router.post( '/:fid/stages/:stage_id/attach-event', ( req, res ) => {
    res.send( stages.attachEvent(
      req.params.fid,
      req.params.stage_id,
      req.body.before_id,
      req.body.event_id,
      req.body.after_id
    ));
  });

  router.post( '/:fid/stages/:stage_id/attach-placeholder', ( req, res ) => {
    res.send( stages.attachPlaceholder(
      req.params.fid,
      req.params.stage_id,
      req.body.before_id,
      req.body.after_id
    ));
  });

  router.delete( '/:fid/stages/:stage_id/detach-event/:item_id', ( req, res ) => {
    res.send( stages.detachEvent(
      req.params.fid,
      req.params.stage_id,
      req.params.item_id
    ));
  });

  router.delete( '/:fid/stages/:stage_id/detach-placeholder/:item_id', ( req, res ) => {
    res.send( stages.detachPlaceholder(
      req.params.fid,
      req.params.stage_id,
      req.params.item_id
    ));
  });

  return router;
}

StagesRoutes.$inject = [
  Stages,
];

export default StagesRoutes;

