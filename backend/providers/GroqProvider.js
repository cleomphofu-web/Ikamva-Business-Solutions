/** OpenAI-compatible Groq chat-completions adapter. Backend-only. */
import OpenAI from 'openai';

let client;
function getClient() {
  if (client) return client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API key is not configured. Add GROQ_API_KEY to your .env file.');
  client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
  return client;
}

export class GroqProvider {
  constructor({ model = 'openai/gpt-oss-20b' } = {}) { this.model = model; }

  async execute({ prompt, payload, sop, task }) {
    const completion = await getClient().chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: typeof prompt === 'string' ? prompt : (sop?.system_prompt ?? 'You are a helpful AI assistant.') },
        { role: 'user', content: typeof payload?.message === 'string' ? payload.message : JSON.stringify(payload ?? {}) },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });
    const choice = completion.choices?.[0];
    return {
      provider: 'groq', model: this.model, prompt, payload, sop_id: sop?.id ?? null, task_id: task?.id ?? null,
      output: { status: 'completed', content: choice?.message?.content ?? '', finish_reason: choice?.finish_reason ?? 'stop', usage: completion.usage ?? null, generated_at: new Date().toISOString() },
    };
  }
}
