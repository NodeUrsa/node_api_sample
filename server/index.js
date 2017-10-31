// # server/index.js

import {Factory} from 'administer';
import express from 'express';
import passport from 'passport';
import session from 'express-session';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { OAuth2Strategy as GoogleStrategy } from 'passport-google-oauth';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import Logger from '../util/logger';

import Configuration from '../lib/configuration';
import Auth2 from '../lib/auth';
import Accounts from '../lib/accounts';
import util from '../lib/utilities';
import { BadImplementation, NotFoundObject } from './ext/errors';

const log = Logger( 'Server' );

export function HandleErrors ( res ) {
  return function handleErrors ( error ) {
    let response;

    if ( error.statusCode ) {
      res.status( error.statusCode );

      response = {
        code: error.statusCode,
        title: error.title,
        detail: error.detail,
      };
    } else {
      res.status( 500 );

      response = {
        code: 500,
        title: 'Internal Server Error',
        detail: error.toString(),
      };
    }

    res.json({ errors: [ response ] });
  };
}


// ## Server
//
// The `Server` class is a management layer on top of an existing ExpressJS-based
// HTTP server.
const Server = Factory( 'Server', {
  config: Configuration,
  auth2: Auth2,
  accounts: Accounts,
})
.init( function () {
  // We use the config and server a lot, so we create a little shortcut here.
  const config = this.config;
  const server = this.server = express();

  passport.serializeUser( ( user, done ) => {
    done( null, user.id );
  });

  passport.deserializeUser( ( id, done ) => {
    this.accounts.getOne( id ).stopOnError( e => done( e ) ).apply( acct => done( null, acct ) );
  });

  var authHandler = ( accessToken, refreshToken, profile, done ) => {
    this.auth2.getOrCreateAccount( profile.id, profile )
    .stopOnError( ( err ) => {
      log.error( 'getOrCreateAccount failed with (profile, err)', profile, err.stack);
      // FIXME(jdm): Redirect to 500 if there's an error here
      done( BadImplementation( 'Could not create user' ) );
    })
    .apply( user => {
      // FIXME(jdm): Only do this if there was no error.
      done( null, user );
    })
    ;
  };

  passport.use( new GoogleStrategy({
    callbackURL: `${this.config.base_url}/login/google/return`,
    clientID: config.oauth.google.client_id,
    clientSecret: config.oauth.google.client_secret,
  }, authHandler ));

  passport.use( new FacebookStrategy({
    callbackURL: `${this.config.base_url}/login/facebook/return`,
    clientID: config.oauth.facebook.client_id,
    clientSecret: config.oauth.facebook.client_secret,
    profileFields: [ 'id', 'email', 'name', 'link' ],
  }, authHandler ));

  server.use( cors() );
  server.use( bodyParser() );
  server.use( cookieParser( config.oauth.cookie_password ) );
  server.use( session({ secret: config.oauth.cookie_password }) );
  server.use( passport.initialize() );
  server.use( passport.session() );

  // Transform replies.
  //
  // Ensures every reply is a stream, adds error handling to it, and then sends it off to
  // `res.send`. This is accomplished by overwriting the original `res.send` with a wrapper around
  // the streams.
  server.use( ( req, res, next ) => {
    // Overwrite the default res.send method.
    const originalResSend = res.send.bind( res );
    const errorHandler = HandleErrors( res );

    res.send = ( response ) => {
      let stream = response;

      if ( ! util.types.isStream( stream ) ) {
        if ( util.types.isObject( stream ) ) {
          return originalResSend({ data: stream });
        }

        return originalResSend( stream );
      }

      // FIXME(jdm): This is kind of hacky, but it checks if `head()` or `tail()` was called on the
      // stream. However, it relies on internal implementation details of Highland.
      const isMany = stream.id.indexOf( 'take:' ) !== 0 ? true : false;

      if ( isMany ) {
        stream = stream.collect();
      }

      stream
        .stopOnError( errorHandler )
        .apply( data => {
          if ( res.headersSent ) {
            return;
          }
          
          if ( data === undefined ) {
            return errorHandler( NotFoundObject() );
          }
          
          return originalResSend({ data })
        })
        ;
    };

    next();
  });

  server.get( '/login/google', passport.authenticate( 'google', { scope: [ 'profile', 'email' ] } ) );
  server.get( '/login/google/return', passport.authenticate( 'google', {
    successRedirect: '/login/redirect',
    failureRedirect: '/login',
  }));

  server.get( '/login/facebook', passport.authenticate( 'facebook', { scope: [ 'email', 'public_profile' ] } ) );
  server.get( '/login/facebook/return', passport.authenticate( 'facebook', {
    successRedirect: '/login/redirect',
    failureRedirect: '/login',
  }));

  if ( [ 'DEVELOPMENT', 'STAGING' ].indexOf( process.env.IFEIS_ENVIRONMENT ) !== -1 ) {
    server.get( '/login/backdoor/:email', ( req, res ) => {
      this.accounts.getOneByEmail( req.params.email ).apply( user => {
        req.login( user, err => {
          if ( err ) {
            return res.redirect( '/not-found' );
          }

          return res.redirect( '/login/redirect' );
        });
      });
    });
  }

  // Logout is not dependent on any specific method of authentication as they are all session-based.
  // So, we just clear the session and redirect to the root.
  server.get( '/logout', function ( req, res ) {
    req.logout();
    res.redirect( '/' );
  });
})
.methods({

  // ### start
  //
  // Start the server, providing a function to be called when the server is started.
  start () {
    return new Promise( ( resolve, reject ) => {
      this._conn = this.server.listen( this.config.server.port, this.config.server.host, () => resolve() );
    });
  },

  // ### stop
  //
  // Stop the server, providing a function to be called when the server is fully stopped.
  stop () {
    return new Promise( ( resolve, reject ) => {
      if ( ! this._conn ) {
        reject( 'Server not listening' );
      }

      this._conn.close( () => resolve() );
      delete this._conn;
    });
  },

  use( ...conf ) {
    this.server.use( ...conf );
  },

  all( ...conf ) {
    // this.route( 'get', ...conf );
    this.server.all( ...conf );
  },

  get( ...conf ) {
    // this.route( 'get', ...conf );
    this.server.get( ...conf );
  },

  put( ...conf ) {
    // this.route( 'put', ...conf );
    this.server.put( ...conf );
  },

  post( ...conf ) {
    // this.route( 'post', ...conf );
    this.server.post( ...conf );
  },

  delete( ...conf ) {
    // this.route( 'delete', ...conf );
    this.server.delete( ...conf );
  },

  // ### method
  //
  // `method` will register a function that can be used as a route prerequisite. It is a thin
  // wrapper around the [Hapi method](http://hapijs.com/api#servermethodmethod).
  // method( ...args ) {
  //   this.server.method( ...args );
  // },
})
;

export default Server;

