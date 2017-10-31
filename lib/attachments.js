// # Attachments

import { Factory } from 'administer';
import util from './utilities';
import Database from './database';

const AttachmentsForFeis = Factory( 'AttachmentsForFeis' )
.methods({
  all ( ) {
    var query = [
      'MATCH (attachment:Attachment )-[:OF]->(feis:Feis {id:{fid}})',
      'RETURN attachment as node'
    ];

    return this._db.query( query, { fid: this._id } );
  },

  one ( id ) {
    var query = [
      'MATCH (attachment:Attachment {id:{id}})-[:OF]->(feis:Feis {id:{fid}})',
      'RETURN attachment as node'
    ];

    return this._db.queryOne( query, { id, fid: this._id } );
  },

  delete ( id ) {
    var query = [
      'MATCH (attachment:Attachment {id:{id}})-[:OF]->(feis:Feis {id:{fid}})',
      'OPTIONAL MATCH attachment-[r]-n',
      'DELETE attachment, r'
    ];

    return this._db.query( query, { id, fid: this._id } );
  },

  update ( id, props ) {
    var query = [
      'MATCH (attachment:Attachment {id:{id}})-[:OF]->(feis:Feis {id:{fid}})',
      'SET attachment.name = { name }',
      'RETURN attachment as node'
    ];

    return this._db.queryOne( query, { id, fid: this._id, name: props.name } );
  },

  create ( props ) {
    const { name, url } = props;
    const id = util.helper.generateId();
    var query = [
      'MATCH (feis:Feis {id:{fid}})',
      'CREATE (attachment:Attachment { id: {id}, name: {name}, url: {url} })-[:OF]->feis',
      'RETURN attachment as node'
    ];

    return this._db.queryOne( query, { fid: this._id, id, name, url } );
  },
})
;

// The `Attachments` class manages attachments for Feis.
const Attachments = Factory( 'Attachments', {
  _db: Database,
})
.methods({
  for ( id ) {
    return AttachmentsForFeis({ _db: this._db, _id: id });
  },
});

export default Attachments;

