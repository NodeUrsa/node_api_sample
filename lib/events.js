// # Events

import { Factory } from 'administer';
import util from './utilities';
import Database from './database';
import _ from 'highland';
import transformEvent from './transform-event';
import Stages from './stages';

var AGE_STRING_REGEXP = /^([uo])?(\d+)&?(o|u)?$/i;

// Query to Detach an event from any schedule.
var detachFromStage = [
  'MATCH (before)-[oldbeflink:STAGE_LINK]->(event {id:{eid}})-[oldaftlink:STAGE_LINK]->(after)',
  'CREATE UNIQUE (before)-[:STAGE_LINK]->(after)',
  'DELETE oldbeflink, oldaftlink'
];

const EventsForFeis = Factory( 'EventsForFeis' )
.methods({
  one ( id ) {
    var query = [
      'MATCH (event:Event {id:{id}})-[:OF]->(feis:Feis {id:{fid}})',
      'WHERE event :Event',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { id, fid: this._id } )
      .map( transformEvent )
      .head();
  },

  delete ( id ) {
    var query = [
      'MATCH (event:Event {id:{id}})-[:OF]->(feis:Feis {id:{fid}})',
      'OPTIONAL MATCH event-[r]-n',
      'WHERE event :Event',
      'DELETE event, r'
    ];

    return this._stages.detachEvent( this._id, undefined, id )
      .collect()
      .flatMap( () => this._db.query( query, { id, fid: this._id } ) )
      ;
  },

  update ( id, props ) {
    props.id = id;

    var query = [
      'MATCH (event:Event {id:{id}})-[:OF]->(feis:Feis {id:{fid}})',
      'WHERE event :Event',
      'SET event = { props }',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { id, fid: this._id, props } )
      .map( transformEvent )
      .head();
  },

  create ( props ) {
    props.id = util.helper.generateId();

    var query = [
      'MATCH (feis:Feis {id:{fid}})',
      'CREATE (event:Event {props})-[:OF]->feis',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { fid: this._id, props } )
      .map( transformEvent )
      .head();
  },

  query ( filters = {} ) {
    filters.champs = filters.champs ? parseInt( filters.champs, 10 ) : undefined;

    // WHERE clause for regexp matching against an event's name, dance, or level.
    var filterExp = '("(?i).*" + {filter} + ".*")';
    var filter = [
      'AND (',
      `  ev.name =~ ${filterExp} OR ev.event =~ ${filterExp} OR ev.level =~ ${filterExp} OR ev.age =~ ${filterExp}`,
      `  OR ( CASE ev.type WHEN 'F' THEN 'figures' WHEN 'G' THEN 'grades' WHEN 'C' THEN 'championships' ELSE 'specials' END =~ ${filterExp} )`,
      ')'
    ].join( ' ' );

    var age_filter = [
      'AND ( (ev.age_min IS NULL AND ev.age_max IS NULL) OR (',
      '  (ev.age_min IS NULL AND {age} <= ev.age_max) OR',
      '  (ev.age_max IS NULL AND {age} >= ev.age_min) OR',
      '  (ev.age_min <= {age} AND ev.age_max >= {age})',
      '))'
    ].join( ' ' );

    var status_filter;
    switch ( filters.status ) {
      case 'PND':
        status_filter = 'AND (ev.is_ci_opened <> 1 OR ev.is_ci_opened IS NULL) AND (ev.is_ci_closed <> 1 OR ev.is_ci_closed IS NULL)';
        break;
      case 'CI':
        status_filter = 'AND ev.is_ci_opened = 1 AND ( ev.is_ci_closed = 0 OR ev.is_ci_closed IS NULL )';
        break;
      case 'RCL':
        status_filter = 'AND ev.is_in_results = 1 AND ev.recall = 1 AND (ev.is_announced IS NULL OR ev.is_announced = 0)';
        break;
      case 'RES':
        status_filter = 'AND ev.is_in_results = 1 AND (ev.recall IS NULL OR ev.is_announced = 1)';
        break;
      case 'QA':
        status_filter = 'AND ev.is_in_qa = 1 AND ( ev.is_in_results = 0 OR ev.is_in_results IS NULL )';
        break;
      case 'ADJ':
        status_filter = 'AND ev.is_ci_closed = 1 AND ( ev.is_in_tabs = 0 OR ev.is_in_tabs IS NULL )';
        break;
      case 'TABS':
        status_filter = 'AND ev.is_in_tabs = 1 AND ( ev.is_in_qa = 0 OR ev.is_in_qa IS NULL )';
        break;
      default:
        status_filter = 'AND false';
    }

    const statsQuery = [
      'OPTIONAL MATCH ev<-[:PARTICIPANT]-(person:Person {gender: "F"})',
      'WITH ev, feis, participants, count(DISTINCT person) AS females',

      'OPTIONAL MATCH ev<-[:PARTICIPANT]-(person:Person {gender: "M"})',
      'WITH ev, feis, participants, females, count(DISTINCT person) AS males',

      'OPTIONAL MATCH ev<-[:PARTICIPANT]-(person:Person)-[:DEPENDENT_OF*0..1]-(:Account)--(:Payment)--feis',
      'WITH ev, feis, participants, females, males, count(DISTINCT person) AS paid',
    ];

    let query = [
      'MATCH (ev:Event)-[:OF]->(feis:Feis {id:{fid}})',
      'WHERE (ev.inactive IS NULL or ev.inactive <> 1)',
      filters.type ? `AND ev.type = "${filters.type}"` : '',

      // If a filter was provided, incorporate it.
      filters.filter ? filter : '',

      // If the champs filter is on, filter out the grades - but ignore it if we're regex filtering too.
      filters.champs === 1 && ! filters.filter ? 'AND ev.type <> "G"' : '',
      filters.champs === 0 && ! filters.filter ? 'AND ev.type <> "C"' : '',

      // If an age filter was provided, use it - but ignore it if we're regex filtering too.
      filters.age && ! filters.filter ? age_filter : '',

      // If a status filter was provided, use it.
      filters.status ? status_filter : '',

      // If recalls were requested, limit to those with announcements, past or present.
      filters.recall ? 'AND ev.recall = 1' : '',

      'WITH ev, feis',

      // Optionally bring in the participants count
      'OPTIONAL MATCH ev<-[:PARTICIPANT]-(person:Person)',
      'WITH ev, feis, count(person) as participants',
    ];

    // Optionally bring in the stats
    if ( filters.stats ) {
      query = [ ...query, ...statsQuery ];
    }

    query = [
      ...query,

      // Return just the events, ordering by name first, ID second.
      `RETURN ev, participants ${filters.stats ? ', females, males, paid' : ''}`,
      'ORDER BY ev.name, ev.id ASC',

      // If pagination was provided, apply that too.
      filters.skip ? 'SKIP {skip}' : '',
      filters.limit ? 'LIMIT {limit}' : ''
    ];

    return this._db.queryMultiple( query, {
      fid: this._id,
      filter: filters.filter,
      age: filters.age ? parseInt( filters.age, 10 ) : undefined,
      limit: filters.limit ? parseInt( filters.limit, 10 ) : undefined,
      skip: filters.skip ? parseInt( filters.skip, 10 ) : undefined
    }).map( res => {
      const event = transformEvent( res.ev );
      event.participants = res.participants;

      if ( filters.stats ) {
        event.males = res.males;
        event.females = res.females;
        event.paid = res.paid;
        event.unpaid = res.participants - res.paid;
      }

      return event;
    });
  },

  printQueue () {
    const queues = {
      recall: [],
      placements: [],
    };

    return this.query({ status: 'RES' })
      .filter( ev => ! ev.prntd_places )
      .collect()
      .flatMap( events => {
        queues.placements = events;

        return this.query({ status: 'RCL' })
      })
      .filter( ev => ! ev.prntd_recall )
      .collect()
      .map( events => {
        queues.recall = events;

        return queues;
      })
      .head()
      ;
  },

  participants ( id ) {
    var query = [
      'MATCH (event:Event {id:{id}})-[:OF]->(feis:Feis {id:{fid}})',
      ', event<-[reg:PARTICIPANT]-(person:Person)',
      ', feis<-[feisreg:REGISTERED]-person',
      'WITH event, feisreg, reg, person',
      'OPTIONAL MATCH (school:School)<-[:ATTENDS]-person',
      'RETURN DISTINCT feisreg, reg, person, school',
    ];

    return this._db.queryMultiple( query, { id, fid: this._id } )
      .map( ( res ) => {
        if ( res.school ) {
          res.person.school = res.school;
        }

        res.person.competitor = res.feisreg.num;
        res.person.reg = res.reg;

        return res.person;
      });
  },

  // TODO: remove all `inactive` events from all event queries!
  merge ( event_a, event_b, props ) {
    props.id = util.helper.generateId();

    var mergeEvents = [
      'MATCH (feis:Feis {id:{fid}})',
      ', feis<-[:OF]-(event_a:Event {id:{eaid}})',
      ', feis<-[:OF]-(event_b:Event {id:{ebid}})',

      // Create the new event
      'CREATE feis<-[:OF]-(event:Event {props})',
      'CREATE event<-[:TRANSFORMED]-event_a',
      'CREATE event<-[:TRANSFORMED]-event_b',

      // Deactivate the old events
      'SET event_a.inactive = 1',
      'SET event_b.inactive = 1',

      'WITH event_a, event_b, event',

      // Get the participants
      'OPTIONAL MATCH event_a<-[:PARTICIPANT]-(persons_a:Person)',
      'OPTIONAL MATCH event_b<-[:PARTICIPANT]-(persons_b:Person)',

      // Moving on...
      'WITH event',
      ', collect(persons_a) as persons1',
      ', collect(persons_b) as persons2',

      // Assign the persons to their respective events
      'FOREACH (p in persons1 | CREATE UNIQUE p-[:PARTICIPANT]->event)',
      'FOREACH (p in persons2 | CREATE UNIQUE p-[:PARTICIPANT]->event)',

      // Return the newly-created events
      'RETURN event as node'
    ];

    var event;
    return this._db.queryOne( mergeEvents, { eaid: event_a, ebid: event_b, fid: this._id, props })
      .map( transformEvent )
      .map( ( e ) => event = e )

      // Remove the old events from all schedules.
      // We call `collect` to ensure the next map runs even if the previous query returned no
      // results.
      .flatMap( () => {
        return this._db.queryOne( detachFromStage, { eid: event_a } );
      })
      .collect()

      .flatMap( () => {
        return this._db.queryOne( detachFromStage, { eid: event_b } );
      })
      .collect()

      // We really only care about the created event.
      .map( () => event )
      .head();
  },

  split ( eid, props1, persons1, props2, persons2 ) {
    props1.id = util.helper.generateId();
    props2.id = util.helper.generateId();

    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(oldevent:Event {id:{eid}})',

      // Create the new events
      'CREATE feis<-[:OF]-(event1:Event {props1})<-[:TRANSFORMED]-oldevent',
      ', feis<-[:OF]-(event2:Event {props2})<-[:TRANSFORMED]-oldevent',

      'WITH oldevent, event1, event2',

      // Get the participants
      'OPTIONAL MATCH oldevent<-[:PARTICIPANT]-(person:Person)',

      // Deactivate the old event
      'SET oldevent.inactive = 1',

      // Moving on...
      'WITH',
      '  event1',
      ', event2',
      ', [e in collect(person) WHERE e.id IN { persons1 }] as persons1',
      ', [e in collect(person) WHERE e.id IN { persons2 }] as persons2',

      // Assign the persons to their respective events
      'FOREACH (p in persons1 | CREATE p-[:PARTICIPANT]->event1)',
      'FOREACH (p in persons2 | CREATE p-[:PARTICIPANT]->event2)',

      // Return the newly-created events
      'RETURN event1, event2'
    ];

    var res;
    return this._db.queryMultiple( query, { fid: this._id, eid, props1, props2, persons1, persons2 })
      .map( ( e ) => res = e )

      // Remove the old event from all schedules.
      // We call `collect` to ensure the next map runs even if the previous query returned no
      // results.
      .flatMap( () => {
        return this._db.queryOne( detachFromStage, { eid } );
      })
      .collect()

      // We really only care about the created events.
      .map( () => [ res.event1, res.event2 ] )
      .flatten()
      .map( transformEvent )
      .collect()
      .head();
  },

  openCheckIn ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.is_ci_closed = 0',
      'SET event.is_ci_opened = 1',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  closeCheckIn ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.is_ci_closed = 1',
      'SET event.is_ci_opened = 0',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  checkin ( eid, pid ) {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})<-[reg:PARTICIPANT]-(person:Person {id:{pid}})',
      ', feis<-[feisreg:REGISTERED]-person',
      'SET reg.is_checked_in = 1',
      'RETURN DISTINCT feisreg, reg, person, event'
    ];

    return this._db.queryMultiple( query, { eid, pid, fid: this._id })
      .map( ( res ) => {
        res.reg.event = transformEvent( res.event );
        res.reg.person = res.person;
        res.reg.person.competitor = res.feisreg.num;

        return res.reg;
      })
      .head();
  },

  checkout ( eid, pid ) {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})<-[reg:PARTICIPANT]-(person:Person {id:{pid}})',
      ', feis<-[feisreg:REGISTERED]-person',
      'SET reg.is_checked_in = 0',
      'RETURN DISTINCT feisreg, reg, person, event'
    ];

    return this._db.queryMultiple( query, { eid, pid, fid: this._id })
      .map( ( res ) => {
        res.reg.event = transformEvent( res.event );
        res.reg.person = res.person;
        res.reg.person.competitor = res.feisreg.num;

        return res.reg;
      })
      .head();
  },

  updateRegistration ( eid, pid, reg ) {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})<-[reg:PARTICIPANT]-(person:Person {id:{pid}})',
      ', feis<-[feisreg:REGISTERED]-person',
      'SET reg = {reg}',
      'RETURN DISTINCT feisreg, reg, person, event'
    ];

    return this._db.queryMultiple( query, { eid, pid, fid: this._id, reg })
      .map( ( res ) => {
        res.reg.event = transformEvent( res.event );
        res.reg.person = res.person;
        res.reg.person.competitor = res.feisreg.num;

        return res.reg;
      })
      .head();
  },

  orderParticipants ( eid, order ) {
    /**
     * order is an array of objects: `{ id: "person_id", order: 1 }`
     */
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})<-[reg:PARTICIPANT]-(person:Person)',
      ', feis<-[feisreg:REGISTERED]-person',
      'WHERE person.id IN extract(p IN {order} | p.id)',
      'SET reg.order=head(extract(p IN filter(t in {order} WHERE person.id = t.id) | p.order))',
      'RETURN DISTINCT feisreg, reg, person, event'
    ];

    return this._db.queryMultiple( query, {
      eid,
      order,
      fid: this._id
    })
    .map( ( res ) => {
      res.reg.event = transformEvent( res.event );
      res.reg.person = res.person;
      res.reg.person.competitor = res.feisreg.num;

      return res.reg;
    })
    .head();
  },

  checkInToTabs ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.is_in_tabs = 1, event.is_in_qa = 0',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  /**
   * Return the event to its virgin state, retaining all participant and scoring information.
   */
  reset ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.is_ci_opened = 0',
      '  , event.is_ci_closed = 0',
      '  , event.is_in_tabs = 0',
      '  , event.is_in_qa = 0',
      '  , event.is_in_results = 0',
      '  , event.is_announced = 0',
      '  , event.prntd_recall = 0',
      '  , event.prntd_places = 0',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  sendToQa ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.is_in_qa = 1',

      // We need to ensure, if the event was "in results", that any status flags are reset.
      '  , event.is_in_results = 0',
      '  , event.is_announced = 0',
      '  , event.prntd_recall = 0',
      '  , event.prntd_places = 0',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  sendToResults ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.is_in_results = 1',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  setAnnounced ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.is_announced = 1',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  setRecallsPrinted ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.prntd_recall = 1',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  setPlacementsPrinted ( eid ) {
    var query = [
      'MATCH (event:Event {id:{eid}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET event.prntd_places = 1',
      'RETURN event as node'
    ];

    return this._db.queryOne( query, { eid, fid: this._id }).map( transformEvent ).head();
  },

  collectAward ( eid, pid ) {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})<-[score:PARTICIPANT]-(person:Person {id:{pid}})',
      'SET score.collected = 1'
    ];

    return this._db.query( query, { eid, pid, fid: this._id });
  },

  returnAward ( eid, pid ) {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})<-[score:PARTICIPANT]-(person:Person {id:{pid}})',
      'SET score.collected = 0'
    ];

    return this._db.query( query, { eid, pid, fid: this._id });
  },
})
;

// The `Events` class manages competition events.
const Events = Factory( 'Events', {
  _db: Database,
  _stages: Stages,
})
.methods({
  for ( id ) {
    return EventsForFeis({ _db: this._db, _stages: this._stages, _id: id });
  },
})
;

export default Events;

