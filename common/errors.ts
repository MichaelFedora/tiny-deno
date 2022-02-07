export enum ErrorTypes {
  UNKNOWN = 'Unknown',
  MALFORMED = 'Malformed',
  AUTH = 'Auth',
  FORBIDDEN = 'Forbidden',
  NOT_FOUND = 'NotFound',
  NOT_SUPPORTED = 'NotSupported',
}

export const enum ErrorCodes {
  UNKNOWN = 500,
  MALFORMED = 400,
  AUTH = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  NOT_SUPPORTED = 405,
  INTERNAL = 500
}

export class TinyError extends Error {
  type = ErrorTypes.UNKNOWN;
  status = ErrorCodes.UNKNOWN;
  text = 'Unknown'
}

export class MalformedError extends TinyError {
  type = ErrorTypes.MALFORMED;
  status = ErrorCodes.MALFORMED;
  text = 'Malformed';
}

export class AuthError extends TinyError {
  type = ErrorTypes.AUTH;
  status = ErrorCodes.AUTH;
  text = 'Authentication Error';
}

export class ForbiddenError extends TinyError {
  type = ErrorTypes.FORBIDDEN;
  status = ErrorCodes.FORBIDDEN;
  text = 'Forbidden';
}

export class NotFoundError extends TinyError {
  type = ErrorTypes.NOT_FOUND;
  status = ErrorCodes.NOT_FOUND;
  text = 'Not Found';
}

export class NotSupportedError extends TinyError {
  type = ErrorTypes.NOT_SUPPORTED;
  status = ErrorCodes.NOT_SUPPORTED;
  text = 'Not Supported';
}
