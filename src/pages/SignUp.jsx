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
        <Link to="/" className="mb-8 inline-flex self-center items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 transition-colors">
          <Logo height={30} />
        </Link>
        {success ? <div className="glass-panel p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Account ready</p>
            <h1 className="mt-3 text-3xl font-display font-semibold tracking-tight text-foreground">Your workspace is ready</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Email confirmation is bypassed in development mode — you can sign in immediately.</p>
            <Button type="button" className="mt-8 w-full rounded-xl h-11 font-medium bg-primary text-primary-foreground hover-scale" onClick={() => navigate('/login', { replace: true })}>Sign in &rarr;</Button>
          </div>
        </div> : <form onSubmit={handleSubmit} className="glass-panel p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Start your workspace</p>
            <h1 className="mt-3 text-3xl font-display font-semibold tracking-tight text-foreground">Create your Ikamva account</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">We’ll create your account, send a verification email, and queue your application for review.</p>

            {error && (
              <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-5">
              <div className="flex flex-col md:flex-row gap-5">
                <div className="space-y-2 w-full">
                  <Label htmlFor="signup-name" className="text-muted-foreground">Full name</Label>
                  <Input id="signup-name" value={form.fullName} onChange={update('fullName')} required className="bg-black/20 border-border/50 h-11 rounded-lg" />
                </div>
                <div className="space-y-2 w-full">
                  <Label htmlFor="signup-company" className="text-muted-foreground">Company name</Label>
                  <Input id="signup-company" value={form.companyName} onChange={update('companyName')} required className="bg-black/20 border-border/50 h-11 rounded-lg" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-phone" className="text-muted-foreground">Phone</Label>
                <Input id="signup-phone" value={form.phone} onChange={update('phone')} required className="bg-black/20 border-border/50 h-11 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-muted-foreground">Email</Label>
                <Input id="signup-email" type="email" autoComplete="email" value={form.email} onChange={update('email')} required className="bg-black/20 border-border/50 h-11 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-muted-foreground">Password</Label>
                <Input id="signup-password" type="password" autoComplete="new-password" value={form.password} onChange={update('password')} required minLength={8} className="bg-black/20 border-border/50 h-11 rounded-lg" />
              </div>
            </div>

            <Button type="submit" className="mt-8 w-full rounded-xl h-11 font-medium bg-primary text-primary-foreground hover-scale" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>

            <div className="bg-gradient-to-r from-transparent via-border to-transparent my-8 h-[1px] w-full" />

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </form>}
      </div>
    </div>
  );
}
