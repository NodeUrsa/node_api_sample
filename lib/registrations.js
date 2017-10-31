// # Registrations

import { Factory } from 'administer';
import util from './utilities';
import Database from './database';
import transformEvent from './transform-event'
import _ from 'highland';
import { BadRequest } from '../server/ext/errors';

const RegistrationsForPerson = Factory( 'RegistrationsForPerson' )
.methods({
  all () {
    var query = [
      'MATCH (person:Person {id:{pid}})-[reg:PARTICIPANT]->(event:Event)-[:OF]->(feis:Feis {id:{fid}})', 
      'WHERE event.inactive IS NULL or event.inactive <> 1',
      // Optionally bring in the number of participants
      'WITH event, reg, person',
      'OPTIONAL MATCH event<-[:PARTICIPANT]-(participant:Person)',
      'WITH event, reg, person, count(participant) as participants',

      'RETURN reg, person, event, participants'
    ];

    return this._db.queryMultiple( query, {
      fid: this._fid,
      pid: this._pid
    }).map( function ( res ) {
      res.reg.event = transformEvent( res.event );
      res.reg.event.participants = res.participants;
      return res.reg;
    });
  },

  delete ( eid ) {
    var query = [
      'MATCH (person:Person {id:{pid}})-[reg:PARTICIPANT]->(event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})', 
      'DELETE reg'
    ];

    return this._db.query( query, {
      eid,
      fid: this._fid,
      pid: this._pid
    });
  },

  create ( eid ) {
    var query = [
      // First get the highest competitor number in the system, or '100' if none
      'MATCH (feis:Feis {id:{fid}})',
      'OPTIONAL MATCH feis<-[r:REGISTERED]-()',
      'WITH feis, CASE WHEN count(r) = 0 THEN 101 ELSE MAX(r.num) + 1 END AS max_reg',

      // Then match the person to an account the feis can see (i.e. they 'Saved' the feis)
      'MATCH (acct:Account)<-[:DEPENDENT_OF*0..1]-(person:Person {id:{pid}})',
      'MERGE feis<-[reg:SAVED]-acct',
      'ON CREATE set reg.assess_late_fee = CASE WHEN feis.dt_reg_late < timestamp() THEN 1 ELSE 0 END',
      'MERGE feis<-[r:REGISTERED]-person ON CREATE SET r.num = max_reg',
      'WITH person, feis, r as feisreg',

      // Finally, create the registration, ensuring the uniqueness of the relationship.
      'MATCH (event:Event {id:{eid}})-[:OF]->feis',
      'CREATE UNIQUE person-[reg:PARTICIPANT]->event',
      'RETURN reg, person, event, feisreg',
    ];

    return this._db.queryMultiple( query, {
      eid,
      fid: this._fid,
      pid: this._pid
    }).map( function ( res ) {
      res.reg.event = transformEvent( res.event );
      res.reg.person = res.person;
      res.reg.person.competitor = res.feisreg.num;
      return res.reg;
    }).head();
  },

  changeNum ( num ) {
    var query = [
      // First get the highest competitor number in the system, or '100' if none
      'MATCH (feis:Feis {id:{fid}})',
      'OPTIONAL MATCH feis<-[r:REGISTERED]-(:Person)',
      'WHERE r.num = {num}',
      'RETURN feis, r'
    ];

    var changeNumQuery = [
      'MATCH (feis:Feis {id:{fid}})<-[reg:REGISTERED]-(person:Person {id:{pid}})',
      'SET reg.num = {num}',
      'RETURN reg, person'
    ];

    return this._db.queryMultiple( query, { num, fid: this._fid })
      .flatMap( ( res ) => {
        if ( res.r ) {
          throw BadRequest( 'Competitor number already in use.' );
        }

        return this._db.queryMultiple( changeNumQuery, { num, pid: this._pid, fid: this._fid } );
      })
      .map( function ( res ) {
        res.person.competitor = res.reg.num;
        return res.person;
      })
      .head();
  },
})
;

const RegistrationsForFeis = Factory( 'RegistrationsForFeis' )
.methods({
  person ( id ) {
    return RegistrationsForPerson({ _db: this._db, _fid: this._fid, _pid: id } );
  },
})
;

// The `Registrations` class manages competition registrations.
const Registrations = Factory( 'Registrations', {
  _db: Database,
})
.methods({
  feis ( id ) {
    return RegistrationsForFeis({ _db: this._db, _fid: id } );
  },
})
;

export default Registrations;

