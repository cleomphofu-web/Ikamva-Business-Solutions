export class HttpEmailProvider {
  constructor({ endpoint = 'https://api.resend.com/emails', apiKey, from, fetchImpl = fetch } = {}) {
    if (!apiKey) throw new Error('HttpEmailProvider requires EMAIL_PROVIDER_API_KEY.');
    if (!from) throw new Error('HttpEmailProvider requires EMAIL_FROM.');
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.from = from;
    this.fetchImpl = fetchImpl;
  }

  async send({ to, subject, text, html, metadata = {} } = {}) {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, text, html: html ?? undefined, metadata }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Email provider rejected delivery (${response.status}): ${detail.slice(0, 240)}`);
    }
    const result = await response.json();
    return { provider: 'http-email', status: 'accepted', ...result };
  }
}
