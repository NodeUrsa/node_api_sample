import Administer from 'administer';
import {emptyGraph,queryGraph,sinon} from '../util/test-helpers.js';
import Events from './events';
import util from './utilities';
import Database from './database';

describe( 'Events', function () {
  beforeEach( function () {
    this.adm = Administer();
    return this.adm.get([ Database, Events ]).then( ([ d, e ]) => {
      this.db = d;
      this._events = e;
    });
  });

  describe( 'with existing events', function () {
    beforeEach( function () {
      this.fid = 'test-feis-id';
      this.event1id = '102R';
      this.event2id = '203R';
      this.event3id = '812';

      var query = [
        'CREATE',
        '(feis:Feis {',
        'id:{fid},',
        'name:"Test Feis",',
        'slug:"test-feis"',
        '}),',
        '(c102R:Event {',
        'type:"G",',
        'name:"102R",',
        'id:{event1id},',
        'event:"Reel",',
        'rounds:1,',
        'level:"Beginner",',
        'age:[0,6,-1]',
        '})-[:OF]->feis,',
        '(c203R:Event {',
        'name:"203R",',
        'id:{event2id},',
        'type:"G",',
        'event:"Reel",',
        'rounds:1,',
        'level:"Advanced Beginner",',
        'age:[0,7,-1]',
        '})-[:OF]->feis,',
        '(c812:Event {',
        'type:"C",',
        'name:{event3id},',
        'id:"812",',
        'event:"Open Championships",',
        'rounds:3,',
        'age:[0,12,-1]',
        '})-[:OF]->feis',
        ', (stage:Stage)-[:STAGE_LINK]->c102R-[:STAGE_LINK]->stage',
        'RETURN feis as node'
      ];

      return emptyGraph( this.adm ).then( () => new Promise( resolve => this.db.queryOne( query, {
        fid: this.fid,
        event1id: this.event1id,
        event2id: this.event2id,
        event3id: this.event3id
      }).apply( ( feis ) => {
        this.events = this._events.for( feis.id );
        resolve();
      })));
    });

    describe( 'query()', function () {
      it( 'should return all events for a feis', function ( done ) {
        this.events.query().toArray( function ( events ) {
          events.should.have.lengthOf( 3 );
          done();
        });
      });

      it( 'should return all events for a feis with a matching type', function ( done ) {
        this.events.query({ type: 'G' }).toArray( function ( events ) {
          events.should.have.lengthOf( 2 );
          done();
        });
      });
    });

    describe( 'one()', function () {
      it( 'should return event by id', function ( done ) {
        this.events.query().toArray( ( events ) => {
          this.events.one( events[0].id ).toArray( ( res ) => {
            res.should.have.lengthOf( 1 );
            res[0].name.should.be.a.String;
            done();
          });
        });
      });
    });

    describe( 'delete()', function () {
      it( 'should return event by id', function ( done ) {
        this.events.query().toArray( ( events ) => {
          this.events.delete( events[0].id ).toArray( ( res ) => {
            this.events.query().toArray( ( events ) => {
              events.should.have.lengthOf( 2 );
              done();
            });
          });
        });
      });
    });

    describe( 'create()', function () {
      it( 'should return the created event', function ( done ) {
        var expectedEvent = {
          name: 'test event',
          age: 'U10'
        };

        this.events.create( expectedEvent ).apply( function ( event ) {
          event.name.should.eql( expectedEvent.name );
          event.id.should.be.a.String;
          done();
        });
      });
    });

    describe( 'update()', function () {
      it( 'should change the properties of an event', function ( done ) {
        var props = {
          name: 'new-name',
          type: 'F',
          age: 'U10'
        };

        this.events.query().toArray( ( events ) => {
          this.events.update( events[0].id, props ).apply( ( event ) => {
            event.name.should.eql( props.name );
            done();
          });
        });
      });
    });

    describe( 'merge()', function () {
      describe( 'given no participants', function () {
        beforeEach( function ( done ) {
          this.newEvent = { name: 'new-event', age: 'U12' };
          this.serializedAge = 'U12';
          
          this.events.merge( this.event1id, this.event2id, this.newEvent )
          .apply( ( event ) => {
            this.newEvent.id = event.id;

            done();
          });
        });

        it( 'should create a new event with the specified properties', function ( done ) {
          this.events.one( this.newEvent.id )
          .apply( ( event ) => {
            event.should.have.property( 'name', this.newEvent.name );
            done();
          });
        });

        it( 'should inactivate the merged events', function ( done ) {
          this.events.one( this.event1id )
          .apply( ( event ) => {
            event.should.have.property( 'inactive', 1 );

            this.events.one( this.event2id )
            .apply( ( event ) => {
              event.should.have.property( 'inactive', 1 );
              done();
            });
          });
        });


        it( 'should correctly deserialize the age', function ( done ) {
          this.events.one( this.newEvent.id )
          .apply( ( event ) => {
            event.age.should.eql( this.serializedAge );
            done();
          });
        });
      });

      describe( 'given existing participants', function () {
        beforeEach( function ( done ) {
          this.person1id = 'person1';
          this.person2id = 'person2';
          this.person3id = 'person3';
          this.person4id = 'person4';

          this.newEvent = { name: 'new-event', age: 'U12' };
          this.serializedAge = 'U12';

          var query = [
            'MATCH (event1:Event {id:{event1id}})',
            ', (event2:Event {id:{event2id}})',
            ', (event3:Event {id:{event3id}})',
            ', (feis:Feis {id:{fid}})',
            'CREATE (person1:Person {id:{person1id}})-[:REGISTERED]->(feis)',
            ', (person2:Person {id:{person2id}})-[:REGISTERED]->(feis)',
            ', (person3:Person {id:{person3id}})-[:REGISTERED]->(feis)',
            ', (person4:Person {id:{person4id}})-[:REGISTERED]->(feis)',
            ', person1-[:PARTICIPANT]->event1',
            ', person2-[:PARTICIPANT]->event1',
            ', person3-[:PARTICIPANT]->event1',
            ', person1-[:PARTICIPANT]->event2',
            ', person2-[:PARTICIPANT]->event2',
            ', person3-[:PARTICIPANT]->event2',
            ', person4-[:PARTICIPANT]->event3'
          ];

          this.db.queryOne( query, {
            fid: this.fid,
            event1id: this.event1id,
            event2id: this.event2id,
            event3id: this.event3id,
            person1id: this.person1id,
            person2id: this.person2id,
            person3id: this.person3id,
            person4id: this.person4id
          }).apply( () => {
            this.events.merge( this.event1id, this.event3id, this.newEvent )
            .apply( ( event ) => {
              this.newEvent.id = event.id;

              done();
            });
          });
        });

        it( 'should create a new event with the specified properties', function ( done ) {
          this.events.one( this.newEvent.id )
          .apply( ( event ) => {
            event.should.have.property( 'name', this.newEvent.name );
            done();
          });
        });

        it( 'should inactivate the merged events', function ( done ) {
          this.events.one( this.event1id )
          .apply( ( event ) => {
            event.should.have.property( 'inactive', 1 );

            this.events.one( this.event3id )
            .apply( ( event ) => {
              event.should.have.property( 'inactive', 1 );
              done();
            });
          });
        });

        it( 'should copy the participations to the new event', function ( done ) {
          this.events.participants( this.newEvent.id )
            .toArray( ( persons ) => {
              persons.should.have.length( 4 );
              done();
            });
        });

        it( 'should only add distinct participations to the new event', function ( done ) {
          this.events.merge( this.event1id, this.event2id, this.newEvent )
          .apply( ( event ) => {
            this.events.participants( event.id )
            .toArray( ( persons ) => {
              persons.should.have.length( 3 );
              done();
            });
          });
        });
      });
    });

    describe( 'split()', function () {
      describe( 'given no participants', function () {
        beforeEach( function ( done ) {
          this.newEvent1 = { name: 'new-1', age: 'U12' };
          this.newEvent2 = { name: 'new-2', age: 'U12' };
          this.serializedAge = 'U12';
          
          this.events.split( this.event1id, this.newEvent1, [], this.newEvent2, [] )
          .apply( ( events ) => {
            this.newEvent1.id = events[0].id;
            this.newEvent2.id = events[1].id;

            done();
          });
        });

        it( 'should create two new events with the specified properties', function ( done ) {
          this.events.one( this.newEvent1.id )
          .apply( ( event ) => {
            event.should.have.property( 'name', this.newEvent1.name );

            this.events.one( this.newEvent2.id )
            .apply( ( event ) => {
              event.should.have.property( 'name', this.newEvent2.name );
              done();
            });
          });
        });

        it( 'should inactivate the split event', function ( done ) {
          this.events.one( this.event1id )
          .apply( ( event ) => {
            event.inactive.should.eql( 1 );
            done();
          });
        });

        it( 'should deserialize the age', function ( done ) {
          this.events.one( this.newEvent1.id )
          .apply( ( event ) => {
            event.age.should.eql( this.serializedAge );
            done();
          });
        });
      });

      describe( 'given existing participants', function () {
        beforeEach( function ( done ) {
          this.person1id = 'person1';
          this.person2id = 'person2';
          this.person3id = 'person3';

          this.group1 = [ this.person1id ];
          this.group2 = [ this.person2id, this.person3id ];

          this.newEvent1 = { name: 'new-1', age: 'U12' };
          this.newEvent2 = { name: 'new-2', age: 'U12' };
          this.serializedAge = 'U12';

          var query = [
            'MATCH (event1:Event {id:{event1id}})',
            ', (event2:Event {id:{event2id}})',
            ', (event3:Event {id:{event3id}})',
            ', (feis:Feis {id:{fid}})',
            'CREATE (person1:Person {id:{person1id}})-[:REGISTERED]->(feis)',
            ', (person2:Person {id:{person2id}})-[:REGISTERED]->(feis)',
            ', (person3:Person {id:{person3id}})-[:REGISTERED]->(feis)',
            ', person1-[:PARTICIPANT]->event1',
            ', person2-[:PARTICIPANT]->event1',
            ', person3-[:PARTICIPANT]->event1',
            ', person1-[:PARTICIPANT]->event2',
            ', person2-[:PARTICIPANT]->event2',
            ', person3-[:PARTICIPANT]->event2'
          ];

          this.db.queryOne( query, {
            fid: this.fid,
            event1id: this.event1id,
            event2id: this.event2id,
            event3id: this.event3id,
            person1id: this.person1id,
            person2id: this.person2id,
            person3id: this.person3id
          }).apply( () => {
            this.events.split( this.event1id, this.newEvent1, this.group1, this.newEvent2, this.group2 )
            .apply( ( events ) => {
              this.newEvent1.id = events[0].id;
              this.newEvent2.id = events[1].id;

              done();
            });
          });
        });

        it( 'should create two new events with the specified properties', function ( done ) {
          this.events.one( this.newEvent1.id )
          .apply( ( event ) => {
            event.should.have.property( 'name', this.newEvent1.name );

            this.events.one( this.newEvent2.id )
            .apply( ( event ) => {
              event.should.have.property( 'name', this.newEvent2.name );
              done();
            });
          });
        });

        it( 'should inactivate the split event', function ( done ) {
          this.events.one( this.event1id )
          .apply( ( event ) => {
            event.inactive.should.eql( 1 );
            done();
          });
        });

        it( 'should copy the specified participations to the new events', function ( done ) {
          this.events.participants( this.newEvent1.id )
            .toArray( ( persons ) => {
              persons.should.have.length( 1 );

              this.events.participants( this.newEvent2.id )
              .toArray( ( persons ) => {
                persons.should.have.length( 2 );
                done();
              });
            });
        });
      });
    });
  });
});

