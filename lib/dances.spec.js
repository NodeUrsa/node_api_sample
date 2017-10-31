import Administer from 'administer';
import {emptyGraph,queryGraph,expect} from '../util/test-helpers.js';
import Dances from './dances';
import util from './utilities';

describe( 'Dances', function () {
  beforeEach( function () {
    var dance1 = this.dance1 = { id: util.helper.generateId(), name: 'Test 1' };
    var dance2 = this.dance2 = { id: util.helper.generateId(), name: 'Test 2' };
    var dance3 = this.dance3 = { id: util.helper.generateId(), name: 'Test 3' };

    this.adm = Administer();
    return this.adm.get( Dances ).then( s => {
      this.dances = s;

      return emptyGraph( this.adm ).then( () => queryGraph( this.adm, [
          'CREATE (:Dance {dance1})',
          ', (:Dance {dance2})',
          ', (:Dance {dance3})'
        ].join( "\n" ), { dance1, dance2, dance3 } ) );
    });
  });

  describe( '.get()', function () {
    it( 'should return all dances', function ( done ) {
      this.dances.get().toArray( ( dances ) => {
        dances.should.be.an.Array.and.have.lengthOf( 3 );
        done();
      });
    });
  });

  describe( '.create()', function () {
    it( 'should create the provided dance', function ( done ) {
      var dance = { name: 'Dance 3' };
      this.dances.create( dance ).apply( ( dance ) => {
        dance.name.should.eql( dance.name );
        dance.id.should.be.defined;
        done();
      });
    });
  });

  describe( '.update()', function () {
    it( 'should create the provided dance', function ( done ) {
      var dance = { name: 'Dance 3' };
      this.dances.update( this.dance1.id, dance ).apply( ( dance ) => {
        dance.name.should.eql( dance.name );
        dance.id.should.eql( this.dance1.id );
        done();
      });
    });
  });

  describe( '.delete()', function () {
    it( 'should delete the provided dance', function ( done ) {
      this.dances.delete( this.dance1.id ).toArray( ( dances ) => {
        this.dances.get().toArray( ( dances ) => {
          dances.should.be.an.Array.and.have.lengthOf( 2 );
          done();
        });
      });
    });
  });
});

