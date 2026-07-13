export class MockAIProvider {
  async execute({ prompt, payload, sop }) {
    return {
      provider: 'mock',
      prompt,
      payload,
      sop_id: sop?.id,
      output: {
        status: 'mock_completed',
        generated_at: new Date().toISOString(),
      },
    };
  }
}
