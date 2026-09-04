import appServices from '@/lib/app-services';
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, DollarSign, CheckSquare, Users, FileText, Activity } from 'lucide-react';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function CRMReports() {
  const { data: tasks = [] } = useQuery({ queryKey: ['crm-all-tasks'], queryFn: () => appServices.records.Task.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['crm-all-invoices'], queryFn: () => appServices.records.Invoice.list() });
  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: () => appServices.records.User.list() });
  const { data: notes = [] } = useQuery({ queryKey: ['crm-all-notes'], queryFn: () => appServices.records.CRMNote.list('-created_date', 200) });
  const { data: leads = [] } = useQuery({ queryKey: ['crm-leads'], queryFn: () => appServices.records.Inquiry.list() });

  const clients = users.filter(u => u.role !== 'admin');
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalRevenue = paidInvoices.reduce((a, i) => a + (i.total || 0), 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((a, i) => a + (i.total || 0), 0);
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const conversionRate = leads.length ? Math.round((convertedLeads / leads.length) * 100) : 0;

  const taskStatusData = [
    { name: 'Pending', value: tasks.filter(t => t.status === 'pending').length },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length },
    { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length },
  ].filter(d => d.value > 0);

  const invoiceStatusData = [
    { name: 'Draft', value: invoices.filter(i => i.status === 'draft').length },
    { name: 'Sent', value: invoices.filter(i => i.status === 'sent').length },
    { name: 'Paid', value: invoices.filter(i => i.status === 'paid').length },
    { name: 'Overdue', value: invoices.filter(i => i.status === 'overdue').length },
  ];

  const noteTypeData = ['call', 'email', 'meeting', 'note', 'follow_up'].map(type => ({
    name: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
    value: notes.filter(n => n.type === type).length,
  })).filter(d => d.value > 0);

  const leadStatusData = ['new', 'contacted', 'qualified', 'proposal', 'converted', 'lost'].map(status => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: leads.filter(l => l.status === status).length,
  })).filter(d => d.value > 0);

  const revenueByMonth = {};
  paidInvoices.forEach(inv => {
    const key = (inv.month || 'Unknown').split(' ')[0];
    revenueByMonth[key] = (revenueByMonth[key] || 0) + (inv.total || 0);
  });
  const revenueChartData = Object.entries(revenueByMonth).slice(-8).map(([month, revenue]) => ({ month, revenue }));
  const chartData = revenueChartData.length > 0 ? revenueChartData :
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(m => ({ month: m, revenue: 0 }));

  const kpis = [
    { label: 'Total Clients', value: clients.length, icon: Users, gradient: 'from-blue-500 to-blue-600', sub: 'Registered accounts' },
    { label: 'Revenue Collected', value: `R${totalRevenue.toLocaleString()}`, icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600', sub: `${paidInvoices.length} paid invoices` },
    { label: 'Outstanding', value: `R${outstanding.toLocaleString()}`, icon: FileText, gradient: 'from-orange-500 to-orange-600', sub: 'Pending payments' },
    { label: 'Lead Conversion', value: `${conversionRate}%`, icon: TrendingUp, gradient: 'from-violet-500 to-violet-600', sub: `${convertedLeads} of ${leads.length} leads` },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Business performance overview and insights</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.gradient} flex items-center justify-center mb-4`}>
              <k.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-slate-900 leading-none">{k.value}</p>
            <p className="text-sm text-slate-600 mt-1.5 font-medium">{k.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Area Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Revenue by Month</h3>
            <p className="text-xs text-slate-400 mt-0.5">Monthly collected payments trend</p>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1 rounded-full font-medium">
            Total: R{totalRevenue.toLocaleString()}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `R${v >= 1000 ? `${v / 1000}k` : v}`} />
            <Tooltip formatter={v => [`R${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revenueGrad2)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Task Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Task Status</h3>
          {taskStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={taskStatusData} cx="50%" cy="50%" outerRadius={65} innerRadius={30} dataKey="value">
                  {taskStatusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-300 text-sm">No task data</div>
          )}
          <div className="space-y-1.5 mt-2">
            {taskStatusData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                <span className="text-slate-600 flex-1">{d.name}</span>
                <span className="font-semibold text-slate-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Invoice Status</h3>
          <div className="space-y-3">
            {invoiceStatusData.map((item, i) => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-xs text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{item.value}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${invoices.length ? (item.value / invoices.length) * 100 : 0}%`, background: COLORS[i] }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-xs text-slate-400">
            <span>{invoices.length} total invoices</span>
            <span>R{totalRevenue.toLocaleString()} collected</span>
          </div>
        </div>

        {/* Interaction & Lead Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Interactions</h3>
            <div className="space-y-2">
              {noteTypeData.length > 0 ? noteTypeData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                  <span className="text-slate-600 flex-1">{item.name}</span>
                  <span className="font-bold text-slate-800">{item.value}</span>
                </div>
              )) : <p className="text-xs text-slate-400">No interactions logged</p>}
            </div>
          </div>
          {leadStatusData.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-3">Lead Pipeline</h3>
              <div className="space-y-2">
                {leadStatusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                    <span className="text-slate-600 flex-1">{item.name}</span>
                    <span className="font-bold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}