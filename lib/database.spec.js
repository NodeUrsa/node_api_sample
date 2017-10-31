import Administer from 'administer';
import {_,expect,sinon,emptyGraph,queryGraph} from '../util/test-helpers'
import Database from './database'
import Neo4j from '../vendor/neo4j/neo4j'

describe( 'database', () => {
  var db;

  var Neo4jMock = {
    query: ( cb ) => { cb( null, 'hello' ); }
  };

  beforeEach( function () {
    this.adm = Administer();
  });

  it( 'should throw an error if the graph fails to connect', function () {
    this.adm.provide( Neo4j, Promise.reject( new Error() ) );

    return expect( this.adm.get( Neo4j ) ).to.be.rejected;
  });

  describe( 'stream wrappers', () => {
    beforeEach( function () {
      this.adm.provide( Neo4j, Neo4jMock );
      return this.adm.get( Database ).then( _db_ => db = _db_ );
    });

    it( 'should store a graph reference & query stream generator', ( done ) => {
      db.graph.should.equal( Neo4jMock );
      db._query.should.be.a.function;

      var qs = db._query();
      _.isStream( qs ).should.be.true;
      qs.toArray( ( res ) => {
        res.length.should.equal( 1 );
        res[0].should.equal( 'hello' );

        done();
      });
    });

    it( 'should correctly handle string queries', () => {
      var query = 'QUERY';
      var spy = sinon.spy( db, '_query' );
      
      db._queryStream( query );
      spy.calledWith( query );
    });

    it( 'should correctly handle array queries', () => {
      var query = [ 'QUERY', 'ARRAY' ];
      var spy = sinon.spy( db, '_query' );
      
      db._queryStream( query );
      spy.calledWith( query.join( " \n" ) );
    });
  });

  describe( 'query', () => {
    beforeEach( function () {
      // Load fixtures.
      var testQ = [
        'CREATE (node1:Test {name: "one"})',
        ',  (node2:Test {name: "two"})'
      ].join( " \n" );

      return this.adm.get( Database )
      .then( _db_ => {
        db = _db_;

        return emptyGraph( this.adm ).then( () => {
          return queryGraph( this.adm, testQ );
        });
      });
    });


    it( 'should retrieve one result when asked', ( done ) => {
      var query = 'MATCH (node:Test) RETURN node';

      db.queryOne( query )
        .toArray( ( results ) => {
          results.length.should.equal( 1 );
          done();
        });
    });
  });
});

