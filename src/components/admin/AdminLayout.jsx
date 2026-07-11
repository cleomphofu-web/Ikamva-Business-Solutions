import authService from '@/lib/auth-service';
import React from 'react';
import { Link } from 'react-router-dom';

import { LayoutDashboard, CheckSquare, Receipt, MessageSquare, Users, LogOut, FileText, Gift, FolderKanban, Calculator, BarChart3, ContactRound } from 'lucide-react';
import Logo from '@/components/landing/Logo';

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
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
  return (
    <div className="min-h-screen bg-secondary/30 flex">
      <aside className="w-60 bg-card border-r border-border/50 flex flex-col min-h-screen sticky top-0 h-screen">
        <div className="p-6 border-b border-border/50">
          <Link to="/" className="flex items-center">
            <Logo height={28} />
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border/50">
          <button
            onClick={() => authService.signOut({ redirectTo: '/' })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
