export class StorageService {
  async upload() {
    throw new Error('StorageService.upload must be implemented by a provider adapter.');
  }

  async getPublicUrl() {
    throw new Error('StorageService.getPublicUrl must be implemented by a provider adapter.');
  }
}
