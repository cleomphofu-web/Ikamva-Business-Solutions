export class DatabaseService {
  async query() {
    throw new Error('DatabaseService.query must be implemented by a provider adapter.');
  }

  async transaction() {
    throw new Error('DatabaseService.transaction must be implemented by a provider adapter.');
  }
}
