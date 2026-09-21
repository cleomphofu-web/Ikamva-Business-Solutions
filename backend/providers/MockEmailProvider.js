/** Provider-neutral email adapter used for local and integration execution. */
export class MockEmailProvider {
  constructor({ clock = () => new Date() } = {}) {
    this.clock = clock;
    this.sent = [];
  }

  async send({ to, subject, text, html, metadata = {} } = {}) {
    const message = {
      provider: 'mock-email',
      message_id: `mock-${this.sent.length + 1}`,
      to,
      subject,
      text,
      html: html ?? null,
      metadata,
      accepted_at: this.clock().toISOString(),
      status: 'accepted',
    };
    this.sent.push(message);
    return message;
  }
}
