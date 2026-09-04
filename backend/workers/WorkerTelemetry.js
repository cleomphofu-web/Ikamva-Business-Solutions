export class WorkerTelemetry {
  constructor({ clock = () => new Date() } = {}) {
    this.clock = clock;
    this.startedAt = this.clock().toISOString();
    this.ticks = 0;
    this.processed = 0;
    this.idle = 0;
    this.recoveries = 0;
    this.errors = 0;
    this.lastError = null;
  }

  recordTick() { this.ticks += 1; }
  recordProcessed() { this.processed += 1; }
  recordIdle() { this.idle += 1; }
  recordRecovery(count = 0) { this.recoveries += count; }
  recordError(error) {
    this.errors += 1;
    this.lastError = { message: error?.message || String(error), at: this.clock().toISOString() };
  }

  snapshot() {
    return {
      started_at: this.startedAt,
      ticks: this.ticks,
      processed: this.processed,
      idle: this.idle,
      recoveries: this.recoveries,
      errors: this.errors,
      last_error: this.lastError,
    };
  }
}

export const createStructuredLogger = ({ workerId, tenantId, sink = console } = {}) => {
  const write = (level, message, details = {}) => {
    sink[level]?.(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'ikamva-worker',
      level,
      worker_id: workerId,
      tenant_id: tenantId,
      message,
      ...details,
    }));
  };
  return {
    info: (message, details) => write('info', message, details),
    error: (message, details) => write('error', message, details),
  };
};
