import express from 'express';
import multipart from 'connect-multiparty';
import uploader from 'express-fileuploader';
import S3Strategy from 'express-fileuploader-s3';

import Configuration from '../../../lib/configuration';
import Feiseanna from '../../../lib/feiseanna';
import Events from '../../../lib/events';
import Attachments from '../../../lib/attachments';
import Auth2 from '../../../lib/auth';
import { NotFound, NotAuthorized, NotAuthenticated, BadRequest, BadImplementation } from '../../ext/errors';
import FeisAuthChecks from '../../ext/auth/feiseanna';
import isLoggedIn from '../../ext/is-logged-in';

import PaymentsRoutes from './payments';
import EventsRoutes from './events';
import RegistrationsRoutes from './registrations';
import StagesRoutes from './stages';
import ContactsRoutes from './contacts';
import AccommodationsRoutes from './accommodations';
import InvitationRoutes from './invitations';

// ## FeiseannaRoutes
export default function FeiseannaRoutes (
  feis,
  invitations,
  events,
  registrations,
  stages,
  contacts,
  payments,
  accommodations
) {
  const router = express.Router();

  router.use ( '/invitations', invitations );
  router.use( feis );
  router.use( events );
  router.use( registrations );
  router.use( stages );
  router.use( contacts );
  router.use( payments );
  router.use( accommodations );

  return router;
}
FeiseannaRoutes.$inject = [
  FeisRoutes,
  InvitationRoutes,
  EventsRoutes,
  RegistrationsRoutes,
  StagesRoutes,
  ContactsRoutes,
  PaymentsRoutes,
  AccommodationsRoutes,
];

