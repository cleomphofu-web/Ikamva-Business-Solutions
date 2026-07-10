const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Plus, X, Save, Loader2, Headphones, Edit2, Trash2, Search, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600', icon: CheckCircle2 },
};

const PRIORITY_CONFIG = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

function TicketModal({ ticket, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!ticket?.id;
  const [form, setForm] = useState(ticket || { subject: '', client_email: '', status: 'open', priority: 'medium', category: 'general', description: '', assigned_to: '' });

  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: () => db.entities.User.list() });
  const clients = users.filter(u => u.role !== 'admin');

  const save = useMutation({
    mutationFn: data => isEdit ? db.entities.SupportTicket.update(data.id, data) : db.entities.SupportTicket.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-tickets'] }); toast.success(isEdit ? 'Ticket updated' : 'Ticket created'); onClose(); },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-bold text-slate-900">{isEdit ? 'Edit Ticket' : 'New Support Ticket'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Subject *</label>
            <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Issue subject" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Client *</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={form.client_email} onChange={e => set('client_email', e.target.value)}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.email}>{c.full_name || c.email}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Status</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Priority</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {Object.entries(PRIORITY_CONFIG).map(([k]) => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Category</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="billing">Billing</option><option value="technical">Technical</option><option value="service">Service</option><option value="general">General</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Assigned To</label>
            <Input value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder="VA or admin name" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Description</label>
            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={3} value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Issue details…" />
          </div>
          {isEdit && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Resolution</label>
              <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2} value={form.resolution || ''} onChange={e => set('resolution', e.target.value)} placeholder="Resolution notes…" />
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.subject || !form.client_email || save.isPending} className="bg-indigo-600 hover:bg-indigo-700" onClick={() => save.mutate(form)}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CRMSupport() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const { data: tickets = [], isLoading } = useQuery({ queryKey: ['crm-tickets'], queryFn: () => db.entities.SupportTicket.list('-created_date') });

  const updateStatus = useMutation({
    mutationFn: ({ id, data }) => db.entities.SupportTicket.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-tickets'] }),
  });
  const deleteTicket = useMutation({
    mutationFn: id => db.entities.SupportTicket.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-tickets'] }); toast.success('Ticket deleted'); },
  });

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || t.subject?.toLowerCase().includes(q) || t.client_email?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchQ && matchStatus;
  });

  const counts = Object.keys(STATUS_CONFIG).reduce((acc, k) => { acc[k] = tickets.filter(t => t.status === k).length; return acc; }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Support Tickets</h1>
          <p className="text-sm text-slate-500 mt-0.5">{tickets.length} total · {counts.open || 0} open · {counts.urgent || 0} urgent</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5" onClick={() => { setEditItem(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}><Icon className="w-3 h-3" />{cfg.label}</span>
                <span className="text-lg font-bold text-slate-900">{counts[key] || 0}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3.5 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search tickets…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setFilterStatus('all')} className={`px-3 py-1 rounded-lg text-xs font-medium ${filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>All</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Headphones className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Priority</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
                  return (
                    <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{t.subject}</p>
                        {t.assigned_to && <p className="text-xs text-slate-400">Assigned: {t.assigned_to}</p>}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-xs text-slate-500">{t.client_email}</td>
                      <td className="px-5 py-3.5">
                        <select value={t.status} onChange={e => updateStatus.mutate({ id: t.id, data: { status: e.target.value } })} onClick={e => e.stopPropagation()} className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer bg-transparent ${cfg.color}`}>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium}`}>{t.priority}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell"><span className="text-xs text-slate-500 capitalize">{t.category}</span></td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-slate-400">{t.created_date ? format(new Date(t.created_date), 'dd MMM yy') : '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600" onClick={() => { setEditItem(t); setShowModal(true); }}><Edit2 className="w-3.5 h-3.5" /></button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" onClick={() => deleteTicket.mutate(t.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <TicketModal ticket={editItem} onClose={() => { setShowModal(false); setEditItem(null); }} />}
    </div>
  );
}