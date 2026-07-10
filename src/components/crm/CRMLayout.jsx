import React, { useState } from 'react';

import {
  LayoutDashboard, Users, Contact, Building2, TrendingUp, CheckSquare,
  Mail, BarChart3, Megaphone, Headphones, FolderOpen, UserCog,
  Settings, ChevronLeft, ChevronRight, Bell, Search, Plus, HelpCircle,
  LogOut, Menu, X, Zap, Calendar, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'leads', label: 'Leads', icon: TrendingUp, badge: null },
      { id: 'contacts', label: 'Contacts', icon: Contact },
      { id: 'accounts', label: 'Accounts', icon: Building2 },
      { id: 'deals', label: 'Deals', icon: Zap },
    ]
  },
  {
    label: 'ACTIVITY',
    items: [
      { id: 'activities', label: 'Tasks', icon: CheckSquare },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'emails', label: 'Emails', icon: Mail },
    ]
  },
  {
    label: 'INSIGHTS',
    items: [
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'marketing', label: 'Marketing', icon: Megaphone },
    ]
  },
  {
    label: 'SERVICE',
    items: [
      { id: 'support', label: 'Support', icon: Headphones },
      { id: 'documents', label: 'Documents', icon: FolderOpen },
    ]
  },
  {
    label: 'ADMIN',
    items: [
      { id: 'users', label: 'Users', icon: UserCog },
      { id: 'settings', label: 'Settings', icon: Settings },
    ]
  },
];

export default function CRMLayout({ activeModule, onModuleChange, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);

  const activeLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === activeModule)?.label || 'CRM';

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 z-30 flex-shrink-0 shadow-sm">
        <button className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5 mr-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white text-xs font-bold tracking-tight">FS</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-sm text-slate-900 leading-none block">Fullscope</span>
            <span className="text-xs text-slate-400 leading-none">CRM Platform</span>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-1 text-sm text-slate-400">
          <span>CRM</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-700 font-medium">{activeLabel}</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm ml-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              className="pl-8 h-8 text-sm bg-slate-50 border-slate-200 focus:bg-white"
              placeholder="Search CRM…"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Button size="sm" className="gap-1.5 h-8 text-xs hidden sm:flex bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => onModuleChange('leads')}>
            <Plus className="w-3.5 h-3.5" /> New Lead
          </Button>

          {/* Notifications */}
          <div className="relative">
            <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors relative" onClick={() => setNotifOpen(v => !v)}>
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-10 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-3">
                <p className="text-xs font-semibold text-slate-500 mb-2 px-1">NOTIFICATIONS</p>
                <div className="text-xs text-slate-400 text-center py-4">No new notifications</div>
              </div>
            )}
          </div>

          <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <HelpCircle className="w-4 h-4 text-slate-600" />
          </button>

          {/* Back to Admin */}
          <Link to="/admin" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors ml-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Admin
          </Link>

          <button className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center ml-1 flex-shrink-0 shadow-sm">
            <span className="text-white text-xs font-bold">A</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          fixed md:static top-14 left-0 bottom-0 z-40
          bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ease-in-out
          ${collapsed ? 'md:w-[58px]' : 'w-56'}
          shadow-sm
        `}>
          <nav className="flex-1 py-3 overflow-y-auto space-y-4 px-2">
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                {!collapsed && (
                  <p className="text-[10px] font-semibold text-slate-400 tracking-widest px-2 mb-1">{section.label}</p>
                )}
                <div className="space-y-0.5">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const active = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { onModuleChange(item.id); setMobileOpen(false); }}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-150
                          ${active
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && item.badge && (
                          <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">{item.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="px-2 pb-3 border-t border-slate-100 pt-2 space-y-1">
            <button
              className="hidden md:flex w-full items-center justify-center p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
              onClick={() => setCollapsed(v => !v)}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-slate-50 min-w-0" onClick={() => notifOpen && setNotifOpen(false)}>
          {children}
        </main>
      </div>
    </div>
  );
}