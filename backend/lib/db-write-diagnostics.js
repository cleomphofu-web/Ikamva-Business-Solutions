/** Targeted diagnostics for malformed JSON/JSONB writes. Never mutates data. */
export function reportJsonWriteFailure(operation, payload, error) {
  const code = error?.code || error?.details?.code;
  const status = Number(error?.status || error?.statusCode || 0);
  if (code === '22P05' || status === 500) {
    console.error(`[db-write] ${operation} failed`, { code: code || null, status: status || null, message: error?.message || null });
    console.error(JSON.stringify(payload));
  }
}
