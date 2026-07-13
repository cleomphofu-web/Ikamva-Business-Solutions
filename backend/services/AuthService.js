export class AuthService {
  async getCurrentUser() {
    throw new Error('AuthService.getCurrentUser must be implemented by a provider adapter.');
  }

  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return Boolean(user);
  }

  async signIn() {
    throw new Error('AuthService.signIn must be implemented by a provider adapter.');
  }

  async signOut() {
    throw new Error('AuthService.signOut must be implemented by a provider adapter.');
  }
}
