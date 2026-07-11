const AUTH_STORAGE_KEY = 'ikamva_app:auth_user';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const memoryStorage = new Map();

const storage = isBrowser
  ? window.localStorage
  : {
      getItem: key => memoryStorage.get(key) ?? null,
      setItem: (key, value) => memoryStorage.set(key, value),
      removeItem: key => memoryStorage.delete(key),
    };

const parseUser = value => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const clone = value => {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

const defaultLocalUser = {
  id: 'local-user',
  email: 'demo@ikamva.local',
  full_name: 'Demo User',
  role: 'admin',
};

export const createLocalAuthService = () => ({
  async getCurrentUser() {
    return clone(parseUser(storage.getItem(AUTH_STORAGE_KEY)));
  },
  async isAuthenticated() {
    return Boolean(parseUser(storage.getItem(AUTH_STORAGE_KEY)));
  },
  async signIn(user = defaultLocalUser) {
    // TODO: Replace this local session with Supabase auth or another backend provider.
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return clone(user);
  },
  async signOut({ redirectTo } = {}) {
    storage.removeItem(AUTH_STORAGE_KEY);

    if (redirectTo && isBrowser) {
      window.location.href = redirectTo;
    }

    return true;
  },
  async redirectToSignIn() {
    // TODO: Replace with a real login route or identity-provider redirect.
    return this.signIn();
  },
});

export const authService = createLocalAuthService();

export default authService;
