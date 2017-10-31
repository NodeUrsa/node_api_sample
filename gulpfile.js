// Bootstrap the babel runtime.
require( 'babel/register' );

var gulp = require( 'gulp' );
var rimraf = require( 'rimraf' );
var inlineCss = require( 'gulp-inline-css' );
var inline = require( 'gulp-inline-source' );

/**
 * Paths and Globs
 */

var globs = {
  api: {},
};


/**
 * API Paths and Globs
 */

globs.api.tpl = [
  'raw-templates/*.tpl.html',
  'raw-templates/*.tpl.text'
];


/**
 * Cleaning
 */

gulp.task( 'api-clean-templates', function ( cb ) {
  rimraf( 'templates', cb );
});


/**
 * Templates
 */

gulp.task( 'api-tpl-build', [ 'api-clean-templates' ], function () {
  return gulp.src( globs.api.tpl )
    .pipe( inline({ swallowErrors: false }) )
    .pipe( inlineCss({ preserveMediaQueries: true }) )
    .pipe( gulp.dest( 'templates' ) );
});


/**
 * Meta Tasks
 */

gulp.task( 'default', [ 'api-tpl-build' ] );