function FeisRoutes ( feiseanna, auth2, auth, events, attachments, configuration ) {
  const router = express.Router();
  let {
    isReadable,
    isWritable,
    canUseInvite,
    hasRole,
  } = auth.middleware;

  // Get all public feiseanna that haven't passed.
  router.get( '/', ( req, res ) => {
    res.send( feiseanna.all( req.isAuthenticated() ? req.user.id : null, req.query ) );
  });

  // Create a new feis.
  router.post( '/', isLoggedIn, canUseInvite(), ( req, res ) => {
    req.body.account_id = req.user.id;
    res.send( feiseanna.create( req.body ) );
  });

  // Get all feiseanna for which the user has a connection.
  router.get( '/mine', isLoggedIn, ( req, res ) => {
    res.send( feiseanna.forUser( req.user.id ) );
  });

  // Get all feis templates
  router.get( '/templates', ( req, res ) => {
    res.send( feiseanna.templates() );
  });

  // Get a particular feis.
  router.get( '/:fid', isReadable(), ( req, res ) => {
    res.send( req.$feis );
  });

  // Update a feis. At present, *all* feis fields must be submitted; incremental changing is not
  // supported.
  router.put( '/:fid', isWritable(), ( req, res ) => {
    res.send( feiseanna.update( req.body ) );
  });

  // Finalize a feis
  router.post( '/:fid/finalize', isWritable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( feiseanna.finalize( req.params.fid ) );
  });

  // Publish a feis
  router.post( '/:fid/publish', isWritable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( feiseanna.publish( req.params.fid ) );
  });

  // Unpublish a feis
  router.delete( '/:fid/publish', isWritable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( feiseanna.unpublish( req.params.fid ) );
  });

  // Upload a syllabus
  uploader.use( new S3Strategy({
    uploadPath: 'syllabi',
    headers: {
      'x-amz-acl': 'public-read',
    },
    options: {
      key: configuration.aws.accessKeyId,
      secret: configuration.aws.secretAccessKey,
      bucket: configuration.feisAssetsBucket,
    },
  }));

  router.post( '/:fid/attachments', multipart(), isWritable(), hasRole( 'chair' ), ( req, res ) => {
    const { file } = req.files;
    const name = req.body.name;
    const attachment = { name };

    uploader.upload( 's3', file, ( err, files ) => {
      if ( err ) {
        return res.send( BadImplementation( err.toString() ) );
      }

      attachment.url = files[0].url;
      return res.send( attachments.for( req.params.fid ).create( attachment ) );
    });
  });

  router.get( '/:fid/attachments', isReadable(), ( req, res ) => {
    res.send( attachments.for( req.params.fid ).all() );
  });

  router.put( '/:fid/attachments/:attach_id', isReadable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( attachments.for( req.params.fid ).update( req.params.attach_id, req.body ) );
  });

  router.delete( '/:fid/attachments/:attach_id', isReadable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( attachments.for( req.params.fid ).delete( req.params.attach_id ) );
  });

  // FIXME: auth
  router.get( '/:fid/placements/by-person/:pid', ( req, res ) => {
   res.send( feiseanna.placementsForPerson( req.params.fid, req.params.pid ) );
  });

  router.get( '/:fid/scores/by-person/:pid', ( req, res ) => {
   res.send( feiseanna.scoresForPerson( req.params.fid, req.params.pid ) );
  });

  router.get( '/:fid/participants', isReadable(), hasRole(), ( req, res ) => {
    let offset = req.query.offset ? parseInt( req.query.offset, 10 ) : 0;
    let limit = req.query.limit ? parseInt( req.query.limit, 10 ) : 25;

    res.send( feiseanna.participants( req.params.fid, { offset, limit, filter: req.query.filter } ) );
  });

  router.get( '/:fid/participants/:num', isReadable(), hasRole(), ( req, res ) => {
    res.send( feiseanna.participant( req.params.fid, req.params.num ) );
  });

  router.get( '/:fid/accounts-without-payments', /*isReadable(), hasRole(),*/ ( req, res ) => {
    res.send( feiseanna.accountsWithoutPayment( req.params.fid ) );
  });

  router.get( '/:fid/participants-by-school', /*isReadable(), hasRole(),*/ ( req, res ) => {
    res.send( feiseanna.competitorsBySchool( req.params.fid ) );
  });

  router.get( '/:fid/adjudicators', isReadable(), ( req, res ) => {
    res.send( feiseanna.adjudicators( req.params.fid ) );
  });

  router.post( '/:fid/adjudicators/:aid', isWritable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( feiseanna.attachAdjudicator( req.params.fid, req.params.aid ) );
  });

  router.delete( '/:fid/adjudicators/:aid', isWritable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( feiseanna.detachAdjudicator( req.params.fid, req.params.aid ) );
  });

  router.get( '/:fid/personnel', isReadable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( auth2.getGrantsOn( req.params.fid ).all() );
  });

  router.post( '/:fid/personnel', isWritable(), hasRole( 'chair' ), ( req, res ) => {
    res.send(
      auth2.createGrantOn( req.params.fid, req.body.role )
      .forEmail( req.body.email )
      .by( req.user.id )
    );
  });

  // NOTE: ideally, this would not be visible if the feis was not also visible, but as it would
  // simply give an empty array (even in the case of a nonexistent feis), it is kept this way to
  // avoid the overhead of the extra check.
  router.get( '/:fid/personnel/me', isLoggedIn, ( req, res ) => {
    res.send( auth2.getGrantsOn( req.params.fid ).for( req.user.id ) );
  });

  router.delete( '/:fid/personnel/:grant_id', isWritable(), hasRole( 'chair' ), ( req, res ) => {
    res.send( auth2.revokeGrant( req.params.grant_id ) );
  });

  router.get( '/:fid/results-queue', isReadable(), hasRole( 'results' ), ( req, res ) => {
    res.send( events.for( req.params.fid ).printQueue() );
  });

  return router;
}
FeisRoutes.$inject = [
  Feiseanna,
  Auth2,
  FeisAuthChecks,
  Events,
  Attachments,
  Configuration,
];
