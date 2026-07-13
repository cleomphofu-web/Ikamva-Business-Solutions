export class AIService {
  async generate() {
    throw new Error('AIService.generate must be implemented by a provider adapter.');
  }

  async generateJson() {
    throw new Error('AIService.generateJson must be implemented by a provider adapter.');
  }
}
