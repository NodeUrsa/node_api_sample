import Administer from 'administer';
import {emptyGraph} from '../util/test-helpers.js';
import Accommodations from './accommodations';
import util from './utilities';
import Database from './database';

describe( 'Accommodations', function () {
  beforeEach( function () {
    this.adm = Administer();
    return this.adm.get([ Database, Accommodations ]).then( ([ d, c ]) => {
      this._accoms = c;
      this.db = d;
    });
  });

  beforeEach( function ( done ) {
    this.fid = 'test-feis-id';
    this.accom1id = 'test-accom-1';
    this.accom2id = 'test-accom-2';
    this.accoms = this._accoms.for( this.fid );

    var all = [
      'CREATE',
      '(feis:Feis {',
      '  id:{fid},',
      '  name:"Test Feis",',
      '  slug:"test-feis"',
      '}),',
      '(:Accommodation {',
      '  id:{accom1id},',
      '  name:"King Suite",',
      '  rate:"120.00"',
      '})-[:FOR]->feis,',
      '(:Accommodation {',
      '  id:{accom2id},',
      '  name:"Economy Double",',
      '  rate:"99.95"',
      '})-[:FOR]->feis'
    ];

    emptyGraph( this.adm ).then(() => {
      this.db.query( all, {
        fid: this.fid,
        accom1id: this.accom1id,
        accom2id: this.accom2id,
      }).apply( () => {
        done();
      });
    });
  });

  describe( 'all()', function () {
    it( 'should return all accommodations for a feis', function ( done ) {
      this.accoms.all().toArray( function ( accoms ) {
        accoms.should.have.lengthOf( 2 );
        done();
      });
    });
  });

  describe( 'one()', function () {
    it( 'should return an accommodation by id', function ( done ) {
      this.accoms.one( this.accom1id ).toArray( ( res ) => {
        res.should.have.lengthOf( 1 );
        res[0].name.should.be.a.String;
        done();
      });
    });
  });

  describe( 'delete()', function () {
    it( 'should delete an accommodation by id', function ( done ) {
      this.accoms.delete( this.accom1id ).toArray( ( res ) => {
        this.accoms.all().toArray( ( accoms ) => {
          accoms.should.have.lengthOf( 1 );
          done();
        });
      });
    });
  });

  describe( 'create()', function () {
    it( 'should return the created accommodation', function ( done ) {
      var expectedAccommodation = {
        name: 'test accom',
      };

      this.accoms.create( expectedAccommodation ).apply( function ( accom ) {
        accom.name.should.eql( expectedAccommodation.name );
        accom.id.should.be.a.String;
        done();
      });
    });
  });

  describe( 'update()', function () {
    it( 'should change the properties of an accommodation', function ( done ) {
      var props = {
        name: 'new-name',
      };

      this.accoms.update( this.accom1id, props ).apply( ( accom ) => {
        accom.name.should.eql( props.name );
        done();
      });
    });
  });
});

