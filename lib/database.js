// # database

import { Factory } from 'administer';
import _ from 'highland';
import util from './utilities';
import Neo4j from '../vendor/neo4j/neo4j';

// The `Database` class is a wrapper around `neo4j-js` that contains a few helpers for querying the
// DB using Streams rather than callbacks.
const Database = Factory( 'Database', { graph: Neo4j } )
.init( ({ instance }) => {
  // This is a friendly helper to change callback-style to stream-style. We store it here so it
  // needn't be created more than once.
  instance._query = _.wrapCallback( instance.$inject.graph.query );
})
.methods({

  // ## queryStream
  //
  // The `queryStream` method is called internally to actually run queries. It takes a query (either
  // a string or array of strings) and a set of optional query parameters, and returns a stream
  // result.
  _queryStream( query, params ) {
    if ( util.types.isArray( query ) ) {
      query = query.join( " \n" );
    }

    return this._query( query, params || {} );
  },

  // ## query
  //
  // `query` is the basic method of querying. It is a wrapper around `Database::_queryStream`, but
  // standardizes the response format from the ugly details of `neo4j-js` into something a little
  // more object-oriented.
  query( ...args ) {
    return this._queryStream( ...args )
      .flatten()
      .map( ( result ) => {
        // These objects are not alterable, so we create a copy using JSON so downstream processes
        // can manipulate them if necessary.
        var object = JSON.parse( JSON.stringify( result.node.data ) );
        return object;
      });
  },

  // ## queryOne
  //
  // `queryOne` runs a query, but limits the results to the first in the stream. This is *not*
  // database-optimized and so is designed for use with, e.g., `LIMIT 1`. It's use here is to
  // prevent odd results in edge cases as well as to indicate to the `formatResponse` extension that
  // this should be a single result, so we shouldn't pass an array as a result.
  queryOne( ...args ) {
    return this.query( ...args ).head();
  },

  // ## queryMultiple
  //
  // The previous methods for quering the system require one return value from a `RETURN whatever as
  // node` statement in the query. This method allows retrieving more than one return value by
  // dynamically processing the key names. E.g. `RETURN one, two, three` will yield an object for
  // each returned row with the keys `one`, `two`, and `three`, containing processed objects as
  // above.
  queryMultiple( ...args ) {
    return this._queryStream( ...args )
      .flatten()
      .map( ( res ) => {
        var obj = {};
        Object.keys( res ).forEach( ( key ) => {
          if ( res[ key ] !== undefined && res[ key ] !== null ) {
            if ( res[ key ].data ) {
              obj[ key ] = JSON.parse( JSON.stringify( res[ key ].data ) );
            } else {
              obj[ key ] = res[ key ]
            }
          } else {
            obj[ key ] = null;
          }
        });

        return obj;
      });
  },
})
;

export default Database;

