import authService from '@/lib/auth-service';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

import { LayoutDashboard, CheckSquare, Receipt, MessageSquare, Users, LogOut, FileText, Gift, FolderKanban, Calculator, BarChart3, ContactRound } from 'lucide-react';
import Logo from '@/components/landing/Logo';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Applications', href: '/admin/applications', icon: ContactRound },
  { label: 'Task Board', href: '/admin/tasks', icon: CheckSquare },
  { label: 'Invoices', href: '/admin/invoices', icon: Receipt },
  { label: 'Documents', href: '/admin/documents', icon: FileText },
  { label: 'Projects', href: '/admin/projects', icon: FolderKanban },
  { label: 'Quote Calculator', href: '/admin/quote-calculator', icon: Calculator },
  { label: 'Auto Reports', href: '/admin/auto-reports', icon: BarChart3 },
  { label: 'Client CRM', href: '/admin/crm', icon: ContactRound },
  { label: 'Inquiries', href: '/admin/inquiries', icon: MessageSquare },
  { label: 'Referrals', href: '/admin/referrals', icon: Gift },
  { label: 'Subscribers', href: '/admin/subscribers', icon: Users },
];

export default function AdminLayout({ children }) {
  const pathname = useLocation().pathname;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen gap-5 p-4 lg:p-5">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-72 shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/80 text-foreground shadow-2xl backdrop-blur-2xl lg:flex"
        >
          <div className="border-b border-white/10 p-5">
            <Link to="/" className="flex items-center justify-center rounded-2xl bg-white/6 border border-white/10 px-3 py-3 hover:bg-white/10 transition-colors">
              <Logo height={28} />
            </Link>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#fcfc03]">Platform Admin</p>
              <p className="mt-2 text-lg font-display font-semibold text-foreground">Approval cockpit</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Review applications, operations, and delivery signals.</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navItems.map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-[#fcfc03] text-black font-semibold shadow-md"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-4">
            <button
              onClick={() => authService.signOut({ redirectTo: '/' })}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </motion.aside>

        <div className="min-w-0 flex-1">
          <motion.header
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 rounded-3xl border border-white/10 bg-card/60 px-4 py-3 shadow-xl backdrop-blur-2xl lg:hidden"
          >
            <div className="flex items-center justify-between gap-3">
              <Link to="/" className="rounded-2xl bg-white/6 border border-white/10 px-3 py-2">
                <Logo height={24} />
              </Link>
              <button
                onClick={() => authService.signOut({ redirectTo: '/' })}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-foreground hover:bg-white/20 transition-colors"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                    pathname === item.href ? "bg-[#fcfc03] text-black" : "bg-white/5 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </motion.header>

          <motion.main
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[calc(100vh-2rem)] rounded-3xl border border-white/10 bg-card/50 p-5 shadow-2xl backdrop-blur-2xl md:p-8"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  );
}
