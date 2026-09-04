import appServices from '@/lib/app-services';
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  TrendingUp, Users, CheckSquare, Clock, DollarSign, Activity,
  ArrowUpRight, ArrowDownRight, Phone, Mail, Calendar, Zap, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function KPICard({ label, value, change, icon: Icon, gradient, sub }) {
  const positive = change >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${gradient}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${positive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change)}%
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-sm text-slate-500 mt-1.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function ActivityItem({ icon: Icon, iconClass, title, subtitle, time }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 leading-snug truncate">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
      </div>
      <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">{time}</span>
    </div>
  );
}

export default function CRMDashboard({ onModuleChange }) {
  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: () => appServices.records.User.list() });
  const { data: tasks = [] } = useQuery({ queryKey: ['crm-all-tasks'], queryFn: () => appServices.records.Task.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['crm-all-invoices'], queryFn: () => appServices.records.Invoice.list() });
  const { data: notes = [] } = useQuery({ queryKey: ['crm-all-notes'], queryFn: () => appServices.records.CRMNote.list('-created_date', 50) });
  const { data: services = [] } = useQuery({ queryKey: ['crm-all-services'], queryFn: () => appServices.records.ClientService.list() });

  const clients = users.filter(u => u.role !== 'admin');
  const activeServices = services.filter(s => s.status === 'active');
  const openTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalRevenue = paidInvoices.reduce((a, i) => a + (i.total || 0), 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((a, i) => a + (i.total || 0), 0);
  const followUps = notes.filter(n => n.next_action_date && new Date(n.next_action_date) >= new Date());
  const overdueFollowUps = notes.filter(n => n.next_action_date && new Date(n.next_action_date) < new Date());

  // Build monthly revenue chart data
  const revenueByMonth = {};
  paidInvoices.forEach(inv => {
    const key = inv.month || 'Unknown';
    revenueByMonth[key] = (revenueByMonth[key] || 0) + (inv.total || 0);
  });
  const revenueChart = Object.entries(revenueByMonth).slice(-7).map(([month, revenue]) => ({ month: month.split(' ')[0], revenue }));

  // Fill with sample months if empty
  const chartData = revenueChart.length > 0 ? revenueChart : [
    { month: 'Jan', revenue: 0 }, { month: 'Feb', revenue: 0 }, { month: 'Mar', revenue: 0 },
    { month: 'Apr', revenue: 0 }, { month: 'May', revenue: 0 }, { month: 'Jun', revenue: 0 },
  ];

  const NOTE_META = {
    call: { icon: Phone, cls: 'bg-blue-100 text-blue-600' },
    email: { icon: Mail, cls: 'bg-purple-100 text-purple-600' },
    meeting: { icon: Calendar, cls: 'bg-green-100 text-green-600' },
    note: { icon: Activity, cls: 'bg-slate-100 text-slate-600' },
    follow_up: { icon: Clock, cls: 'bg-orange-100 text-orange-600' },
  };

  const taskCompletion = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Executive Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live Data
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard label="Total Clients" value={clients.length} change={12} icon={Users}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600" sub={`${activeServices.length} on active plans`} />
        <KPICard label="Revenue Collected" value={`R${totalRevenue.toLocaleString()}`} change={23} icon={DollarSign}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" sub={`${paidInvoices.length} paid invoices`} />
        <KPICard label="Outstanding" value={`R${outstanding.toLocaleString()}`} change={-5} icon={AlertCircle}
          gradient="bg-gradient-to-br from-orange-500 to-orange-600" sub="Across all accounts" />
        <KPICard label="Tasks Completed" value={`${taskCompletion}%`} change={8} icon={CheckSquare}
          gradient="bg-gradient-to-br from-violet-500 to-violet-600" sub={`${completedTasks.length} of ${tasks.length} tasks`} />
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">Revenue Overview</h3>
              <p className="text-xs text-slate-400 mt-0.5">Monthly collected payments</p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `R${v >= 1000 ? `${v / 1000}k` : v}`} />
              <Tooltip formatter={v => [`R${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-900">Task Pipeline</h3>
            <button onClick={() => onModuleChange('activities')} className="text-xs text-indigo-600 hover:underline font-medium">View all</button>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Pending', count: tasks.filter(t => t.status === 'pending').length, color: 'bg-amber-500', light: 'bg-amber-50 text-amber-700' },
              { label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, color: 'bg-blue-500', light: 'bg-blue-50 text-blue-700' },
              { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: 'bg-green-500', light: 'bg-green-50 text-green-700' },
            ].map(s => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-600">{s.label}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.light}`}>{s.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.color} transition-all`}
                    style={{ width: `${tasks.length ? (s.count / tasks.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{openTasks.length} open tasks</span>
              <span>{tasks.length} total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-900">Recent Activity</h3>
            <button onClick={() => onModuleChange('contacts')} className="text-xs text-indigo-600 hover:underline font-medium">View contacts</button>
          </div>
          <div>
            {notes.slice(0, 7).map(n => {
              const meta = NOTE_META[n.type] || NOTE_META.note;
              return (
                <ActivityItem
                  key={n.id}
                  icon={meta.icon}
                  iconClass={meta.cls}
                  title={n.content}
                  subtitle={`${n.client_email}${n.author ? ` · ${n.author}` : ''}`}
                  time={n.created_date ? format(new Date(n.created_date), 'dd MMM') : ''}
                />
              );
            })}
            {notes.length === 0 && (
              <div className="py-8 text-center">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No activity logged yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Follow-ups & Metrics */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Follow-ups</h3>
              {overdueFollowUps.length > 0 && (
                <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">{overdueFollowUps.length} overdue</span>
              )}
            </div>
            <div className="space-y-2">
              {followUps.slice(0, 4).map(n => (
                <div key={n.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-orange-50 border border-orange-100">
                  <Clock className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate leading-snug">{n.next_action}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{n.next_action_date ? format(new Date(n.next_action_date), 'dd MMM') : ''}</p>
                  </div>
                </div>
              ))}
              {followUps.length === 0 && <p className="text-xs text-slate-400 py-2">No upcoming follow-ups</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Quick Metrics</h3>
            <div className="space-y-2">
              {[
                { label: 'Active Plans', val: activeServices.length, color: 'text-emerald-600' },
                { label: 'Open Tasks', val: openTasks.length, color: 'text-blue-600' },
                { label: 'Interactions', val: notes.length, color: 'text-violet-600' },
                { label: 'Total Invoices', val: invoices.length, color: 'text-slate-700' },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-500">{m.label}</span>
                  <span className={`text-sm font-bold ${m.color}`}>{m.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}