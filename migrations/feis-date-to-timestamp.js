var neo4j = require( 'neo4j-js' );

var DB_URL = 'http://localhost:7474/db/data/';
// var DB_URL = 'http://ec2-54-173-58-184.compute-1.amazonaws.com:7474/db/data/';

neo4j.connect( DB_URL, function ( err, db ) {
  db.query([
    'MATCH (n:Feis)',
    'RETURN n'
  ].join( "\n" ), function ( err, results ) {
    var id, uid;
    var incr = 0;
    var total = results.length;

    function success () {
      incr++;
      console.log( incr, '/', total );
    }

    function dtToTs ( str ) {
      var matches = str.match( /(\d{4})-(\d{2})-(\d{2})/ );
      return Date.UTC( matches[1], parseInt( matches[2], 10 ) - 1, matches[3] );
    }

    var query = [
      'MATCH (n:Feis {id:{id}})',
      'SET n.dt_end={de}, n.dt_start={ds}'
    ].join( "\n" );

    var batch = db.createBatch();

    results.forEach( function ( res ) {
      var dt_start = dtToTs( res.n.data.dt_start );
      var dt_end = dtToTs( res.n.data.dt_end );

      db.query( batch, query, { id: res.n.data.id, de: dt_end, ds: dt_start }, success );
    });

    batch.run( function ( err ) {
      console.log("ERR", err);
    });
  });
});


