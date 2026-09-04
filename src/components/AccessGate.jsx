import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import authService from '@/lib/auth-service';
import { accessApi, employeeApi } from '@/lib/ikamva/api-client';

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-950/15 border-t-emerald-950" />
  </div>
);

const AccessErrorScreen = ({ onRetry }) => (
  <div className="min-h-screen bg-background px-6 py-12">
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center">
      <div className="rounded-[2rem] border border-emerald-950/10 bg-white/85 p-8 text-center shadow-[0_30px_110px_-70px_rgba(23,55,39,0.45)] backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900/55">Access check failed</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-emerald-950">We could not confirm your workspace access.</h1>
        <p className="mt-3 text-sm leading-6 text-emerald-950/66">
          Your session is still active. Please retry the access check.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-emerald-950 px-5 text-sm font-medium text-white transition hover:bg-emerald-900"
        >
          Retry
        </button>
      </div>
    </div>
  </div>
);

export default function AccessGate({ scope = 'client' }) {
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  const accessQuery = useQuery({
    queryKey: ['access-state', scope, user?.id ?? 'anonymous'],
    queryFn: () => accessApi.getState(),
    enabled: authChecked && isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });
  const employeeQuery = useQuery({
    queryKey: ['access-employee', user?.id ?? 'anonymous'],
    queryFn: () => employeeApi.getMine(),
    enabled: authChecked && isAuthenticated && scope === 'client' && accessQuery.isSuccess,
    retry: false,
    staleTime: 30_000,
  });

  if (isLoadingAuth || !authChecked || (isAuthenticated && accessQuery.isLoading)) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (accessQuery.error?.status === 401) {
    void authService.signOut().catch(() => undefined);
    return <Navigate to="/login" replace state={{ from: location, reason: 'session_expired' }} />;
  }

  if (accessQuery.isError) {
    return <AccessErrorScreen onRetry={() => accessQuery.refetch()} />;
  }

  if (scope === 'client' && accessQuery.data?.application_status === 'approved'
    && accessQuery.data?.workspace_provisioned
    && location.pathname !== '/dashboard/onboarding'
    && employeeQuery.isSuccess && !employeeQuery.data?.employee) {
    return <Navigate to="/dashboard/onboarding" replace />;
  }

  const access = accessQuery.data;

  if (scope === 'admin') {
    if (!access?.is_admin) {
      return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
  }

  if (access?.is_admin) {
    return <Navigate to="/admin" replace />;
  }

  if (access?.email_verified === false) {
    return <Navigate to="/verify-email" replace state={{ email: access.email }} />;
  }

  if (access?.application_status === 'missing') {
    return <Navigate to="/signup" replace />;
  }

  if (access?.application_status === 'pending') {
    return <Navigate to="/application-pending" replace />;
  }

  if (access?.application_status === 'rejected') {
    return <Navigate to="/application-rejected" replace />;
  }

  if (access?.application_status === 'approved' && !access?.workspace_provisioned) {
    return <Navigate to="/provisioning" replace />;
  }

  return <Outlet />;
}
