// # SimpleEmailService

import AWS from 'aws-sdk';
import Configuration from '../../lib/configuration';

// This is a DI-friendly wrapper around the AWS SDK for JavaScript so it can be mocked out during
// unit testing.
function SimpleEmailService ( config ) {
  return new AWS.SES( config.aws );
}

SimpleEmailService.$inject = [ Configuration ];

export default SimpleEmailService;

