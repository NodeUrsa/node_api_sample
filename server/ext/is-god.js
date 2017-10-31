import { NotAuthenticated, NotAuthorized } from '../ext/errors';

export default function isGod ( req, res, next ) {
  if ( ! req.isAuthenticated() ) {
    return res.send( NotAuthenticated() );
  }

  if ( ! req.user.is_god ) {
    return res.send( NotAuthorized() );
  }

  return next();
}


