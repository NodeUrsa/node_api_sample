// # Accommodations

import {Factory} from 'administer';
import util from './utilities';
import Database from './database';

const AccommodationsForFeis = Factory( 'AccommodationsForFeis' )
.methods({
  one ( id ) {
    var query = [
      'MATCH (accom:Accommodation {id:{id}})-[:FOR]->(feis:Feis {id:{fid}})',
      'WHERE accom :Accommodation',
      'RETURN accom as node'
    ];

    return this._db.queryOne( query, { id, fid: this._id } );
  },

  delete ( id ) {
    var query = [
      'MATCH (accom:Accommodation {id:{id}})-[:FOR]->(feis:Feis {id:{fid}})',
      'OPTIONAL MATCH accom-[r]-n',
      'WHERE accom :Accommodation',
      'DELETE accom, r'
    ];

    return this._db.query( query, { id, fid: this._id } );
  },

  update ( id, props ) {
    props.id = id;

    var query = [
      'MATCH (accom:Accommodation {id:{id}})-[:FOR]->(feis:Feis {id:{fid}})',
      'WHERE accom :Accommodation',
      'SET accom = { props }',
      'RETURN accom as node'
    ];

    return this._db.queryOne( query, { id, fid: this._id, props } );
  },

  create ( props ) {
    props.id = util.helper.generateId();

    var query = [
      'MATCH (feis:Feis {id:{fid}})',
      'CREATE (accom:Accommodation {props})-[:FOR]->feis',
      'RETURN accom as node'
    ];

    return this._db.queryOne( query, { fid: this._id, props } );
  },

  all () {
    var query = [
      'MATCH (accom:Accommodation)-[:FOR]->(feis:Feis {id:{fid}})',
      'RETURN accom as node',
    ];

    return this._db.query( query, { fid: this._id });
  },
})
;

// The `Accommodations` class manages feis accoms.
const Accommodations = Factory( 'Accommodations', {
  _db: Database,
})
.methods({
  for ( id ) {
    return AccommodationsForFeis({
      _id: id,
      _db: this._db,
    });
  },
})
;

export default Accommodations;

