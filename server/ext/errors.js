import { stream } from '../../lib/utilities';
import _ from 'highland';

function error ( obj ) {
  return stream.reject( obj );
}

export function NotFoundObject ( detail ) {
  return {
    statusCode: 404,
    title: 'Not found',
    detail: detail || 'That resource could not be located',
  };
}

export function NotFound ( detail ) {
  return error( NotFoundObject( detail ) );
}

export function NotAuthorized () {
  return error({
    statusCode: 403,
    title: 'Forbidden',
    detail: 'You do not have permission to access this resource',
  });
}

export function NotAuthenticated ( detail ) {
  return error({
    statusCode: 401,
    title: 'Unauthorized',
    detail: detail || 'You must be logged in to access this resource',
  });
}

export function BadImplementation ( detail ) {
  return error({
    statusCode: 500,
    title: 'Internal server error',
    detail: detail || 'An internal server error occurred.',
  });
}

export function BadRequestObject ( detail ) {
  return {
    statusCode: 400,
    title: 'Bad request',
    detail: detail || 'Client-side request error.',
  };
}

export function BadRequest ( detail ) {
  return error( BadRequestObject( detail ) );
}

