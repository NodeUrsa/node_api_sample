import Administer from 'administer';
import {emptyGraph} from '../util/test-helpers.js';
import Contacts from './contacts';
import util from './utilities';
import Database from './database';

describe( 'Contacts', function () {
  beforeEach( function () {
    this.adm = Administer();
    return this.adm.get([ Database, Contacts ]).then( ([ d, c ]) => {
      this._contacts = c;
      this.db = d;
    });
  });

  beforeEach( function ( done ) {
    this.fid = 'test-feis-id';
    this.person1id = 'test-person-1';
    this.person2id = 'test-person-2';
    this.contacts = this._contacts.for( this.fid );

    var all = [
      'CREATE',
      '(feis:Feis {',
      '  id:{fid},',
      '  name:"Test Feis",',
      '  slug:"test-feis"',
      '}),',
      '(:Person {',
      '  id:{person1id},',
      '  fname:"Joe",',
      '  lname:"Smith",',
      '  phone:"888-555-5555",',
      '  email:"joesmith@gmail.com"',
      '})-[:CONTACTEE]->feis,',
      '(:Person {',
      '  id:{person2id},',
      '  fname:"Joe",',
      '  lname:"Smith",',
      '  phone:"888-555-5555",',
      '  email:"joesmith@gmail.com"',
      '})-[:CONTACTEE]->feis'
    ];

    emptyGraph( this.adm ).then( () => {
      this.db.query( all, {
        fid: this.fid,
        person1id: this.person1id,
        person2id: this.person2id,
      }).apply( () => {
        done();
      });
    });
  });

  describe( 'all()', function () {
    it( 'should return all contacts for a feis', function ( done ) {
      this.contacts.all().toArray( function ( persons ) {
        persons.should.have.lengthOf( 2 );
        done();
      });
    });
  });

  describe( 'one()', function () {
    it( 'should return a contact by id', function ( done ) {
      this.contacts.one( this.person1id ).toArray( ( res ) => {
        res.should.have.lengthOf( 1 );
        res[0].fname.should.be.a.String;
        done();
      });
    });
  });

  describe( 'delete()', function () {
    it( 'should delete a contact by id', function ( done ) {
      this.contacts.delete( this.person1id ).toArray( ( res ) => {
        this.contacts.all().toArray( ( persons ) => {
          persons.should.have.lengthOf( 1 );
          done();
        });
      });
    });
  });

  describe( 'create()', function () {
    it( 'should return the created contact', function ( done ) {
      var expectedPerson = {
        fname: 'test person',
      };

      this.contacts.create( expectedPerson ).apply( function ( person ) {
        person.fname.should.eql( expectedPerson.fname );
        person.id.should.be.a.String;
        done();
      });
    });
  });

  describe( 'update()', function () {
    it( 'should change the properties of a contact', function ( done ) {
      var props = {
        fname: 'new-name',
      };

      this.contacts.update( this.person1id, props ).apply( ( person ) => {
        person.fname.should.eql( props.fname );
        done();
      });
    });
  });
});

