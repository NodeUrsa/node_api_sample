// # Stages

import { Factory } from 'administer';
import Database from './database'
import util from './utilities'
import transformEvent from './transform-event';
import {BadRequest} from '../server/ext/errors';

import _ from 'highland';

var withStageGetScheduleToo = [
    'WITH stage',
    'OPTIONAL MATCH p=(stage)-[:STAGE_LINK*0..]->(item)',
    'WHERE item <> stage',
    'OPTIONAL MATCH (item)<-[:PARTICIPANT]-(person:Person)',
    'WITH stage, item, CASE WHEN item:StagePlaceholder THEN 1 ELSE 0 END AS ph, count(person) as nump, length(p) as depth',
    'ORDER BY depth',
    'RETURN stage.id as id, stage.name as name',
    '  , CASE WHEN count(item) > 0 THEN collect({id:item.id, placeholder:ph, participants:nump})',
    '    ELSE [] END as events',
];

const Stages = Factory( 'Stages', {
  _db: Database,
})
.methods({
  all ( feis_id ) {
    var query = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage)',
      'RETURN stage as node'
    ];

    return this._db.query( query, { feis_id } );
  },

  events ( feis_id ) {
    var query = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:OF]-(event:Event)',
      'WHERE NOT event<-[:STAGE_LINK]-()',
      '  AND (event.inactive IS NULL or event.inactive <> 1)',
      'OPTIONAL MATCH event<-[:PARTICIPANT]-(person:Person)',
      'WITH event as item, count(person) as participants',
      'ORDER BY item.name',
      'RETURN item.id AS id, participants',
    ];

    return this._db.queryMultiple( query, { feis_id } );
  },

  create ( feis_id, props = {} ) {
    props.id = util.helper.generateId();

    var query = [
      'MATCH (feis:Feis {id:{feis_id}})',
      'CREATE feis<-[:AT]-(stage:Stage {props})-[:STAGE_LINK]->(stage)',
      'RETURN stage.id as id, stage.name as name, [] as events'
    ];

    return this._db.queryMultiple( query, { feis_id, props } ).head();
  },

  one ( feis_id, stage_id ) {
    var query = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage {id:{stage_id}})',
      // 'RETURN stage as node'
    ].concat( withStageGetScheduleToo );

    return this._db.queryMultiple( query, { feis_id, stage_id } ).head();
  },

  update ( feis_id, stage_id, props ) {
    var query = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage {id:{stage_id}})',
      'SET stage = {props}',
    ].concat( withStageGetScheduleToo );

    return this._db.queryMultiple( query, { feis_id, stage_id, props } ).head();
  },

  schedule ( feis_id, stage_id ) {
    var query = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage {id:{stage_id}})',
      ', p=stage-[:STAGE_LINK*0..]->(item)',
      'WHERE item <> stage',
      'OPTIONAL MATCH item<-[:PARTICIPANT]-(person:Person)',
      'WITH stage, item.id as id, CASE WHEN item:StagePlaceholder THEN 1 ELSE 0 END AS placeholder, count(person) as participants, length(p) as depth',
      'ORDER BY depth',
      // 'RETURN id, placeholder, CASE participants WHEN NULL THEN 0 ELSE participants END AS participants'
      'RETURN stage, collect({id:id, placeholder:placeholder, participants:participants}) as events',
    ];

    return this._db.queryMultiple( query, { feis_id, stage_id } ).head();
  },

  attachEvent ( feis_id, stage_id, before_event_id = 'FAKE', event_id, after_event_id = 'FAKE' ) {
    var isAttachedQuery = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage)-[:STAGE_LINK*1..]->(event:Event {id:{event_id}})',
      'RETURN event as node'
    ];

    var attachQuery = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage {id:{stage_id}})',
      ', (event:Event {id:{event_id}})',
      ', (stage)-[:STAGE_LINK*0..]->(before)',
      ', (after)-[:STAGE_LINK*0..]->(stage)',
      ', (before)-[oldlink:STAGE_LINK]->(after)',
      'WHERE ( after.id = {after_event_id} OR after = stage )',
      '  AND ( before.id = {before_event_id} OR before = stage )',
      'CREATE UNIQUE (before)-[:STAGE_LINK]->(event)-[:STAGE_LINK]->(after)',
      'DELETE oldlink',
    ].concat( withStageGetScheduleToo );

    return this._db.queryOne( isAttachedQuery, { feis_id, event_id } )
      .collect()
      .flatMap( matches => {
        if ( matches.length > 0 ) {
          return BadRequest( 'Events cannot be attached to multiple stages.' );
        }

        return this._db.queryMultiple( attachQuery, { feis_id, stage_id, after_event_id, before_event_id, event_id } )
      })
      // .flatMap( () => this.one( feis_id, stage_id ) )
      .head()
      ;
  },

  // stage_id is optional, but makes the query more efficient. When we don't know the stage, we
  // support omitting it.
  detachEvent ( feis_id, stage_id, event_id ) {
    var query = [
      `MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage ${stage_id ? '{id:{stage_id}}' : ''})`,
      ', (stage)-[:STAGE_LINK*0..]->(before)',
      ', (before)-[oldbeflink:STAGE_LINK]->(event {id:{event_id}})-[oldaftlink:STAGE_LINK]->(after)',
      ', (after)-[:STAGE_LINK*0..]->(stage)',
      'CREATE UNIQUE (before)-[:STAGE_LINK]->(after)',
      'DELETE oldbeflink, oldaftlink'
    ];
    
    if ( stage_id ) {
      query = query.concat( withStageGetScheduleToo );
    }

    return this._db.queryMultiple( query, { feis_id, stage_id, event_id } )
      .head()
      ;
  },

  attachPlaceholder ( feis_id, stage_id, before_event_id = 'FAKE', after_event_id = 'FAKE' ) {
    var placeholder = { id: util.helper.generateId() };

    var query = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage {id:{stage_id}})',
      ', (stage)-[:STAGE_LINK*0..]->(before)',
      ', (after)-[:STAGE_LINK*0..]->(stage)',
      ', (before)-[oldlink:STAGE_LINK]->(after)',
      'WHERE ( after.id = {after_event_id} OR after = stage )',
      '  AND ( before.id = {before_event_id} OR before = stage )',
      'CREATE UNIQUE (before)-[:STAGE_LINK]->(placeholder:StagePlaceholder {placeholder})-[:STAGE_LINK]->(after)',
      'DELETE oldlink',
    ].concat( withStageGetScheduleToo );

    return this._db.queryMultiple( query, { feis_id, stage_id, after_event_id, before_event_id, placeholder } )
      // .flatMap( () => this.one( feis_id, stage_id ) )
      .head()
      ;
  },

  detachPlaceholder ( feis_id, stage_id, placeholder_id ) {
    var query = [
      'MATCH (feis:Feis {id:{feis_id}})<-[:AT]-(stage:Stage {id:{stage_id}})',
      ', (stage)-[:STAGE_LINK*0..]->(before)',
      ', (before)-[oldbeflink:STAGE_LINK]->(placeholder:StagePlaceholder {id:{placeholder_id}})-[oldaftlink:STAGE_LINK]->(after)',
      ', (after)-[:STAGE_LINK*0..]->(stage)',
      'CREATE UNIQUE (before)-[:STAGE_LINK]->(after)',
      'DELETE oldbeflink, oldaftlink, placeholder'
    ].concat( withStageGetScheduleToo );

    return this._db.queryMultiple( query, { feis_id, stage_id, placeholder_id } )
      // .flatMap( () => this.one( feis_id, stage_id ) )
      .head()
      ;
  },

  remove ( feis_id, stage_id ) {
    var rmEventsQuery = [
      'MATCH (:Feis {id:{feis_id}})<-[:AT]-(stage:Stage {id:{stage_id}})-[r:STAGE_LINK*0..]->(item)',
      'WITH r, item',
      'UNWIND r as link',
      'DELETE link',
      'WITH item',
      'MATCH (item:StagePlaceholder)',
      'DELETE item'
    ];

    var rmStageQuery = [
      'MATCH (feis:Feis {id:{feis_id}})<-[rat:AT]-(stage:Stage {id:{stage_id}})',
      'DELETE rat, stage'
    ];

    return _( ( push, next ) => {
      this._db.query( rmEventsQuery, { feis_id, stage_id } )
        .apply( () => {
          this._db.query( rmStageQuery, { feis_id, stage_id } )
          .apply( () => {
            push( null, _.nil );
          });
        });
    });
  },
})
;

export default Stages;

