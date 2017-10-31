import Administer from 'administer';
import {emptyGraph,queryGraph,expect} from '../util/test-helpers.js'
import Adjudicators from './adjudicators'
import util from './utilities'

describe( 'Adjudicators', function () {
  beforeEach( function () {
    var adj1 = this.adj1 = { id: util.helper.generateId(), fname: 'Adjudicator', lname: 'One' };
    var adj2 = this.adj2 = { id: util.helper.generateId(), fname: 'Adjudicator', lname: 'Two' };
    var adj3 = this.adj3 = { id: util.helper.generateId(), fname: 'Adjudicator', lname: 'Three' };

    this.adm = Administer();
    return this.adm.get( Adjudicators ).then( s => {
      this.adjs = s;

      return emptyGraph( this.adm ).then( () => queryGraph( this.adm, [
          'CREATE (:Adjudicator {adj1})',
          ', (:Adjudicator {adj2})',
          ', (:Adjudicator {adj3})'
        ].join( "\n" ), { adj1, adj2, adj3 } ) );
    });
  });

  describe( '.get()', function () {
    it( 'should return all adjs', function ( done ) {
      this.adjs.get().toArray( ( adjs ) => {
        adjs.should.be.an.Array.and.have.lengthOf( 3 );
        done();
      });
    });
  });

  describe( '.create()', function () {
    it( 'should create the provided adj', function ( done ) {
      var adj = { name: 'Adjudicator 3' };
      this.adjs.create( adj ).apply( ( adj ) => {
        adj.name.should.eql( adj.name );
        adj.id.should.be.defined;
        done();
      });
    });
  });

  describe( '.update()', function () {
    it( 'should create the provided adj', function ( done ) {
      var adj = { name: 'Adjudicator 3' };
      this.adjs.update( this.adj1.id, adj ).apply( ( adj ) => {
        adj.name.should.eql( adj.name );
        adj.id.should.eql( this.adj1.id );
        done();
      });
    });
  });

  describe( '.delete()', function () {
    it( 'should delete the provided adj', function ( done ) {
      this.adjs.delete( this.adj1.id ).toArray( ( adjs ) => {
        this.adjs.get().toArray( ( adjs ) => {
          adjs.should.be.an.Array.and.have.lengthOf( 2 );
          done();
        });
      });
    });
  });
});

