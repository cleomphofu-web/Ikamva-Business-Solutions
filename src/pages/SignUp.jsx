import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/landing/Logo';
import authService from '@/lib/auth-service';
import { applicationsApi } from '@/lib/ikamva/api-client';

const initialForm = {
  fullName: '',
  companyName: '',
  phone: '',
  email: '',
  password: '',
};

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const skipEmailConfirmation = __IKAMVA_SKIP_EMAIL_CONFIRMATION__;

  const update = key => event => setForm(value => ({ ...value, [key]: event.target.value }));

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { user } = await authService.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
          data: {
            full_name: form.fullName,
            company_name: form.companyName,
            phone: form.phone,
          },
        },
      });

      if (!user?.id) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('ikamva_pending_email', form.email);
        }
        navigate('/verify-email', { replace: true, state: { email: form.email } });
        return;
      }

      const application = {
        email: form.email,
        full_name: form.fullName,
        company_name: form.companyName,
        phone: form.phone,
      };

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('ikamva_pending_application', JSON.stringify(application));
      }

      const session = await authService.getSession();
      if (session?.user?.id === user.id) {
        await applicationsApi.createApplication(application);
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('ikamva_pending_application');
        }
      }

      if (skipEmailConfirmation) {
        if (typeof window !== 'undefined') window.sessionStorage.removeItem('ikamva_pending_email');
        setSuccess(true);
        return;
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('ikamva_pending_email', form.email);
      }

      navigate('/verify-email', { replace: true, state: { email: form.email } });
    } catch (signupError) {
      if (/already registered/i.test(signupError?.message || '')) {
        setError('An account with this email already exists. Please sign in to continue.');
      } else {
        setError(signupError?.message || 'Unable to create your account.');
      }
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
        {success ? <div className="rounded-[2rem] border border-emerald-950/10 bg-white/85 p-8 shadow-[0_30px_110px_-70px_rgba(23,55,39,0.45)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900/55">Account ready</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">Your workspace is ready</h1>
          <p className="mt-4 text-sm leading-6 text-emerald-950/70">Email confirmation is bypassed in development mode — you can sign in immediately.</p>
          <Button type="button" className="mt-6 w-full rounded-full" onClick={() => navigate('/login', { replace: true })}>Sign in</Button>
        </div> : <form onSubmit={handleSubmit} className="rounded-[2rem] border border-emerald-950/10 bg-white/85 p-8 shadow-[0_30px_110px_-70px_rgba(23,55,39,0.45)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900/55">Start your workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">Create your Ikamva account</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-950/66">We’ll create your account, send a verification email, and queue your application for review.</p>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Full name</Label>
              <Input id="signup-name" value={form.fullName} onChange={update('fullName')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-company">Company name</Label>
              <Input id="signup-company" value={form.companyName} onChange={update('companyName')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone</Label>
              <Input id="signup-phone" value={form.phone} onChange={update('phone')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input id="signup-password" type="password" autoComplete="new-password" value={form.password} onChange={update('password')} required minLength={8} />
            </div>
          </div>

          <Button type="submit" className="mt-6 w-full rounded-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>

          <p className="mt-4 text-center text-sm text-emerald-950/62">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-emerald-950 underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </form>}
      </div>
    </div>
  );
}
