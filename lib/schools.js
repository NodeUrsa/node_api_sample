// # Schools

import { Factory } from 'administer';
import Database from './database';
import util from './utilities';

// The `Schools` class is responsible for CRUD operations as it relates to schools.
const Schools = Factory( 'Schools', {
  _db: Database,
})
.methods({
  // `get` fetches all schools from the system.
  get() {
    var query = [
      'MATCH (school:School)',
      'RETURN school as node'
    ];

    return this._db.query( query );
  },

  create ( school ) {
    school.id = util.helper.generateId();

    var query = [
      'CREATE (school:School {school})',
      'RETURN school as node;'
    ];

    return this._db.queryOne( query, { school } );
  },

  update ( id, school ) {
    school.id = id;

    var query = [
      'MATCH (school:School {id:{id}})',
      'SET school = {school}',
      'RETURN school as node'
    ];

    return this._db.queryOne( query, { id, school } );
  },

  delete ( id ) {
    var query = [
      'MATCH (school:School {id:{id}})',
      'DELETE school'
    ];

    return this._db.query( query, { id } );
  },
})
;

export default Schools;

