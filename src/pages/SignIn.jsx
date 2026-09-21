import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/landing/Logo';
import authService from '@/lib/auth-service';
import { accessApi } from '@/lib/ikamva/api-client';

const initialForm = { email: '', password: '' };

export default function SignIn() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = key => event => setForm(value => ({ ...value, [key]: event.target.value }));

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Clear any stale local session before establishing a new one. This
      // prevents the access check from racing an expired refresh token.
      await authService.signOut().catch(() => undefined);
      const { session } = await authService.signIn({
        email: form.email,
        password: form.password,
      });

      if (!session?.access_token) {
        throw new Error('Sign-in succeeded without an active session. Please try again.');
      }

      const access = await accessApi.getState({ token: session.access_token });
      if (access.is_admin) {
        navigate('/admin', { replace: true });
      } else if (access.email_verified === false) {
        navigate('/verify-email', { replace: true, state: { email: access.email } });
      } else if (access.application_status === 'missing') {
        navigate('/signup', { replace: true });
      } else if (access.application_status === 'pending') {
        navigate('/application-pending', { replace: true });
      } else if (access.application_status === 'rejected') {
        navigate('/application-rejected', { replace: true });
      } else if (access.application_status === 'approved' && !access.workspace_provisioned) {
        navigate('/provisioning', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (signInError) {
      setError(signInError?.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-6">

        {/* Logo pill */}
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 transition-colors"
        >
          <div className="h-6 w-6 rounded-lg bg-[#fcfc03] flex items-center justify-center">
            <span className="text-[#0a0a05] text-[10px] font-black tracking-tight">IK</span>
          </div>
          <span className="text-[#fafaf9] font-semibold text-sm tracking-tight">Ikamva</span>
        </Link>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-3xl border border-white/10 bg-[#05050a]/70 p-8 backdrop-blur-2xl shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#fcfc03]/70">
            Welcome back
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#fafaf9]">
            Sign in to Ikamva
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#fafaf9]/40">
            Use the email and password you created during registration.
          </p>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="mt-7 space-y-5">
            <div className="space-y-2">
              <label htmlFor="signin-email" className="block text-xs font-medium text-[#fafaf9]/55 tracking-wide">
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={update('email')}
                required
                className="w-full rounded-xl border border-white/20 px-4 py-3 text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fafaf9',
                  caretColor: '#fcfc03',
                  borderColor: 'rgba(255,255,255,0.2)',
                  boxShadow: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(252,252,3,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signin-password" className="block text-xs font-medium text-[#fafaf9]/55 tracking-wide">
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={update('password')}
                required
                className="w-full rounded-xl border border-white/20 px-4 py-3 text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fafaf9',
                  caretColor: '#fcfc03',
                  borderColor: 'rgba(255,255,255,0.2)',
                  boxShadow: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(252,252,3,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.2)')}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-7 w-full rounded-full bg-[#fcfc03] py-3.5 text-sm font-semibold text-[#0a0a05] transition-all hover:bg-[#fcfc03]/90 hover:shadow-[0_0_30px_rgba(252,252,3,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-5 text-center text-sm text-[#fafaf9]/35">
            New here?{' '}
            <Link
              to="/signup"
              className="font-medium text-[#fafaf9]/70 underline underline-offset-4 hover:text-[#fafaf9] transition-colors"
            >
              Create your account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
