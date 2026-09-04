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
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center">
        <Link to="/" className="mb-8 inline-flex self-center rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Logo height={30} />
        </Link>
        <form onSubmit={handleSubmit} className="rounded-[2rem] border border-emerald-950/10 bg-white/85 p-8 shadow-[0_30px_110px_-70px_rgba(23,55,39,0.45)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900/55">Welcome back</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">Sign in to Ikamva</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-950/66">Use the email and password you created during registration.</p>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input id="signin-email" type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input id="signin-password" type="password" autoComplete="current-password" value={form.password} onChange={update('password')} required />
            </div>
          </div>

          <Button type="submit" className="mt-6 w-full rounded-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="mt-4 text-center text-sm text-emerald-950/62">
            New here?{' '}
            <Link to="/signup" className="font-medium text-emerald-950 underline underline-offset-4">
              Create your account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
