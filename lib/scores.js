// # Adjudication

import { Factory } from 'administer';
import Database from './database';
import util from './utilities';
import _ from 'highland';
import {ScoreCalculator} from 'ifeis-isomorphic';
import Events from './events';

// scores.for( fid ).event( eid ).adjudicator( aid ).all();
const ScoreQuery = Factory( 'ScoreQuery' )
.methods({
  event ( eid ) {
    this._eid = eid;
    return this;
  },

  adjudicator ( aid ) {
    this._aid = aid;
    return this;
  },

  all () {
    if ( this._aid && this._eid ) {
      return this._allFromAdjudicator();
    }
  },

  deleteAll () {
    if ( this._aid && this._eid ) {
      return this._deleteAllFromAdjudicator();
    }
  },

  adjudicators () {
    if ( this._eid ) {
      return this._allAdjudicators();
    }
  },

  _allAdjudicators () {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})',
      '  , event<-[:FOR]-(score:Score)-[:BY]->(adj:Adjudicator)',
      'RETURN DISTINCT adj as node',
      'ORDER by adj.lname, adj.fname'
    ];

    var params = { eid: this._eid, fid: this._fid };
    return this._db.query( query, params );
  },

  _allFromAdjudicator () {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})',
      '  , event<-[:FOR]-(score:Score)-[:BY]->(adj:Adjudicator {id:{aid}})',
      '  , score-[:OF]->(person:Person)-[ereg:PARTICIPANT]->event',
      '  , person-[freg:REGISTERED]->feis',
      'RETURN score, person.id as person, freg.num as competitor, ereg.order as order',
      'ORDER BY score.created_at, order, competitor, person'
    ];

    var scores = {}, score;
    var params = { aid: this._aid, eid: this._eid, fid: this._fid };
    return this._db.queryMultiple( query, params )

      // We want scores rolled up by person, so we store them in an object keyed by the person's ID.
      // Then we store the scores by round in an object and track the adjudicator.
      .map( row => {
        if ( ! scores[ row.person ] ) {
          scores[ row.person ] = {
            person: row.person,
            competitor: row.competitor
          };
        }

        score = scores[ row.person ];

        if ( ! score._rounds ) {
          score._rounds = {};
        }

        score._rounds[ row.score.round ] = row.score;
        row.score.adjudicator = this._aid;

        return score;
      })

      // We actually don't care about the original stream anymore, so let's collapse it into one
      // array, ignore the result, and map the scores we previously mapped to a unique person to a
      // new stream of values to replace it.
      .collect()
      .flatMap( () => _.values( scores ) )

      // Now we just need to translate the rounds object into a sorted array.
      .map( score => {
        score.scores = Object.keys( score._rounds ).sort().map( key => score._rounds[ key ] );

        // We don't want the temporary rounds object anymore.
        delete score._rounds;

        return score;
      });
  },

  update ( sid, score ) {
    var query = [
      'MATCH (:Feis {id:{fid}})<-[:OF]-(:Event {id:{eid}})<-[:FOR]-(score:Score {id:{sid}})',
      '  , score-[:BY]->(adj:Adjudicator {id:{aid}})',
      'SET score = { score }',
      'RETURN score as node'
    ];

    return this._db.queryOne( query, {
      aid: this._aid,
      eid: this._eid,
      fid: this._fid,
      sid,
      score
    });
  },

  delete ( sid, score ) {
    if ( sid ) {
      return this._deleteOne( sid, score );
    } else {
      return this._deleteAllFromAdjudicator();
    }
  },

  _deleteOne ( sid ) {
    var query = [
      'MATCH (:Feis {id:{fid}})<-[:OF]-(:Event {id:{eid}})<-[f:FOR]-(score:Score {id:{sid}})',
      'OPTIONAL MATCH score-[r]-()',
      'DELETE score, r, f'
    ];

    return this._db.query( query, {
      aid: this._aid,
      eid: this._eid,
      fid: this._fid,
      sid
    });
  },

  _deleteAllFromAdjudicator () {
    var query = [
      'MATCH (:Feis {id:{fid}})<-[:OF]-(:Event {id:{eid}})<-[rf:FOR]-(score:Score)',
      '  , score-[rb:BY]->(adj:Adjudicator {id:{aid}})',
      '  , score-[ro:OF]->(person:Person)',
      'DELETE rf, rb, ro, score'
    ];

    return this._db.query( query, { aid: this._aid, eid: this._eid, fid: this._fid } );
  },

  create ( pid, score ) {
    var sid = util.helper.generateId();

    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})',
      ', (adj:Adjudicator {id:{aid}})',
      ', (person:Person {id:{pid}})-[:PARTICIPANT]->event',
      'CREATE event<-[:FOR]-(score:Score {score})-[:BY]->adj',
      '  , score-[:OF]->person',
      'SET score.id = {sid}',
      '  , score.created_at = timestamp()',
      'RETURN score as node'
    ];

    var params = {
      aid: this._aid,
      eid: this._eid,
      fid: this._fid,
      score,
      pid,
      sid
    };
    return this._db.queryOne( query, params ).map( score => {
      score.adjudicator = this._aid;
      return score;
    }).head();
  },

  calculatePlacements ( eid, details = false ) {
    var event;
    var persons;
    var scores;
    var query = new ScoreQuery({ _db: this._db, _events: this._events, _fid: this._fid });

    var pipeline = _.pipeline(
      _.flatMap( eid => this._events.for( this._fid ).one( eid ) ),

      // Get the participants
      _.flatMap( e => {
        event = e;
        return this._events.for( this._fid ).participants( e.id );
      }),
      _.collect(),
      _.map( p => {
        persons = p;
        scores = new ScoreCalculator( event, persons );
        return event;
      }),

      // Get the adjudicators
      _.flatMap( event => query.event( event.id ).adjudicators() ),

      // Get a scoresheet for each adjudicator
      // Flatten will flatten our arrays or scores too, which we need to stay together per
      // scoresheet, so we temporarily wrap each array in an object, flatten the streams, and then
      // pluck the array from the object again.
      _.flatMap( a => new ScoreQuery({ _db: this._db, _events: this._events, _fid: this._fid }).event( eid ).adjudicator( a.id ).all().collect().map( s => ({s}) ) ),
      _.pluck( 's' ),
      _.map( scoresheet => scores.addScoresheet( [].concat( scoresheet ) ) ),

      // Finally, run the calculations - but once
      _.collect(),
      _.map( () => scores.calculate() ),
      _.flatten(),
      _.map( person => {
        if ( ! details ) {
          delete person.scores;
        }

        return person;
      }),
      _.sortBy( ( a, b ) => a - b )
    );

    return _([ eid ]).pipe( pipeline );
  },

  cachePlacements () {
    var placements = {};

    var updateScores = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})<-[p:PARTICIPANT]-(person:Person {id:{pid}})',
      'SET p.placement = {placement}',
      '  , p.total = {total}',
      '  , p.computedTotal = {computedTotal}',
      '  , p.placed = {placed}',
      'RETURN person as node'
    ];

    var pipeline = _.pipeline(
      _.flatMap( eid => this.calculatePlacements( this._eid, false ) ),
      _.map( p => placements[ p.id ] = p ),
      _.collect(),
      _.flatMap( () => this._events.for( this._fid ).participants( this._eid ) ),
      _.flatMap( person => {
        var props = {
          eid: this._eid,
          fid: this._fid,
          pid: person.id,
          placement: null,
          total: null,
          computedTotal: null,
          placed: 0
        };

        // If this person has scores, set them.
        if ( placements[ person.id ] ) {
          props.placement = placements[ person.id ].placement;
          props.total = placements[ person.id ].total;
          props.computedTotal = placements[ person.id ].computedTotal;
          props.placed = placements[ person.id ].placed;
        }

        // Either set the scores to null or update them to the above.
        return this._db.queryOne( updateScores, props );
      }),
      _.map( p => placements[ p.id ] || p ),
      _.sortBy( ( a, b ) => a.placement - b.placement )
    );

    return _([ this._eid ]).pipe( pipeline ).stopOnError(e => console.log(e.stack));
  },

  // ### Placements
  //
  placements () {
    var query = [
      'MATCH (feis:Feis {id:{fid}})<-[:OF]-(event:Event {id:{eid}})<-[score:PARTICIPANT]-(person:Person)',
      'WHERE event.is_in_results = 1',
      '  AND (event.recall IS NULL OR event.recall <> 1 OR event.is_announced = 1)',
      '  AND score.placement IS NOT NULL',
      'WITH score, person, feis',
      'OPTIONAL MATCH (school:School)<-[:ATTENDS]-person',
      'WITH score, person, school, feis',
      'OPTIONAL MATCH person-[reg:REGISTERED]-feis',
      'RETURN person, reg, school, score',
      'ORDER BY score.placement ASC'
    ];

    return this._db.queryMultiple( query, { fid: this._fid, eid: this._eid } )
      .map( row => {
        row.person.school = row.school;
        row.person.competitor = row.reg ? row.reg.num : null;
        row.person.score = row.score;

        return row.person;
      });
  },
})
;

const Scores = Factory( 'Scores', {
  _db: Database,
  _events: Events,
})
.methods({
  for ( fid ) {
    return ScoreQuery({ _db: this._db, _events: this._events, _fid: fid } );
  },
})
;

export default Scores;

