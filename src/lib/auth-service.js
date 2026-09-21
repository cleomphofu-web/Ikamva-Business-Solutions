/**
 * auth-service.js
 *
 * Thin facade that delegates to an injected provider.
 * The default export is pre-wired to the real Supabase Auth provider.
 *
 * Admin/Client boundaries are enforced by the Supabase RLS policies and the
 * platform admin email list — this service does not duplicate that logic.
 */
import { supabase } from '@/lib/supabase-client';

export class AuthProviderNotConfiguredError extends Error {
  constructor(message = 'Authentication provider is not configured.') {
    super(message);
    this.name = 'AuthProviderNotConfiguredError';
    this.code = 'auth_provider_not_configured';
  }
}

// ─── Supabase Auth Provider ───────────────────────────────────────────────────

const supabaseAuthProvider = {
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error?.name === 'AuthSessionMissingError') return null;
    if (error) throw error;
    return user ?? null;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session ?? null;
  },

  async signUp({ email, password, options } = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });
    if (error) throw error;
    return {
      user: data.user ?? null,
      session: data.session ?? null,
    };
  },

  async signIn({ email, password } = {}) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return {
      user: data.user ?? null,
      session: data.session ?? null,
    };
  },

  async signOut({ redirectTo } = {}) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (redirectTo && typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return true;
  },

  async redirectToSignIn() {
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
    return true;
  },

  async resendVerification({ email, redirectTo } = {}) {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) throw error;
    return data;
  },

  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  },
};

// ─── Service Factory ──────────────────────────────────────────────────────────

export const createAuthService = ({ provider } = {}) => ({
  async getCurrentUser() {
    if (!provider?.getCurrentUser) return null;
    return provider.getCurrentUser();
  },

  async getSession() {
    if (!provider?.getSession) return null;
    return provider.getSession();
  },

  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return Boolean(user);
  },

  async signUp(params) {
    if (!provider?.signUp) throw new AuthProviderNotConfiguredError();
    return provider.signUp(params);
  },

  async signIn(credentials) {
    if (!provider?.signIn) throw new AuthProviderNotConfiguredError();
    return provider.signIn(credentials);
  },

  async signOut(options) {
    if (!provider?.signOut) return true;
    return provider.signOut(options);
  },

  async redirectToSignIn(options) {
    if (!provider?.redirectToSignIn) throw new AuthProviderNotConfiguredError();
    return provider.redirectToSignIn(options);
  },

  async resendVerification(options) {
    if (!provider?.resendVerification) throw new AuthProviderNotConfiguredError();
    return provider.resendVerification(options);
  },

  onAuthStateChange(callback) {
    if (!provider?.onAuthStateChange) return () => {};
    return provider.onAuthStateChange(callback);
  },
});

// Pre-wired to the real Supabase Auth provider.
export const authService = createAuthService({ provider: supabaseAuthProvider });

export default authService;
