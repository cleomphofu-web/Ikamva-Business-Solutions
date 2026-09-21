/**
 * OpenAIProvider.js
 *
 * Real AI provider adapter using the OpenAI Node.js SDK.
 * Implements the same interface as MockAIProvider.
 *
 * API key is read from OPENAI_API_KEY or the configured ChatGPT provider key.
 * This file is backend-only and MUST NEVER be bundled by Vite.
 */
import OpenAI from 'openai';

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_provider_chatGPT_API;
  if (!apiKey) {
    throw new Error(
      'OpenAI API key is not configured. ' +
      'Add OPENAI_API_KEY to your .env file.'
    );
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

export class OpenAIProvider {
  constructor({ model = 'gpt-4o-mini' } = {}) {
    this.model = model;
  }

  async execute({ prompt, payload, sop, task }) {
    const client = getClient();

    const messages = [
      {
        role: 'system',
        content: typeof prompt === 'string' ? prompt : (sop?.system_prompt ?? 'You are a helpful AI assistant.'),
      },
      {
        role: 'user',
        content: typeof payload?.message === 'string'
          ? payload.message
          : JSON.stringify(payload ?? {}),
      },
    ];

    const completion = await client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    const choice = completion.choices?.[0];
    const content = choice?.message?.content ?? '';

    return {
      provider: 'openai',
      model: this.model,
      prompt,
      payload,
      sop_id: sop?.id ?? null,
      task_id: task?.id ?? null,
      output: {
        status: 'completed',
        content,
        finish_reason: choice?.finish_reason ?? 'stop',
        usage: completion.usage ?? null,
        generated_at: new Date().toISOString(),
      },
    };
  }
}
