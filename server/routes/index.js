// # server/routes/index

import express from 'express';

import Server from '../index';
import isLoggedIn from '../ext/is-logged-in';
import { NotFound } from '../ext/errors';
import Logger from '../../util/logger';

import FeiseannaRoutes from './feiseanna';
import AccountRoutes from './accounts';
import StripeRoutes from './stripe';
import SchoolsRoutes from './schools';
import DancesRoutes from './dances';
import AdjudicatorsRoutes from './adjudicators';
import LeadsRoutes from './leads';

const log = Logger( 'Routes' );

// ## RouteProvider
// This is an empty shell that uses DI to instantiate all routes. Having a "middle man" between
// Server and the various routes allows the individual routes to inject the server. The `run` method
// injects both sequentially.
function RouteProvider (
  server,
  api,
  feis,
  acct,
  stripe,
  schools,
  dances,
  adjudicators,
  leads
) {
  api.use( '/feiseanna', feis );
  api.use( '/accounts', acct );
  api.use( '/stripe', stripe );
  api.use( '/schools', schools );
  api.use( '/dances', dances );
  api.use( '/adjudicators', adjudicators );
  api.use( '/contact', leads );

  api.all( '/*', ( req, res ) => {
    res.send( NotFound( `The api endpoint '${req.path}' does not exist.` ) );
  });

  server.use( '/api', api );

  return api;
}
RouteProvider.$inject = [
  Server,
  ApiRouter,

  // Individual Modules.
  FeiseannaRoutes,
  AccountRoutes,
  StripeRoutes,

  SchoolsRoutes,
  DancesRoutes,
  AdjudicatorsRoutes,
  LeadsRoutes,
];

// ## RootRoutes
//
// This is a proof-of-concept of an injectable container for defining routes on the server. It
// injects an instance of the server and an instance of the required route prerequisite, thus
// creating it.
export function ApiRouter () {
  const api = express.Router();

  api.get( '/', ( req, res ) => {
    res.send({ authenticated: req.isAuthenticated() });
  });

  api.get( '/no-auth-test', isLoggedIn, ( req, res ) => {
    res.send({ authenticated: req.isAuthenticated() });
  });

  return api;
}

export default RouteProvider;

