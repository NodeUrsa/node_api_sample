// # Configuration

import pkg from '../package.json';

// `Configuration` is a basic DI-managed configuration object for the API server.
function Configuration () {
  return {
    // And we import the `package.json` file to give the API access to some variables, like the
    // current version.
    pkg,

    // This URL is used to prefix URLs when we need a full URL.
    base_url: process.env.IFEIS_BASE_URL || 'http://localhost',

    // On instantiation, we gather the server configuration values (or use the defaults).
    // We provide no default host, thus listening on all hosts by default.
    server: {
      host: process.env.IFEIS_HOSTNAME || '0.0.0.0',
      port: process.env.IFEIS_PORT     || 8000
    },

    // The CDN url for loading static assets.
    cdn: process.env.IFEIS_CDN_URL || 'http://localhost:8889',
    feisAssetsBucket: process.env.IFEIS_FEIS_ASSETS_BUCKET || 'feis-assets.cdn.ifeis.net',

    // We also need to connect to a database.
    db: {
      url: process.env.IFEIS_GRAPH_URI || 'http://localhost:7474/db/data/'
    },

    // Set the OAuth keys.
    oauth: {
      cookie_password: process.env.IFEIS_COOKIE_PASSWORD || 'cookie_password',
      cookie_name: 'IFEIS_SESSION_ID',
      time_to_live: 24 * 60 * 60 * 1000,

      google: {
        client_id: process.env.GOOGLE_CLIENT_ID || '532341210630.apps.googleusercontent.com',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '_0VHId6XOLC_ufmbNqe_6giM'
      },

      facebook: {
        client_id: process.env.FACEBOOK_CLIENT_ID || '476732062411080',
        client_secret: process.env.FACEBOOK_CLIENT_SECRET || 'b09cd9f244822e0f55af06240ce1816a'
      }
    },

    // Set the Amazon Web Services keys.
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fake-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fake-secret-key',
      region: process.env.AWS_REGION || 'us-east-1',
      sslEnabled: true
    },

    // Set some basic email seetings.
    email: {
      from_address: process.env.EMAIL_FROM_ADDRESS || 'hello@ifeis.net',
      contact_address: process.env.EMAIL_CONTACT_ADDRESS || 'hello@ifeis.net',
    },

    // Stripe Payment Processing
    stripe: {
      client_id: process.env.STRIPE_CLIENT_ID || 'ca_78KaznQcaKIaqkSXBtYR5M4witA0LkDq',
      secret_key: process.env.STRIPE_SECRET_KEY || 'sk_test_ii1CFkS20YW5TS87PGcPbj6g',
      public_key: process.env.STRIPE_PUBLIC_KEY || 'pk_test_X1eQ8iI1jbXbdqLwd4KgVFYj',
    },
  };
}

export default Configuration;

