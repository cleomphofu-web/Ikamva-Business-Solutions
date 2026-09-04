import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Logo from '@/components/landing/Logo';

function StatusNotice({ eyebrow, title, body, primaryHref, primaryLabel, secondaryHref, secondaryLabel }) {
  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col justify-center">
        <Link to="/" className="mb-8 inline-flex self-center rounded-2xl bg-white px-4 py-3 shadow-sm">
          <Logo height={30} />
        </Link>
        <div className="rounded-[2rem] border border-emerald-950/10 bg-white/80 p-8 shadow-[0_30px_110px_-70px_rgba(23,55,39,0.45)] backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900/55">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">{title}</h1>
          <p className="mt-4 text-sm leading-6 text-emerald-950/66">{body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {primaryHref && (
              <Button asChild className="rounded-full">
                <Link to={primaryHref}>{primaryLabel}</Link>
              </Button>
            )}
            {secondaryHref && (
              <Button asChild variant="outline" className="rounded-full">
                <Link to={secondaryHref}>{secondaryLabel}</Link>
              </Button>
            )}
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
      secondaryHref="/signin"
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
      secondaryHref="/signin"
      secondaryLabel="Sign in again"
    />
  );
}

export default StatusNotice;
