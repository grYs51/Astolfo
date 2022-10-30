// eslint-disable-next-line max-classes-per-file
export class HttpError extends Error {
  statusCode: number;

  statusText: string;

  constructor(statusCode: number, statusText: string, message?: string) {
    super(message);

    // Ensure the name of this error is the class name
    this.name = this.constructor.name;

    this.statusCode = statusCode;
    this.statusText = statusText;

    // This clips the constructor invocation from the stack trace.
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InternalServerError extends HttpError {
  constructor() {
    super(500, 'Internal Server Error');
  }
}

export class Unauthorized extends HttpError {
  constructor(message?: string) {
    super(401, 'Unauthorized', message);
  }
}

export class BadRequest extends HttpError {
  constructor(message?: string) {
    super(400, 'Bad Request', message);
  }
}

export class Forbidden extends HttpError {
  constructor(message?: string) {
    super(403, 'Forbidden', message);
  }
}

export class NotFound extends HttpError {
  constructor(message?: string) {
    super(404, 'Not Found', message);
  }
}

export class MethodNotAllowed extends HttpError {
  constructor(message?: string) {
    super(405, 'Method Not Allowed', message);
  }
}

export class Conflict extends HttpError {
  constructor(message?: string) {
    super(409, 'Conflict', message);
  }
}
