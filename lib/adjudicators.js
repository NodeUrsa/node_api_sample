// # Adjudicators

import { Factory } from 'administer';
import Database from './database'
import util from './utilities'

// The `Adjudicators` class is responsible for CRUD operations as it relates to adjs.
const Adjudicators = Factory( 'Adjudicators', {
  _db: Database,
})
.methods({
  // `get` fetches all adjs from the system.
  get() {
    var query = [
      'MATCH (adj:Adjudicator)',
      'RETURN adj as node'
    ];

    return this._db.query( query );
  },

  one( id ) {
    var query = [
      'MATCH (adj:Adjudicator {id:{id}})',
      'RETURN adj as node'
    ];

    return this._db.queryOne( query, { id } );
  },

  create ( adj ) {
    adj.id = util.helper.generateId();

    var query = [
      'CREATE (adj:Adjudicator {adj})',
      'RETURN adj as node;'
    ];

    return this._db.queryOne( query, { adj } );
  },

  update ( id, adj ) {
    adj.id = id;

    var query = [
      'MATCH (adj:Adjudicator {id:{id}})',
      'SET adj = {adj}',
      'RETURN adj as node'
    ];

    return this._db.queryOne( query, { id, adj } );
  },

  delete ( id ) {
    var query = [
      'MATCH (adj:Adjudicator {id:{id}})',
      'DELETE adj'
    ];

    return this._db.query( query, { id } );
  },
})
;

export default Adjudicators;

