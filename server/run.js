// # server/run.js

import express from 'express';
import Administer from 'administer';
import template from 'lodash.template';
import fs from 'fs';

import Server from './index';
import Configuration from '../lib/configuration';
import RouteProvider from './routes/index';
import Logger from '../util/logger';

const log = Logger( 'RunServer' );

// ## `run`
//
// The `run` method creates a new DI injector and grabs the server and the route provider. The
// server is then started, calling the user-provided callback.
//
// This method is the "glue" between the `Server` instance and the many routes defined. It is
// necessary to keep this outside of the server (as opposed to, say, `server.run( cb )`) so that the
// many route definitions can simply *inject* the currently running server instance. This eases the
// development of those routes as well as provides a simple means to test routes: we can load only
// those we need, and we can do so into a modified or mocked server, if necessary.
function run () {
  return Administer().get([
    Server,
    RouteProvider,
    Configuration,
  ])
  .then( ([ server, routes, config ]) => {
    const html = template( fs.readFileSync( `${__dirname}/index.html` ), config );

    server.server.get( '/*', function ( req, res ) {
      log.debug( `Catchall route: ${req.path}` );
      res.send( html );
    });

    return server.start();
  })
};

export default run;

