export class AuthProviderNotConfiguredError extends Error {
  constructor(message = 'Authentication provider is not configured.') {
    super(message);
    this.name = 'AuthProviderNotConfiguredError';
    this.code = 'auth_provider_not_configured';
  }
}

export const createAuthService = ({ provider } = {}) => ({
  async getCurrentUser() {
    if (!provider?.getCurrentUser) {
      return null;
    }

    return provider.getCurrentUser();
  },
  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return Boolean(user);
  },
  async signIn(credentials) {
    if (!provider?.signIn) {
      throw new AuthProviderNotConfiguredError();
    }

    return provider.signIn(credentials);
  },
  async signOut(options) {
    if (!provider?.signOut) {
      return true;
    }

    return provider.signOut(options);
  },
  async redirectToSignIn(options) {
    if (!provider?.redirectToSignIn) {
      throw new AuthProviderNotConfiguredError();
    }

    return provider.redirectToSignIn(options);
  },
});

export const authService = createAuthService();

export default authService;
