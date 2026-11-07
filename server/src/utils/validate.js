import { ZodError } from 'zod';
import { badRequest } from './http.js';

/**
 * Validates req.body / req.query / req.params against zod schemas and replaces
 * the parsed (coerced) value. Every mutating endpoint uses this middleware.
 */
export function validate({ body, query, params }) {
  return (req, _res, next) => {
    try {
      if (body) req.body = body.parse(req.body ?? {});
      if (query) req.query = query.parse(req.query ?? {});
      if (params) req.params = params.parse(req.params ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({
          path: i.path.join('.') || '(root)',
          message: i.message,
        }));
        return next(badRequest('Some fields are invalid. Please check and try again.', details));
      }
      next(err);
    }
  };
}
