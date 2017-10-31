// # Utilities

import _ from 'highland';
import tpl from 'lodash.template';
import fs from 'fs';
import shortId from 'shortid';

// ## Types
//
// We often want to quickly and succinctly determine the type of an variable, so we define a few
// helpers to do just that.

export const types = {};

[ 'Function', 'String', 'Number', 'Date', 'RegExp' ].forEach( function( name ) { 
  types['is' + name] = function( obj ) {
    return toString.call( obj ) == '[object ' + name + ']';
  }; 
});

types.isObject = function ( obj ) {
  return obj instanceof Object;
};

types.isArray = function ( obj ) {
  return Array.isArray( obj );
}

types.isStream = function ( obj ) {
  return _.isStream( obj );
}

// ## Objects

export const object = {};

// Retrieve the value of a property as represented by its string paths (e.g. `params.id`). Based on
// [this Stack Overflow answer](http://stackoverflow.com/a/6491621/259038).
object.get = function getPropertyByPath ( obj, path ) {
  if ( ! types.isObject( obj ) || ! types.isString( path ) ) {
    return;
  }

  var key;
  var keys = path
    .replace( /\[(\w+)\]/g, '.$1' )
    .replace( /^\./, '' )
    .split( '.' );

  while ( keys.length ) {
    key = keys.shift();
    if ( key in obj ) {
      obj = obj[ key ];
    } else {
      return;
    }
  }

  return obj;
};

// ## Strings

export const string = {};

// Based on https://gist.github.com/jamesmkur/3289782
string.sluggify = function ( text ) {
  // First, trim the text and make it lowercase.
  text = text
    .replace(/^\s+|\s+$/g, '')
    .toLowerCase();

  // Then, remove accents.
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to = "aaaaeeeeiiiioooouuuunc------";
  for (let i=0, l=from.length ; i<l ; i++) {
    text = text.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  // Finally, remove any non-valid characters
  text = text
    .replace(/[^a-z0-9 -]/g, '')

    // Collapse any whitespace and replace them with `-`.
    .replace(/\s+/g, '-')

    // And collapse any sequential dashes into one.
    .replace(/-+/g, '-');

  return text;
};

// ## Streams

export const stream = {};

// Sometimes, we need to return a stream but want to return an error *from* that stream rather than
// an error *in* the stream. This simply takes an error, creates a stream, and then throws that
// error on the stream.
stream.reject = function ( err ) {
  return _( ( push, next ) => {
    push( err );
    push( null, _.nil );
  });
};

// ## Templates

export const template = _.ncurry( 3, function ( str, options, data ) {
  return tpl( str, data, options );
});

template.fromFile = function ( filename ) {
  return template( fs.readFileSync( filename ) );
};

// ## Helpers

export const helper = {};

// All database obejects, upon creation, are assigned a unique short ID.
helper.generateId = function () {
  return shortId.generate();
};

export default {
  object,
  string,
  types,
  stream,
  helper,
  template
};

