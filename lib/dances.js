// # Dances

import { Factory } from 'administer';
import Database from './database'
import util from './utilities'

// The `Dances` class is responsible for CRUD operations as it relates to dances.
const Dances = Factory( 'Dances', {
  _db: Database,
})
.methods({
  // `get` fetches all dances from the system.
  get() {
    var query = [
      'MATCH (dance:Dance)',
      'RETURN dance as node'
    ];

    return this._db.query( query );
  },

  create ( dance ) {
    dance.id = util.helper.generateId();

    var query = [
      'CREATE (dance:Dance {dance})',
      'RETURN dance as node;'
    ];

    return this._db.queryOne( query, { dance } );
  },

  update ( id, dance ) {
    dance.id = id;

    var query = [
      'MATCH (dance:Dance {id:{id}})',
      'SET dance = {dance}',
      'RETURN dance as node'
    ];

    return this._db.queryOne( query, { id, dance } );
  },

  delete ( id ) {
    var query = [
      'MATCH (dance:Dance {id:{id}})',
      'DELETE dance'
    ];

    return this._db.query( query, { id } );
  },
})
;

export default Dances

