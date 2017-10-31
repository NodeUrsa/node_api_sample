import Administer from 'administer';
import _ from 'highland';

import { NotFound, NotAuthorized, BadImplementation } from '../errors';
import {sinon,expect} from '../../../util/test-helpers';
import Feiseanna from '../../../lib/feiseanna';
import Auth from '../../../lib/auth';
import FeisAuthChecks from './feiseanna';
import util from '../../../lib/utilities';

describe( 'FeisAuthChecks', function () {
  beforeEach( function () {
    this.adm = Administer();

    this.feis = {
      id: '5678',
      is_public: 1,
    };
    this.user = {};
    this.req = {
      method: 'GET',
      path: '/unit-test',
      query: {},
      params: {
        fid: '1234',
        iid: '4567',
      },
      body: {},
      user: this.user,
      isAuthenticated: () => this.user && this.user.id,
    };
    this.grants = [];
    this.invite = { id: '1234', person: { id: '123' } };

    this.MockFeiseanna = {
      one: sinon.spy( () => _([ this.feis ]) ),
      invitation: sinon.spy( () => _([ this.invite ]) ),
    };
    this.adm.provide( Feiseanna, this.MockFeiseanna );

    this.MockAuth = {
      getGrantsOn: () => ({ for: () => _( this.grants ) }),
    };
    this.adm.provide( Auth, this.MockAuth );

    return this.adm.get( FeisAuthChecks ).then( auth => this.auth = auth );
  });

  /*************************************************************************************************
   * isReadable
   ************************************************************************************************/
  describe( 'isReadable', function () {
    beforeEach( function () {
      this.isReadable = this.auth.checks.isReadable;
    });

    it( 'should return a promise', function () {
      expect( this.isReadable( this.req ) ).to.have.property( 'then' );
    });

    it( 'should resolve if no fid param', function () {
      delete this.req.params.fid;
      return expect( this.isReadable( this.req ) ).to.be.fulfilled;
    });

    it( 'should return 500 if the call errors out', function () {
      this.MockFeiseanna.one = () => BadImplementation();

      return expect( this.isReadable( this.req ) ).to.be.rejected
      .then( stream => {
        return new Promise( ( resolve, reject ) => {
          stream.pull( e => {
            expect( e ).to.have.property( 'statusCode', 500 );
            resolve();
          });
        });
      });
    });

    it( 'should reject 404 if the feis cannot be found', function () {
      this.MockFeiseanna.one = () => _([]);

      return expect( this.isReadable( this.req ) ).to.be.rejected
      .then( stream => {
        return new Promise( ( resolve, reject ) => {
          stream.pull( e => {
            expect( e ).to.have.property( 'statusCode', 404 );
            resolve();
          });
        });
      });
    });

    it( 'should cache the feis on the request', function () {
      return expect( this.isReadable( this.req ) ).to.be.fulfilled
      .then( () => expect( this.req.$feis ).to.eql( this.feis ) );
    });

    describe( 'when feis is not public', function () {
      beforeEach( function () {
        this.feis.is_public = 0;
      });

      it( 'should reject unauthenticated users', function () {
        this.feis.is_public = 0;

        return expect( this.isReadable( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 401 );
              resolve();
            });
          });
        });
      });

      it( 'should resolve god users', function () {
        this.user.id = '123';
        this.user.is_god = 1;

        return expect( this.isReadable( this.req ) ).to.be.fulfilled;
      });

      it( 'should reject when a user has no grants', function () {
        this.user.id = '123';

        return expect( this.isReadable( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 403 );
              resolve();
            });
          });
        });
      });

      it( 'should resolve when a user has any grants - and cache the grants', function () {
        this.user.id = '123';
        this.grants.push({ role: 'chair' });

        return expect( this.isReadable( this.req ) ).to.be.fulfilled
        .then( () => expect( this.req.$grants ).to.eql( this.grants ) );
      });
    });

    describe( 'when the feis is public', function () {
      it( 'should resolve the feis', function () {
        return expect( this.isReadable( this.req ) ).to.be.fulfilled;
      });
    });
  });

  /*************************************************************************************************
   * isWritable
   ************************************************************************************************/
  describe( 'isWritable', function () {
    beforeEach( function () {
      this.isWritable = this.auth.checks.isWritable;
      this.user.id = '123';
    });

    it( 'should return a promise', function () {
      expect( this.isWritable( this.req ) ).to.have.property( 'then' );
    });

    it( 'should resolve if no fid param', function () {
      delete this.req.params.fid;

      return expect( this.isWritable( this.req ) ).to.be.fulfilled;
    });

    it( 'should reject unauthenticated users', function () {
      delete this.user.id;

      return expect( this.isWritable( this.req ) ).to.be.rejected
      .then( stream => {
        return new Promise( ( resolve, reject ) => {
          stream.pull( e => {
            expect( e ).to.have.property( 'statusCode', 401 );
            resolve();
          });
        });
      });
    });

    it( 'should return 500 if the call errors out', function () {
      this.MockFeiseanna.one = () => BadImplementation();

      return expect( this.isWritable( this.req ) ).to.be.rejected
      .then( stream => {
        return new Promise( ( resolve, reject ) => {
          stream.pull( e => {
            expect( e ).to.have.property( 'statusCode', 500 );
            resolve();
          });
        });
      });
    });

    it( 'should reject 404 if the feis cannot be found', function () {
      this.MockFeiseanna.one = () => _([]);

      return expect( this.isWritable( this.req ) ).to.be.rejected
      .then( stream => {
        return new Promise( ( resolve, reject ) => {
          stream.pull( e => {
            expect( e ).to.have.property( 'statusCode', 404 );
            resolve();
          });
        });
      });
    });

    it( 'should reject when a user has no grants', function () {
      return expect( this.isWritable( this.req ) ).to.be.rejected
      .then( stream => {
        return new Promise( ( resolve, reject ) => {
          stream.pull( e => {
            expect( e ).to.have.property( 'statusCode', 403 );
            resolve();
          });
        });
      });
    });

    describe( 'when the user has grants', function () {
      beforeEach( function () {
        this.grants.push({ role: 'chair' });
      });

      it( 'should cache the feis on the request', function () {
        return expect( this.isWritable( this.req ) ).to.be.fulfilled
        .then( () => expect( this.req.$feis ).to.eql( this.feis ) );
      });

      it( 'should resolve god users', function () {
        this.user.is_god = 1;

        return expect( this.isWritable( this.req ) ).to.be.fulfilled;
      });

      it( 'should resolve when a user has any grants - and cache the grants', function () {
        return expect( this.isWritable( this.req ) ).to.be.fulfilled
        .then( () => expect( this.req.$grants ).to.eql( this.grants ) );
      });

      it( 'should reject if the feis is finalized', function () {
        this.feis.is_finalized = 1;
        this.grants.push({ role: 'chair' });

        return expect( this.isWritable( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 400 );
              resolve();
            });
          });
        });
      });
    });
  });

  /*************************************************************************************************
   * hasRole
   ************************************************************************************************/
  describe( 'hasRole', function () {
    beforeEach( function () {
      this.hasRole = this.auth.checks.hasRole;
      this.user.id = '1234';
      this.req.$feis = this.feis;
    });

    describe( 'given no existing feis on the request', function () {
      beforeEach( function () {
        delete this.req.$feis;
      });

      it( 'should return 500', function () {
        return expect( this.hasRole( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 500 );
              resolve();
            });
          });
        });
      });
    });

    describe( 'given the user is a god', function () {
      it( 'should resolve', function () {
        this.user.is_god = 1;
        return expect( this.hasRole( this.req ) ).to.be.fulfilled;
      });
    });

    describe( 'given the user is not logged in', function () {
      beforeEach( function () {
        delete this.user.id;
      });

      it( 'should reject with 401', function () {
        return expect( this.hasRole( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 401 );
              resolve();
            });
          });
        });
      });
    });

    describe( 'given the user has no roles', function () {
      it( 'should reject with 403', function () {
        return expect( this.hasRole( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 403 );
              resolve();
            });
          });
        });
      });
    });

    function checkGrants () {
      it( 'should resolve if no role was provided', function () {
        return expect( this.hasRole( this.req ) ).to.be.fulfilled;
      });

      it( 'should resolve if the user has the requested role', function () {
        return expect( this.hasRole( this.req, this.role ) ).to.be.fulfilled;
      });

      it( 'should resolve if the user does not have the requested role but is chair', function () {
        this.grants.push({ role: 'chair' });
        return expect( this.hasRole( this.req, 'another-role' ) ).to.be.fulfilled;
      });

      it( 'should reject with 403 if the user does not have the role and is not chair', function () {
        return expect( this.hasRole( this.req, 'another-role' ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 403 );
              resolve();
            });
          });
        });
      });
    }

    describe( 'given the user has at least one role', function () {
      beforeEach( function () {
        this.role = 'registration';
        this.grants.push({ role: this.role });
      });

      checkGrants.bind( this )();
    });

    describe( 'given the user has cached roles from a previous call', function () {
      beforeEach( function () {
        this.role = 'registration';
        this.grants.push({ role: this.role });
        this.req.$grants = this.grants;
      });

      checkGrants.bind( this )();
    });
  });

  /*************************************************************************************************
   * canUseInvite
   ************************************************************************************************/
  describe( 'canSeeInvite', function () {
    beforeEach( function () {
      this.canUseInvite = this.auth.checks.canUseInvite;
      this.user.id = '1234';
    });

    describe( 'given the user is not logged in', function () {
      beforeEach( function () {
        delete this.user.id;
      });

      it( 'should reject with 401', function () {
        return expect( this.canUseInvite( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 401 );
              resolve();
            });
          });
        });
      });
    });

    describe( 'given the user is logged in', function () {
      it( 'should return 404 for invitations that do not exist', function () {
        delete this.invite.id;

        return expect( this.canUseInvite( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 404 );
              resolve();
            });
          });
        });
      });

      it( 'should return 403 if the invitation is not for the user', function () {
        return expect( this.canUseInvite( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 403 );
              resolve();
            });
          });
        });
      });

      it( 'should return 403 if the invitation is not for the user, even if a god', function () {
        this.user.is_god = 1;

        return expect( this.canUseInvite( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 403 );
              resolve();
            });
          });
        });
      });

      it( 'should resolve with if the invitation is for the user', function () {
        this.invite.person = this.user;
        return expect( this.canUseInvite( this.req ) ).to.be.fulfilled
        .then( () => {
          expect( this.MockFeiseanna.invitation ).to.have.been.calledWith( this.req.params.iid );
        });
      });

      it( 'should resolve with if the invitation is for the user, if id is in body', function () {
        this.req.body.id = '123';
        this.invite.person = this.user;
        delete this.req.params.iid;
        return expect( this.canUseInvite( this.req ) ).to.be.fulfilled
        .then( () => {
          expect( this.MockFeiseanna.invitation ).to.have.been.calledWith( this.req.body.id );
        });
      });
    });
  });

  /*************************************************************************************************
   * canSeeInvite
   ************************************************************************************************/
  describe( 'canSeeInvite', function () {
    beforeEach( function () {
      this.canSeeInvite = this.auth.checks.canSeeInvite;
      this.user.id = '1234';
    });

    describe( 'given the user is not logged in', function () {
      beforeEach( function () {
        delete this.user.id;
      });

      it( 'should reject with 401', function () {
        return expect( this.canSeeInvite( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 401 );
              resolve();
            });
          });
        });
      });
    });

    describe( 'given the user is logged in', function () {
      it( 'should return 404 for invitations that do not exist', function () {
        delete this.invite.id;

        return expect( this.canSeeInvite( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 404 );
              resolve();
            });
          });
        });
      });

      it( 'should return 403 if the invitation is not for the user', function () {
        return expect( this.canSeeInvite( this.req ) ).to.be.rejected
        .then( stream => {
          return new Promise( ( resolve, reject ) => {
            stream.pull( e => {
              expect( e ).to.have.property( 'statusCode', 403 );
              resolve();
            });
          });
        });
      });

      it( 'should resolve with if the the user is a god', function () {
        this.user.is_god = 1;
        return expect( this.canSeeInvite( this.req ) ).to.be.fulfilled;
      });

      it( 'should resolve with if the invitation is for the user', function () {
        this.invite.person = this.user;
        return expect( this.canSeeInvite( this.req ) ).to.be.fulfilled;
      });
    });
  });
});

