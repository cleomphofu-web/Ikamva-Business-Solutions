import React from 'react';
import { AppShell } from '@/components/ikamva/app-shell';

export default function DashboardLayout({ children, user }) {
  // The user object could be passed down to AppShell or workspace-adapter in the future.
  // For now, AppShell handles its own layout and retrieves data from the adapter.
  return <AppShell>{children}</AppShell>;
}

