import { BadRequest, NotAuthenticated, NotAuthorized, NotFound, BadImplementation } from '../errors';
import Feiseanna from '../../../lib/feiseanna';
import Auth from '../../../lib/auth';
import Logger from '../../../util/logger';
import { types } from '../../../lib/utilities';

const log = Logger( 'auth:feiseanna' );

export default function FeisAuthChecks ( feiseanna, auth ) {
  const middleware = {};

  const util = {
    getGrants ( aid, fid ) {
      return new Promise( function ( resolve, reject ) {
        auth.getGrantsOn( fid ).for( aid ).collect().pull( ( err, grants ) => {
          if ( err ) {
            return reject( BadImplementation( err.toString() ) );
          }

          return resolve( grants );
        });
      });
    }
  };

  const checks = {
    /**
     * Reading
     */
    isReadable ( req ) {
      return new Promise( function ( resolve, reject ) {
        // We don't care if this doesn't involve an individual feis.
        if ( ! req.params.fid ) {
          log.debug( `Ignoring isReadable check due to no FID at ${req.method} ${req.path}` );
          return resolve();
        }

        if ( [ 'GET', 'HEAD' ].indexOf( req.method ) === -1 ) {
          log.warn( `Performing isReadable check on nonidempotent call ${req.method} ${req.path}` );
        }

        // Else we need the feis itself.
        feiseanna.one( req.params.fid ).pull( ( err, feis ) => {
          if ( err ) {
            return reject( BadImplementation( err.toString() ) );
          }

          if ( ! feis || ! feis.id ) {
            return reject( NotFound( `No feis with ID ${req.params.fid}` ) );
          }

          // Store the feis so we can avoid refetching in later middleware.
          req.$feis = feis;

          // If the feis is public, anyone can fetch it.
          if ( feis.is_public ) {
            return resolve();
          }

          // Nonpublic feis are invisible while unauthenticated, of course.
          if ( ! req.isAuthenticated() ) {
            log.debug( `Failing isReadable due to no authentication at ${req.method} ${req.path}` );
            return reject( NotAuthenticated() );
          }

          // Gods can do anything they want.
          if ( req.user.is_god ) {
            log.debug( `isReadable bypassed by god for feis ${req.$feis.id}` );
            return resolve();
          }

          // All that's left is to ensure that the current user's grants allow him to see it.
          return util.getGrants( req.user.id, feis.id ).then( grants => {
            // Store the feis so we can avoid refetching in later middleware.
            req.$grants = grants || [];

            if ( ! grants || ! grants.length ) {
              log.warn( `isReadable denied at ${req.method} ${req.path}` );
              return reject( NotAuthorized() );
            }

            // All other checks are left to other middleware, so we're done here.
            return resolve();
          });
        });
      });
    },

    /**
     * Editing
     */
    isWritable ( req ) {
      return new Promise( function ( resolve, reject ) {
        // We don't care if this doesn't involve an individual feis.
        if ( ! req.params.fid ) {
          log.debug( `Ignoring isWritable check due to no FID at ${req.method} ${req.path}` );
          return resolve();
        }

        if ( [ 'POST', 'PUT', 'DELETE', 'PATCH' ].indexOf( req.method ) === -1 ) {
          log.warn( `Performing isWritable check on non-idempotent ${req.method} ${req.path}` );
        }

        // No changes without authentication, of course.
        if ( ! req.isAuthenticated() ) {
          log.debug( `Failing isWritable due to no authentication at ${req.method} ${req.path}` );
          return reject( NotAuthenticated() );
        }

        // Else we need the feis itself.
        feiseanna.one( req.params.fid ).pull( ( err, feis ) => {
          if ( err ) {
            return reject( BadImplementation( err.toString() ) );
          }

          if ( ! feis || ! feis.id ) {
            return reject( NotFound( `No feis with ID ${req.params.fid}` ) );
          }

          // Store the feis so we can avoid refetching in later middleware.
          req.$feis = feis;

          // Gods can do anything they want.
          if ( req.user.is_god ) {
            log.debug( `isWritable bypassed by god for feis ${req.$feis.id}` );
            return resolve();
          }

          // All that's left is to ensure that the current user's grants allow him this change.
          return util.getGrants( req.user.id, feis.id ).then( grants => {
            // Store the feis so we can avoid refetching in later middleware.
            req.$grants = grants || [];

            if ( ! grants || ! grants.length ) {
              log.warn( `isWritable denied at ${req.method} ${req.path}` );
              return reject( NotAuthorized() );
            }

            // If the feis is finalized, nothing can be changed except by gods (who were already
            // granted above).
            if ( feis.is_finalized ) {
              return reject( BadRequest( 'Finalized feiseanna cannot be altered.' ) );
            }

            // All other checks are left to other middleware, so we're done here.
            return resolve();
          });
        });
      });
    },

    /**
     * Grants / Roles
     * This is intended to be used in combination with isReadable or isWritable above, and so
     * assumes that the feis is already available on the current request.
     */
    hasRole ( req, role ) {
      return new Promise( function hasRolePromise ( resolve, reject ) {
        if ( ! req.$feis ) {
          return reject( BadImplementation( `hasRole(${role}) check failed due to no feis.` ) );
        }
        
        if ( ! req.isAuthenticated() ) {
          return reject( NotAuthenticated() );
        }

        // Gods get through with no roles.
        if ( req.user.is_god ) {
          log.debug( `hasRole(${role}) bypassed by god for feis ${req.$feis.id}` );
          return resolve();
        }

        const checkGrants = ( grants ) => {
          if ( ! grants.length ) {
            log.warn( `hasRole(${role}) denied for lack of grants at ${req.method} ${req.path}` );
            return reject( NotAuthorized() );
          }

          // We know the user has at least one role, so if no role was specified, we will assume
          // success.
          if ( ! role ) {
            return resolve();
          }

          // Otherwise, the user must have either the specified role or the 'chair' role.
          if ( grants.some( g => g.role === role || g.role === 'chair' ) ) {
            return resolve();
          }

          log.warn( `hasRole(${role}) denied due to lack of role at ${req.method} ${req.path}` );
          return reject( NotAuthorized() );
        };

        if ( req.$grants ) {
          log.debug( `hasRole(${role}) using cached grants: ${req.$grants.map(g=>g.role).join( ',' )}` );
          return checkGrants( req.$grants );
        }

        return util.getGrants( req.user.id, req.$feis.id ).then( grants => {
          // Store the feis so we can avoid refetching in later middleware.
          req.$grants = grants || [];
          log.debug( `hasRole(${role}) fetched grants: ${req.$grants.map(g=>g.role).join( ',' )}` );
          return checkGrants( grants );
        });
      });
    },

    isChair ( req ) {
      return checks.hasRole( req, 'chair' );
    },

    isRegistrar ( req ) {
      return checks.hasRole( req, 'registration' );
    },

    isTabulator ( req ) {
      return checks.hasRole( req, 'tabulations' );
    },

    isAwarder ( req ) {
      return checks.hasRole( req, 'results' );
    },

    isSteward ( req ) {
      return checks.hasRole( req, 'stages' );
    },

    /**
     * Invitations
     */
    canUseInvite ( req, allow_gods = false ) {
      return new Promise( function ( resolve, reject ) {
        if ( ! req.isAuthenticated() ) {
          return reject( NotAuthenticated() );
        }

        feiseanna.invitation( req.params.iid || req.body.id )
          .pull( ( err, invite ) => {
            if ( err ) {
              return reject( BadImplementation( err.toString() ) );
            }

            if ( ! invite || ! invite.id ) {
              return reject( NotFound( `No invitation found with ID ${req.params.iid}` ) );
            }

            if ( invite.person.id !== req.user.id ) {
              if ( ! allow_gods || ! req.user.is_god ) {
                return reject( NotAuthorized() );
              }
            }

            req.$invitation = invite;

            return resolve();
          });
      });
    },

    /**
     * Invitations can be seen by anyone who could theoretically redeem it and by gods.
     */
    canSeeInvite ( req ) {
      return checks.canUseInvite( req, true );
    },
  };

  // Now take the above methods and translate them into middleware.
  Object.getOwnPropertyNames( checks ).forEach( name => {
    let fn = checks[ name ];

    middleware[ name ] = function middleware ( ...args ) {
      return function ( req, res, next ) {
        log.debug( `Running middleware for feis:${name}` );
        fn( req, ...args )
        .then( () => next() )
        .catch( err => {
          if ( ! types.isStream( err ) ) {
            return res.send( BadImplementation( err.toString() ) );
          }
          
          return res.send( err );
        });
      };
    }
  });

  return { checks, middleware, util };
}
FeisAuthChecks.$inject = [
  Feiseanna,
  Auth,
];

