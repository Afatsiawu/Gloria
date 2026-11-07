export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required') =>
  new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Resource not found') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message, details) => new ApiError(409, 'CONFLICT', message, details);

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const nowIso = () => new Date().toISOString();
