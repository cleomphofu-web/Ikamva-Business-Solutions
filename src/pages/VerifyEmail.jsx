import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Logo from '@/components/landing/Logo';
import authService from '@/lib/auth-service';
import { applicationsApi } from '@/lib/ikamva/api-client';

const ERROR_CODES = new Set(['access_denied', 'otp_expired']);

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState('waiting');
  const [message, setMessage] = useState('');
  const [sessionEmail, setSessionEmail] = useState(() => location.state?.email || '');
  const completingApplication = useRef(false);

  const email = useMemo(() => {
    return (
      sessionEmail ||
      location.state?.email ||
      searchParams.get('email') ||
      (typeof window !== 'undefined' ? window.sessionStorage.getItem('ikamva_pending_email') || '' : '')
    );
  }, [location.state?.email, searchParams, sessionEmail]);

  const hasError = ERROR_CODES.has(searchParams.get('error_code') || '') || searchParams.get('error') === 'access_denied';
  const errorDescription = searchParams.get('error_description') || '';

  const completeApplication = async () => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('ikamva_pending_application');
    if (!raw) return;
    if (completingApplication.current) return;

    const application = JSON.parse(raw);
    const session = await authService.getSession();
    const sessionEmailValue = session?.user?.email?.trim().toLowerCase();
    if (!sessionEmailValue || sessionEmailValue !== String(application.email || '').trim().toLowerCase()) {
      return;
    }

    completingApplication.current = true;
    try {
      await applicationsApi.createApplication(application);
      window.sessionStorage.removeItem('ikamva_pending_application');
    } finally {
      completingApplication.current = false;
    }
  };

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async user => {
      if (user?.email_confirmed_at) {
        try {
          await completeApplication();
          navigate('/dashboard', { replace: true });
        } catch (applicationError) {
          setStatus('error');
          setMessage(applicationError?.message || 'Your email is verified, but we could not submit the application yet. Please try again.');
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.sessionStorage.getItem('ikamva_pending_email');
      if (stored && !sessionEmail) {
        setSessionEmail(stored);
      }
    }
  }, [sessionEmail]);

  const refreshStatus = async () => {
    setChecking(true);
    setMessage('');

    try {
      const user = await authService.getCurrentUser();
      if (user?.email_confirmed_at) {
        await completeApplication();
        navigate('/dashboard', { replace: true });
        return;
      }

      setStatus('waiting');
      setMessage('We could not confirm verification yet. Please check the inbox for the latest link.');
    } catch (verifyError) {
      setStatus('error');
      setMessage(verifyError?.message || 'Unable to confirm verification right now.');
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    if (!email) {
      setStatus('error');
      setMessage('We need the email address used to sign up before we can resend the link.');
      return;
    }

    setResending(true);
    setMessage('');

    try {
      await authService.resendVerification({
        email,
        redirectTo: `${window.location.origin}/verify-email`,
      });
      setStatus('resend_sent');
      setMessage(`A new verification email has been sent to ${email}.`);
    } catch (resendError) {
      setStatus('error');
      setMessage(resendError?.message || 'Unable to resend the verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col justify-center">
        <Link to="/" className="mb-8 inline-flex self-center items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 transition-colors">
          <Logo height={30} />
        </Link>

        <div className="glass-panel p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Verify your email</p>
            <h1 className="mt-3 text-3xl font-display font-semibold tracking-tight text-foreground">Check your inbox</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              We sent a verification link{email ? ` to ${email}` : ''}. Please confirm your email before continuing.
            </p>

            {hasError && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <p className="font-medium">That verification link is expired or invalid.</p>
                <p className="mt-1 text-amber-200/80">{errorDescription || 'Please request a new verification email and try again.'}</p>
              </div>
            )}

            {message && (
              <div
                className={`mt-6 rounded-xl px-4 py-3 text-sm ${
                  status === 'error'
                    ? 'border border-destructive/30 bg-destructive/10 text-destructive-foreground'
                    : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {message}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button onClick={refreshStatus} className="rounded-xl h-11 px-6 font-medium bg-primary text-primary-foreground hover-scale" disabled={checking}>
                {checking ? 'Checking…' : 'I have verified my email'}
              </Button>
              <Button variant="outline" onClick={resend} className="rounded-xl h-11 px-6 font-medium border-border/50 bg-black/20 text-foreground hover:bg-white/10" disabled={resending || !email}>
                {resending ? 'Sending…' : 'Resend verification email'}
              </Button>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              Didn’t receive it? Make sure you used the correct email address, then check spam or request a new link.
            </p>

            <div className="bg-gradient-to-r from-transparent via-border to-transparent my-8 h-[1px] w-full" />

            <div className="flex flex-wrap gap-4 text-sm">
              <Link to="/login" className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors">
                Back to sign in
              </Link>
              <Link to="/signup" className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors">
                Start over
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
