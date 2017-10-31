// # util/test-helpers.js
//
// This is a convenience wrapper around some of the libraries used in testing, like some special DI
// helpers, an assertion library, and some custom functions. It is manually imported in specs that
// require its features.

// import Administer from 'administer';
import Server from '../server/index';
import RouteProvider from '../server/routes/index';
import Neo4j from '../vendor/neo4j/neo4j';
import Logger from './logger';
import _ from 'highland';
import sinon from 'sinon';
import request from 'supertest-as-promised';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
chai.use( chaiAsPromised );
chai.use( sinonChai );

// ## Server Testing
//
// This is a helper method to create an object against which we can run some API calls without the
// overhead of the transport layer.
export function getServer ( adm, routes = RouteProvider, options = {} ) {
  let server;

  return adm.get( Server )
  .then( s => {
    server = s;

    if ( options.user ) {
      let log = Logger( 'MockAuth' );
      log.debug( 'Mocking out authentication with user:', options.user );

      server.server.use( function ( req, res, next ) {
        log.debug( `Hitting endpoint ${req.path} with mocked auth.` );
        req.isAuthenticated = () => true;
        req.user = options.user;
        next();
      });
    }

    return adm.get( RouteProvider );
  })
  .then( () => request.agent( server.server ) );
}

// ## Database Testing
//
// During testing, there are many queries that we need to run that, in some cases, we wouldn't want
// to go through the libraries (e.g. we it test itself). We define a method that just queries the
// graph and calls a callback.
export function queryGraph ( adm, query, props = {} ) {
  return adm.get( Neo4j ).then( graph => {
    return new Promise( ( resolve, reject ) => {
      graph.query( query, props, ( err, results ) => {
        if ( err ) {
          reject( err );
        }

        resolve( results );
      });
    });
  });
}

// The start of many tests is clearing the current graph to start fresh, so we create a simple
// helper for that.
export function emptyGraph ( adm ) {
  var query = [
    'MATCH (n)',
    'OPTIONAL MATCH n-[r]-p',
    'DELETE n, r',
  ].join( " \n" );

  return queryGraph( adm, query );
}

// [should.js](https://github.com/shouldjs/should.js) - A collection of BDD-style assertions.
export should from 'should';

// [Sinon](http://sinonjs.org/) - Spy, stub, mock creation.
export sinon from 'sinon';

// [Chai](http://chaijs.com) - BDD expectation library.
export { expect } from 'chai';

// [Highland](http://highlandjs.org/) - A high-level streams library.
export _ from 'highland';

