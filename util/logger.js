import debug from 'debug';

export default function Logger ( name ) {
  return {
    debug: debug( `ifeis:${name}:debug` ),
    warn: debug( `ifeis:${name}:warn` ),
    error: debug( `ifeis:${name}:error` ),
  };
}

