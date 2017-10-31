import { NotAuthenticated } from '../ext/errors';

export default function isLoggedIn ( req, res, next ) {
  if ( req.isAuthenticated() ) {
    return next();
  }

  res.send( NotAuthenticated() );
}

