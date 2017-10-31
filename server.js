// # run-server.js
//
// This script simply initializes support for ES6, loads the server runtime, and then starts the
// server.

require( 'babel-register' );

require( './server/run' ).default()
.then( function () {
  console.log( 'The server is running...' );
}, function ( err ) {
  console.error( 'Could not start server:\n', err.stack );
});

