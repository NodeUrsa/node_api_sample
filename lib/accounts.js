// # Accounts

import { Factory } from 'administer';
import Database from './database'
import util from './utilities'

// The `Accounts` class is responsible for CRUD operations as it relates to accounts. However, due
// to how closely accounts are related to auth2, the methods for creating accounts are found in the
// `Auth2` module.
const Accounts = Factory( 'Accounts', {
  _db: Database,
})
.methods({
  // `getOne` fetches a single account from the database by its ID.
  getOne( id ) {
    var query = [
      'MATCH (acct:Account {id:{id}})',
      'RETURN acct as node'
    ];

    return this._db.queryOne( query, { id } );
  },

  // `getOneByEmail` fetches a single account from the database by its email address.
  getOneByEmail( email ) {
    var query = [
      'MATCH (acct:Account {email:{email}})',
      'RETURN acct as node'
    ];

    return this._db.queryOne( query, { email } );
  },

  update( id, person ) {
    person.id = id;

    var query = [
      'MATCH (person:Account {id:{id}})',
      'SET person = { person }',
      'RETURN person as node'
    ];

    return this._db.queryOne( query, { id, person } );
  },

  getDependents( id ) {
    var query = [
      'MATCH (acct:Account {id:{id}})<-[:DEPENDENT_OF]-(person:Person)-[:ATTENDS]->(school:School)',
      'RETURN person, school'
    ];

    return this._db.queryMultiple( query, { id } )
      .map( ( row ) => {
        row.person.school = row.school;

        return row.person;
      });
  },

  getFromPerson ( id ) {
    var query = [
      'MATCH (person:Person {id:{id}})',
      'OPTIONAL MATCH (account:Account)<-[:DEPENDENT_OF]-person',
      'WITH CASE WHEN account IS NULL THEN person ELSE account END AS acct',
      'RETURN acct as node',
      'LIMIT 1'
    ];

    return this._db.queryOne( query, { id } );
  },

  createDependent( id, school, person ) {
    person.id = util.helper.generateId();

    var query = [
      'MATCH (acct:Account {id:{id}}), (school:School {id:{school}})',
      'CREATE school<-[:ATTENDS]-(person:Person {person})-[:DEPENDENT_OF]->acct',
      'RETURN person, school'
    ];

    return this._db.queryMultiple( query, { id, person, school } )
      .map( ( row ) => {
        row.person.school = row.school;

        return row.person;
      })
      .head();
  },

  updateDependent( id, sid, person ) {
    var query = [
      'MATCH (acct:Account {id:{id}})<-[:DEPENDENT_OF]-(person:Person {id:{pid}})-[oldschoolrel:ATTENDS]->(:School)',
      ', (school:School {id:{sid}})',
      'CREATE person-[:ATTENDS]->school',
      'DELETE oldschoolrel',
      'SET person = { person }',
      'RETURN person, school'
    ];

    return this._db.queryMultiple( query, { id, person, sid, pid: person.id } )
      .map( ( row ) => {
        row.person.school = row.school;

        return row.person;
      })
      .head();
  },

  connectStripe ( aid, fid, token ) {
    const sid = util.helper.generateId();
    const query = [
      'MATCH (acct:Account {id:{aid}}), (feis:Feis {id:{fid}})',
      'MERGE acct<-[:BY]-(stripe:StripeAccount {token:{token}})',
      'ON CREATE SET stripe.id = {sid}, stripe.created_at = timestamp()',
      'ON MATCH SET stripe.updated_at = timestamp()',
      'SET stripe.token = {token}',
      ', stripe.status = "ACTIVE"',
      ', stripe.updated_at = timestamp()',
      'CREATE UNIQUE stripe<-[:PAYEE]-feis',
      'RETURN stripe as node',
    ];

    return this._db.queryOne( query, { aid, sid, fid, token });
  }
})
;

export default Accounts;

