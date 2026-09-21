export class IpRateLimiter {
  constructor({ limit = 20, windowMs = 60_000, now = () => Date.now(), logger = console } = {}) { this.limit = limit; this.windowMs = windowMs; this.now = now; this.logger = logger; this.buckets = new Map(); }
  check(key) {
    const now = this.now(); const current = this.buckets.get(key);
    if (!current || now >= current.resetAt) { this.buckets.set(key, { count: 1, resetAt: now + this.windowMs }); return { allowed: true, remaining: this.limit - 1, retryAfterMs: 0 }; }
    current.count += 1; const allowed = current.count <= this.limit;
    if (!allowed) this.logger.warn?.('[Webhook] rate limit exceeded', { ip: key, retry_after_ms: current.resetAt - now });
    return { allowed, remaining: Math.max(0, this.limit - current.count), retryAfterMs: current.resetAt - now };
  }
}
