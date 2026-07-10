const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Building2, Users, DollarSign, TrendingUp, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function CRMAccounts() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: () => db.entities.User.list() });
  const { data: services = [] } = useQuery({ queryKey: ['crm-all-services'], queryFn: () => db.entities.ClientService.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['crm-all-invoices'], queryFn: () => db.entities.Invoice.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['crm-deals'], queryFn: () => db.entities.Project.list() });

  const clients = users.filter(u => u.role !== 'admin');

  // Group by company
  const accounts = {};
  clients.forEach(c => {
    const company = c.company || c.full_name?.split(' ').slice(-1)[0] + ' (Personal)' || 'Unassigned';
    if (!accounts[company]) accounts[company] = { company, contacts: [], revenue: 0, outstanding: 0, projects: 0 };
    accounts[company].contacts.push(c);
    invoices.filter(i => i.client_email === c.email).forEach(i => {
      if (i.status === 'paid') accounts[company].revenue += i.total || 0;
      if (i.status === 'sent' || i.status === 'overdue') accounts[company].outstanding += i.total || 0;
    });
    accounts[company].projects += projects.filter(p => p.client_email === c.email).length;
  });

  const accountList = Object.values(accounts).filter(a => {
    const q = search.toLowerCase();
    return !q || a.company.toLowerCase().includes(q);
  });

  const totalRevenue = accountList.reduce((a, x) => a + x.revenue, 0);
  const totalOutstanding = accountList.reduce((a, x) => a + x.outstanding, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Accounts</h1>
        <p className="text-sm text-slate-500 mt-0.5">{accountList.length} companies · R{totalRevenue.toLocaleString()} revenue · R{totalOutstanding.toLocaleString()} outstanding</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search accounts…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {accountList.map(acc => (
          <div key={acc.company} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelected(acc)}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{acc.contacts.length} contacts</span>
            </div>
            <p className="font-semibold text-slate-900 truncate">{acc.company}</p>
            <p className="text-xs text-slate-400 mb-4">{acc.contacts[0]?.email}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-emerald-600">R{(acc.revenue / 1000).toFixed(1)}k</p>
                <p className="text-[10px] text-slate-400">Revenue</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-orange-600">R{(acc.outstanding / 1000).toFixed(1)}k</p>
                <p className="text-[10px] text-slate-400">Outstanding</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-sm font-bold text-slate-700">{acc.projects}</p>
                <p className="text-[10px] text-slate-400">Projects</p>
              </div>
            </div>
          </div>
        ))}
        {accountList.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No accounts found</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-white flex flex-col h-full shadow-2xl overflow-y-auto">
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">{selected.company}</h2>
                  <p className="text-sm text-slate-500">{selected.contacts.length} contacts</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">R{selected.revenue.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Total Revenue</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-orange-600">R{selected.outstanding.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Outstanding</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Contacts</h3>
                <div className="space-y-2">
                  {selected.contacts.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">{(c.full_name || c.email)[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{c.full_name || '—'}</p>
                        <p className="text-xs text-slate-400">{c.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}