import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import authService from '@/lib/auth-service';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname;

  const { data: authData, isFetched } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const user = await authService.getCurrentUser();
        return { user, isAuthenticated: Boolean(user) };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    },
  });

  const isAdmin = isFetched && authData?.isAuthenticated && authData?.user?.app_metadata?.role === 'admin';
  const homeHref = isFetched && authData?.isAuthenticated ? '/dashboard' : '/';

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      {/* Subtle radial glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 40%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)',
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16">
        {/* Logo pill */}
        <Link to="/" className="mb-12 flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
          <span
            className="grid size-8 place-items-center rounded-xl text-xs font-bold text-primary"
            style={{ background: 'color-mix(in oklab, var(--primary) 14%, transparent)' }}
          >
            IK
          </span>
          <span className="text-sm font-semibold tracking-wide">Ikamva</span>
        </Link>

        {/* Main card */}
        <div
          className="glass w-full max-w-lg rounded-[2rem] p-10 text-center shadow-[0_40px_120px_-60px_rgba(0,0,0,0.5)]"
          style={{ border: '1px solid color-mix(in oklab, var(--primary) 20%, transparent)' }}
        >
          {/* Error code */}
          <p
            className="text-8xl font-light tabular-nums"
            style={{
              background: 'linear-gradient(135deg, var(--foreground) 0%, color-mix(in oklab, var(--foreground) 30%, transparent) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </p>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{pageName}</code>{' '}
            doesn't exist in this application.
          </p>

          {/* Admin hint */}
          {isAdmin && (
            <div
              className="mt-6 rounded-2xl px-4 py-3 text-left text-sm"
              style={{
                background: 'color-mix(in oklab, var(--primary) 8%, transparent)',
                border: '1px solid color-mix(in oklab, var(--primary) 18%, transparent)',
              }}
            >
              <p className="font-medium text-primary">Admin note</p>
              <p className="mt-1 text-muted-foreground">
                This page may not be implemented yet. Ask the AI assistant to build it in the chat.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={homeHref}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:scale-105"
            >
              {authData?.isAuthenticated ? 'Back to dashboard' : 'Go home'}
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Go back
            </button>
          </div>
        </div>

        {/* Footer caption */}
        <p className="mt-10 text-xs text-muted-foreground/50">Ikamva AI Operating System</p>
      </div>
    </div>
  );
}
