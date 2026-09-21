import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Logo from '@/components/landing/Logo';

function StatusNotice({ eyebrow, title, body, primaryHref, primaryLabel, secondaryHref, secondaryLabel }) {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col justify-center">
        <Link to="/" className="mb-8 inline-flex self-center items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 transition-colors">
          <Logo height={30} />
        </Link>
        <div className="glass-panel p-8 md:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-display font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {primaryHref && (
                <Button asChild className="rounded-xl h-11 px-6 font-medium bg-primary text-primary-foreground hover-scale">
                  <Link to={primaryHref}>{primaryLabel}</Link>
                </Button>
              )}
              {secondaryHref && (
                <Button asChild variant="outline" className="rounded-xl h-11 px-6 font-medium border-border/50 bg-black/20 text-foreground hover:bg-white/10">
                  <Link to={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApplicationPendingPage() {
  return (
    <StatusNotice
      eyebrow="Application Pending Review"
      title="Your application is waiting for approval"
      body="Thanks for registering. A platform administrator needs to review your application before your dashboard becomes available."
      primaryHref="/verify-email"
      primaryLabel="Check verification status"
      secondaryHref="/login"
      secondaryLabel="Sign in"
    />
  );
}

export function ApplicationRejectedPage() {
  return (
    <StatusNotice
      eyebrow="Application Rejected"
      title="This application was not approved"
      body="If you believe this was a mistake, please contact the Ikamva team. You can also submit a fresh application with the correct details."
      primaryHref="/signup"
      primaryLabel="Submit again"
      secondaryHref="/contact"
      secondaryLabel="Contact support"
    />
  );
}

export function ProvisioningPage() {
  return (
    <StatusNotice
      eyebrow="Workspace Provisioning"
      title="Your workspace is being prepared"
      body="Your application was approved, and the workspace is being provisioned. You will be able to access the dashboard as soon as setup completes."
      primaryHref="/dashboard"
      primaryLabel="Try dashboard"
      secondaryHref="/login"
      secondaryLabel="Sign in again"
    />
  );
}

export default StatusNotice;
