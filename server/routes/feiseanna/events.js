// # EventsRoutes
import express from 'express';

import Events from '../../../lib/events';
import Scores from '../../../lib/scores';
import FeisAuthChecks from '../../ext/auth/feiseanna';

function EventsRoutes ( events, scores, auth ) {
  const router = express.Router();

  let {
    isReadable,
    isWritable,
    hasRole,
  } = auth.middleware;

  // Get all events for a feis.
  router.get( '/:fid/events', ( req, res ) => {
    res.send( events.for( req.params.fid ).query( req.query ) );
  });

  // Create a new event
  router.post( '/:fid/events', ( req, res ) => {
    res.send( events.for( req.params.fid ).create( req.body ) );
  });

  // Return a single event
  router.get( '/:fid/events/:event_id', ( req, res ) => {
    res.send( events.for( req.params.fid ).one( req.params.event_id ) );
  });

  // Update a single event
  router.put( '/:fid/events/:event_id', ( req, res ) => {
    res.send( events.for( req.params.fid ).update( req.params.event_id, req.body ) );
  });

  // Delete a single event
  router.delete( '/:fid/events/:event_id', ( req, res ) => {
    res.send( events.for( req.params.fid ).delete( req.params.event_id ) );
  });

  // Return a single event's participants
  router.get( '/:fid/events/:event_id/participants', isReadable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).participants( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/open', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).openCheckIn( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/close', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).closeCheckIn( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/checkin', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).checkInToTabs( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/reset', isWritable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( events.for( req.params.fid ).reset( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/send-to-qa', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).sendToQa( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/send-to-results', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).sendToResults( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/set-announced', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).setAnnounced( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/recalls-printed', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).setRecallsPrinted( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/placements-printed', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).setPlacementsPrinted( req.params.event_id ) );
  });

  router.post( '/:fid/events/:event_id/order-participants', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).orderParticipants( req.params.event_id, req.body ) );
  });

  router.put( '/:fid/events/:eid/participants/:pid', isWritable(), ( req, res ) => {
    res.send( events.for( req.params.fid ).updateRegistration( req.params.eid, req.params.pid, req.body ) );
  });

  router.post( '/:fid/events/:eid/participants/:pid/checkin', ( req, res ) => {
    res.send( events.for( req.params.fid ).checkin( req.params.eid, req.params.pid ) );
  });

  router.post( '/:fid/events/:eid/participants/:pid/checkout', ( req, res ) => {
    res.send( events.for( req.params.fid ).checkout( req.params.eid, req.params.pid ) );
  });

  router.get( '/:fid/events/:eid/adjudicators', ( req, res ) => {
    res.send( scores.for( req.params.fid ).event( req.params.eid ).adjudicators() );
  });

  router.get( '/:fid/events/:eid/scores/:aid', ( req, res ) => {
    res.send( scores.for( req.params.fid ).event( req.params.eid ).adjudicator( req.params.aid ).all() );
  });

  router.delete( '/:fid/events/:eid/scores/:aid', ( req, res ) => {
    res.send( scores.for( req.params.fid ).event( req.params.eid ).adjudicator( req.params.aid ).delete() );
  });

  router.post( '/:fid/events/:eid/scores/:aid/:pid', ( req, res ) => {
    res.send(
      scores.for( req.params.fid ).event( req.params.eid ).adjudicator( req.params.aid )
        .create( req.params.pid, req.body )
    );
  });

  router.delete( '/:fid/events/:eid/scores/:aid/:sid', ( req, res ) => {
    res.send(
      scores.for( req.params.fid ).event( req.params.eid ).adjudicator( req.params.aid )
        .delete( req.params.sid )
    );
  });

  router.put( '/:fid/events/:eid/scores/:aid/:sid', ( req, res ) => {
    res.send(
      scores.for( req.params.fid ).event( req.params.eid ).adjudicator( req.params.aid )
        .update( req.params.sid, req.body )
    );
  });

  // Split an event into two
  router.post( '/:fid/events/:event_id/split', ( req, res ) => {
    res.send( events.for( req.params.fid ).split(
      req.params.event_id,
      req.body.props1,
      req.body.persons1,
      req.body.props2,
      req.body.persons2
    ));
  });

  // Merge two events
  router.post( '/:fid/events/:eid/merge/:mid', ( req, res ) => {
    res.send( events.for( req.params.fid ).merge( req.params.eid, req.params.mid, req.body ) );
  });

  // Placements
  router.get( '/:fid/events/:eid/placements', ( req, res ) => {
    res.send( scores.for( req.params.fid ).event( req.params.eid ).placements() );
  });

  router.post( '/:fid/events/:eid/placements/cache', ( req, res ) => {
    res.send( scores.for( req.params.fid ).event( req.params.eid ).cachePlacements() );
  });

  router.post( '/:fid/events/:eid/placements/:pid/collect-award', ( req, res ) => {
    res.send( events.for( req.params.fid ).collectAward( req.params.eid, req.params.pid ) );
  });

  router.post( '/:fid/events/:eid/placements/:pid/return-award', ( req, res ) => {
    res.send( events.for( req.params.fid ).returnAward( req.params.eid, req.params.pid ) );
  });

  return router;
};

EventsRoutes.$inject = [
  Events,
  Scores,
  FeisAuthChecks,
];

export default EventsRoutes;
