import Administer from 'administer';
import {should,_} from '../util/test-helpers'
import util from './utilities'

describe( 'utilities', () => {
  describe( 'types', () => {
    it( 'should correctly identify a string', () => {
      var s1 = "hello";
      var s2 = new String( "world" );

      util.types.isString( s1 ).should.be.true;
      util.types.isString( s2 ).should.be.true;
      util.types.isString( {} ).should.be.false;
      util.types.isString( 23 ).should.be.false;
    });

    it( 'should correctly identify an object', () => {
      var o = {};

      util.types.isObject( o ).should.be.true;
      util.types.isObject( 'hello' ).should.be.false;
    });

    it( 'should correctly identify an array', () => {
      var o = [];

      util.types.isArray( o ).should.be.true;
      util.types.isArray( 'hello' ).should.be.false;
    });
  });

  describe( 'object', () => {
    describe( 'get', () => {
      it( 'should pull object keys from a string path', () => {
        var obj = {
          a: { b: 'hello' },
          c: 'world'
        };

        var c = util.object.get( obj, 'c' );
        var a = util.object.get( obj, 'a' );
        var ab = util.object.get( obj, 'a.b' );

        (c === undefined).should.be.false;
        c.should.equal( obj.c );

        (a === undefined).should.be.false;
        a.should.equal( obj.a );

        (ab === undefined).should.be.false;
        ab.should.equal( obj.a.b );
      });

      it( 'should return undefined for an invalid string path', () => {
        ( util.object.get( {}, 'a.b' ) === undefined ).should.be.true;
        ( util.object.get( { a: {} }, 'a.b' ) === undefined ).should.be.true;
      });

      it( 'should return undefined for a non-object', () => {
        ( util.object.get( 23, 'a.b' ) === undefined ).should.be.true;
      });

      it( 'should return undefined for an non-string path', () => {
        ( util.object.get( {}, 23 ) === undefined ).should.be.true;
      });
    });
  });
});

