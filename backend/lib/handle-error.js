import { AppError } from './errors.js';

export function handleError(err, req, res, next) {
  if (err instanceof AppError) {
    res.writeHead(err.statusCode, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } }));
  }
  console.error('[UnhandledError]', { path: req.url, method: req.method, error: err?.message, stack: err?.stack });
  res.writeHead(500, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }));
}
