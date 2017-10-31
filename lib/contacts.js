// # Contacts

import {Factory} from 'administer';
import util from './utilities';
import Database from './database';

const ContactsForFeis = Factory( 'ContactsForFeis' )
.methods({
  one ( id ) {
    var query = [
      'MATCH (contact:Person {id:{id}})-[:CONTACTEE]->(feis:Feis {id:{fid}})',
      'WHERE contact :Person',
      'RETURN contact as node'
    ];

    return this._db.queryOne( query, { id, fid: this._id } );
  },

  delete ( id ) {
    var query = [
      'MATCH (contact:Person {id:{id}})-[:CONTACTEE]->(feis:Feis {id:{fid}})',
      'OPTIONAL MATCH contact-[r]-n',
      'WHERE contact :Person',
      'DELETE contact, r'
    ];

    return this._db.query( query, { id, fid: this._id } );
  },

  update ( id, props ) {
    props.id = id;

    var query = [
      'MATCH (contact:Person {id:{id}})-[:CONTACTEE]->(feis:Feis {id:{fid}})',
      'WHERE contact :Person',
      'SET contact = { props }',
      'RETURN contact as node'
    ];

    return this._db.queryOne( query, { id, fid: this._id, props } );
  },

  create ( props ) {
    props.id = util.helper.generateId();

    var query = [
      'MATCH (feis:Feis {id:{fid}})',
      'CREATE (contact:Person {props})-[:CONTACTEE]->feis',
      'RETURN contact as node'
    ];

    return this._db.queryOne( query, { fid: this._id, props } );
  },

  all () {
    var query = [
      'MATCH (contact:Person)-[:CONTACTEE]->(feis:Feis {id:{fid}})',
      'RETURN contact as node',
    ];

    return this._db.query( query, { fid: this._id });
  },
})
;

// The `Contacts` class manages feis contacts.
const Contacts = Factory( 'Contacts', {
  _db: Database,
})
.methods({
  for ( id ) {
    return ContactsForFeis({
      _db: this._db,
      _id: id,
    });
  },
})
;

export default Contacts;

