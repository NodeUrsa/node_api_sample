var neo4j = require( 'neo4j-js' );
var shortId = require( 'shortid' );

var DB_URL = 'http://localhost:7474/db/data/';
// var DB_URL = 'http://ec2-54-173-58-184.compute-1.amazonaws.com:7474/db/data/';

neo4j.connect( DB_URL, function ( err, db ) {
  db.query([
    'MATCH (n)',
    'RETURN n'
  ].join( "\n" ), function ( err, results ) {
    var id, uid;
    var incr = 0;
    var total = results.length;

    function success () {
      incr++;
      console.log( incr, '/', total );
    }

    var query = [
      'MATCH (n)',
      'WHERE ID(n) = {id}',
      'SET n.id = {uid}'
    ].join( "\n" );

    var batch = db.createBatch();

    results.forEach( function ( res ) {
      id = parseInt( res.n.id, 10 );
      uid = shortId.generate();

      db.query( batch, query, { id: id, uid: uid }, success );
    });

    batch.run( function ( err ) {
      console.log("ERR", err);
    });
  });
});


