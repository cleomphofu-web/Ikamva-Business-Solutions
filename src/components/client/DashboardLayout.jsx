import authService from '@/lib/auth-service';
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { LayoutDashboard, Clock, FileText, BarChart3, LogOut, Menu, X, CheckSquare, Receipt, Gift, FolderKanban } from 'lucide-react';
import Logo from '@/components/landing/Logo';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Tasks', href: '/dashboard/tasks', icon: CheckSquare },
  { label: 'Service Hours', href: '/dashboard/hours', icon: Clock },
  { label: 'Usage Reports', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'My Documents', href: '/dashboard/documents', icon: FileText },
  { label: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { label: 'Billing', href: '/dashboard/billing', icon: Receipt },
  { label: 'Referrals', href: '/dashboard/referrals', icon: Gift },
];

export default function DashboardLayout({ children, user }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col">
      {/* Top bar */}
      <header className="bg-card border-b border-border/50 h-16 flex items-center px-6 gap-4 sticky top-0 z-40">
        <Link to="/" className="flex items-center mr-6">
          <Logo height={28} />
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.full_name || user?.email}</span>
          <button
            onClick={() => authService.signOut({ redirectTo: '/' })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Logout</span>
          </button>
          <button className="md:hidden p-1" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden bg-card border-b border-border/50 px-4 py-3 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
