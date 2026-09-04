import { BaseWorker } from './BaseWorker.js';

export class EmailResponseWorker extends BaseWorker {
  constructor({ providerName = 'groq', gmailProvider } = {}) { super({ taskType: 'email_response', providerName }); this.gmailProvider = gmailProvider; }
  normalizePayload(payload = {}) { if (!payload.message_id || !payload.sender || !payload.subject) throw new Error('Email response requires message_id, sender, and subject.'); return payload; }
  async execute({ provider, prompt, payload, task, gmailMessageService }) {
    const result = await provider.execute({ prompt, payload: { message: `From: ${payload.sender}\nSubject: ${payload.subject}\n\n${payload.body || ''}` }, task });
    const content = result?.output?.content || '';
    const action = { to: payload.sender, subject: `Re: ${payload.subject}`, text: content, thread_id: payload.thread_id || null, message_id: payload.message_id };
    if (gmailMessageService && payload.credential_reference) {
      const raw = Buffer.from(`To: ${action.to}\r\nSubject: ${action.subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${action.text}`).toString('base64url');
      const draft = await gmailMessageService.createDraft(payload.credential_reference, { raw, threadId: action.thread_id });
      action.draft_id = draft?.id || null;
    }
    return { ...result, output: { ...result.output, status: 'awaiting_approval', content, action } };
  }
}
