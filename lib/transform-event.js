export default function transformEvent ( event ) {
  var matches = a => a.every( f => event[f] === 1 );

  // set state
  if ( matches([ 'is_ci_opened' ]) ) {
    event.status = 'CI';
  } else if ( matches([ 'is_in_results', 'recall', 'is_announced' ]) ) {
    event.status = 'RES';
  } else if ( matches([ 'is_in_results', 'recall' ]) ) {
    event.status = 'RCL';
  } else if ( matches([ 'is_in_results' ]) ) {
    event.status = 'RES';
  } else if ( matches([ 'is_in_qa' ]) ) {
    event.status = 'QA';
  } else if ( matches([ 'is_in_tabs' ]) ) {
    event.status = 'TABS';
  } else if ( matches([ 'is_ci_closed' ]) ) {
    event.status = 'ADJ';
  } else {
    event.status = 'PND';
  }

  return event;
}

