import { BaseWorker } from './BaseWorker.js';

export class EmailWorker extends BaseWorker {
  constructor({ providerName = 'mock-email' } = {}) {
    super({ taskType: 'email', providerName });
  }

  normalizePayload(payload = {}) {
    if (payload.subject !== undefined && typeof payload.subject !== 'string') throw new Error('Email task subject must be a string.');
    const bodyValue = payload.text ?? payload.body ?? payload.message;
    if (bodyValue !== undefined && typeof bodyValue !== 'string') throw new Error('Email task body must be a string.');
    const to = String(payload.to || '').trim().toLowerCase();
    const subject = String(payload.subject || '').trim();
    const text = sanitizeEmailBody(payload.text || payload.body || payload.message || '');
    if (!to || !to.includes('@')) throw new Error('Email task requires a valid recipient address.');
    if (!subject) throw new Error('Email task requires a subject.');
    if (!text && !payload.html) throw new Error('Email task requires text or html content.');
    return { to, subject, text, html: payload.html || null, metadata: payload.metadata || {} };
  }

  async execute({ provider, payload, task }) {
    if (typeof provider?.send !== 'function') throw new Error('Email provider must implement send.');
    return provider.send({ ...payload, metadata: { ...payload.metadata, task_id: task?.id ?? null } });
  }
}

export function sanitizeEmailBody(value) {
  return String(value || '')
    .replace(/^\s*(here(?:'|’)s|here is)\s+(?:the\s+)?(?:email\s+draft|draft)\s*:\s*/i, '')
    .replace(/^\s*(i(?:'|’)m|i am) here to help you with[^\n]*\n?/i, '')
    .split('\n')
    .filter(line => !/^\s*\|.*\|\s*$/.test(line) && !/^\s*\|?\s*:?-{3,}/.test(line))
    .map(line => line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/^\s*[-*+]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1').replace(/`([^`]+)`/g, '$1').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
