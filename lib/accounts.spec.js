import Administer from 'administer';
import {emptyGraph,queryGraph} from '../util/test-helpers.js'
import Accounts from './accounts'
import util from './utilities'

describe( 'Accounts', () => {
  var accounts, user, adm;

  beforeEach( function () {
    adm = Administer();

    user = {
      id: util.helper.generateId(),
      email: 'existing@test.com',
      fname: 'Test',
      lname: 'User'
    };

    return adm.get( Accounts ).then( a => {
      accounts = a;

      return emptyGraph( adm ).then( () => queryGraph( adm, 'CREATE (acct:Account {user})', { user } ) );
    });
  });

  it( 'should get a single account by its id', ( done ) => {
    accounts.getOne( user.id )
      .toArray( ( accts ) => {
        accts.length.should.be.exactly( 1 );
        accts[0].email.should.equal( user.email );
        done();
    });
  });

  it( 'should update a single account by its id', ( done ) => {
    var new_user = {
      fname: 'New',
      lname: 'Person'
    };

    accounts.update( user.id, new_user )
      .toArray( ( accts ) => {
        accts.length.should.be.exactly( 1 );
        accts[0].lname.should.equal( new_user.lname );
        done();
    });
  });

  it( 'should get a single account by its email', ( done ) => {
    accounts.getOneByEmail( user.email )
      .toArray( ( accts ) => {
        accts.length.should.be.exactly( 1 );
        accts[0].email.should.equal( user.email );
        done();
    });
  });
});

