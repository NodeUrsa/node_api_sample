import Administer from 'administer';
import {emptyGraph,queryGraph,expect} from '../util/test-helpers.js'
import Schools from './schools'
import util from './utilities'

describe( 'Schools', function () {
  beforeEach( function () {
    var school1 = this.school1 = { id: util.helper.generateId(), name: 'School 1' };
    var school2 = this.school2 = { id: util.helper.generateId(), name: 'School 2' };
    var school3 = this.school3 = { id: util.helper.generateId(), name: 'School 3' };

    this.adm = Administer();
    return this.adm.get( Schools ).then( s => {
      this.schools = s;

      return emptyGraph( this.adm ).then( () => queryGraph( this.adm, [
          // The school
          'CREATE (:School {school1})',
          ', (:School {school2})',
          ', (:School {school3})'
        ].join( "\n" ), { school1, school2, school3 } ) );
    });
  });

  describe( '.get()', function () {
    it( 'should return all schools', function ( done ) {
      this.schools.get().toArray( ( schools ) => {
        schools.should.be.an.Array.and.have.lengthOf( 3 );
        done();
      });
    });
  });

  describe( '.create()', function () {
    it( 'should create the provided school', function ( done ) {
      var school = { name: 'School 3' };
      this.schools.create( school ).apply( ( school ) => {
        school.name.should.eql( school.name );
        school.id.should.be.defined;
        done();
      });
    });
  });

  describe( '.update()', function () {
    it( 'should create the provided school', function ( done ) {
      var school = { name: 'School 3' };
      this.schools.update( this.school1.id, school ).apply( ( school ) => {
        school.name.should.eql( school.name );
        school.id.should.eql( this.school1.id );
        done();
      });
    });
  });

  describe( '.delete()', function () {
    it( 'should delete the provided school', function ( done ) {
      this.schools.delete( this.school1.id ).toArray( ( schools ) => {
        this.schools.get().toArray( ( schools ) => {
          schools.should.be.an.Array.and.have.lengthOf( 2 );
          done();
        });
      });
    });
  });
});

