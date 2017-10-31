// # Neo4j

import neo4j from 'neo4j-js';
import Configuration from '../../lib/configuration';

// This is a DI-friendly wrapper around the [`neo4j-js`](https://github.com/bretcope/neo4j-js)
// library so it can be mocked out during unit testing.
function Neo4j ( config ) {
  return new Promise( ( resolve, reject ) => {
    neo4j.connect( config.db.url, ( err, conn ) => {
      if ( err ) {
        reject( err );
      } else {
        resolve( conn );
      }
    });
  });
}

Neo4j.$inject = [ Configuration ];

export default Neo4j;

