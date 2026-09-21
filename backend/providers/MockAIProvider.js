export class MockAIProvider {
  constructor({ defaultResponse } = {}) {
    this.defaultResponse = defaultResponse || 'Mock execution response.';
  }

  async execute({ prompt, payload, sop }) {
    return {
      provider: 'mock',
      prompt,
      payload,
      sop_id: sop?.id,
      output: {
        status: 'mock_completed',
        content: this.defaultResponse,
        generated_at: new Date().toISOString(),
      },
    };
  }
}
