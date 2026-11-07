import multer from 'multer';
import { ApiError } from '../utils/http.js';

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} does not exist.`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  if (err instanceof multer.MulterError) {
    status = 400;
    code = 'UPLOAD_ERROR';
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The file is too large. Maximum size is 5 MB.'
        : 'The upload could not be processed.';
  } else if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
    status = err.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 400;
    code = 'CONSTRAINT_ERROR';
    message =
      status === 409
        ? 'That record already exists.'
        : 'The data conflicts with a business rule (for example, stock cannot go negative).';
  }

  if (status >= 500) {
    console.error('[error]', err);
    if (process.env.NODE_ENV === 'production') message = 'An unexpected server error occurred.';
  }

  res.status(status).json({
    error: {
      code,
      message,
      details: details || [],
    },
  });
}
