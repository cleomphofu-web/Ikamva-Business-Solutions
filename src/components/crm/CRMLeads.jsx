const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Plus, Search, X, Save, Loader2, ChevronRight, Star, TrendingUp,
  Mail, Phone, Building2, Globe, Calendar, MoreHorizontal, Edit2, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

const LEAD_STATUSES = [
  { key: 'new', label: 'New', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'contacted', label: 'Contacted', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'qualified', label: 'Qualified', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'proposal', label: 'Proposal', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'converted', label: 'Converted', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700 border-red-200' },
];

const SOURCES = ['Website', 'Referral', 'Social Media', 'Cold Outreach', 'Event', 'Partner', 'Other'];

const SCORE_COLOR = (score) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
};

function LeadModal({ lead, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!lead?.id;
  const [form, setForm] = useState(lead || {
    name: '', email: '', phone: '', company: '', source: 'Website',
    status: 'new', score: 50, message: '', service: 'general', plan: 'starter'
  });

  const save = useMutation({
    mutationFn: data => isEdit
      ? db.entities.Inquiry.update(data.id, data)
      : db.entities.Inquiry.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success(isEdit ? 'Lead updated' : 'Lead created');
      onClose();
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900">{isEdit ? 'Edit Lead' : 'New Lead'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Full Name *</label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Email *</label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@company.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Phone</label>
              <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+27 00 000 0000" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Company</label>
              <Input value={form.company || ''} onChange={e => set('company', e.target.value)} placeholder="Acme Inc." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Status</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.status} onChange={e => set('status', e.target.value)}>
                {LEAD_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Source</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.source || 'Website'} onChange={e => set('source', e.target.value)}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Lead Score</label>
              <Input type="number" min={0} max={100} value={form.score || 50} onChange={e => set('score', Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Service Interest</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.service} onChange={e => set('service', e.target.value)}>
                <option value="general">General</option>
                <option value="schedule_management">Schedule Management</option>
                <option value="email_management">Email Management</option>
                <option value="document_preparation">Document Preparation</option>
                <option value="communication_hub">Communication Hub</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Plan Interest</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.plan} onChange={e => set('plan', e.target.value)}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Notes / Message</label>
            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={3}
              value={form.message || ''} onChange={e => set('message', e.target.value)} placeholder="Lead notes…" />
          </div>
          {form.notes !== undefined && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Internal Notes</label>
              <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2}
                value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Admin notes…" />
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name || !form.email || save.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => save.mutate(form)}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Update Lead' : 'Create Lead'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CRMLeads() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['crm-leads'],
    queryFn: () => db.entities.Inquiry.list('-created_date'),
  });

  const updateLead = useMutation({
    mutationFn: ({ id, data }) => db.entities.Inquiry.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-leads'] }); toast.success('Status updated'); },
  });

  const deleteLead = useMutation({
    mutationFn: id => db.entities.Inquiry.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-leads'] }); toast.success('Lead removed'); },
  });

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || l.name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchQ && matchStatus;
  });

  const counts = LEAD_STATUSES.reduce((acc, s) => { acc[s.key] = leads.filter(l => l.status === s.key).length; return acc; }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leads Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{leads.length} total leads in pipeline</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 flex-shrink-0" onClick={() => { setEditLead(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> New Lead
        </Button>
      </div>

      {/* Status pipeline chips */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {LEAD_STATUSES.map(s => (
          <div key={s.key} className="bg-white rounded-xl border border-slate-200 p-3 text-center cursor-pointer hover:border-indigo-300 transition-colors"
            onClick={() => setFilterStatus(s.key === filterStatus ? 'all' : s.key)}>
            <p className="text-xl font-bold text-slate-900">{counts[s.key] || 0}</p>
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mt-1 ${s.color}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search name, email, company…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            All ({leads.length})
          </button>
          {LEAD_STATUSES.map(s => (
            <button key={s.key} onClick={() => setFilterStatus(s.key === filterStatus ? 'all' : s.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filterStatus === s.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No leads found</p>
            <p className="text-xs text-slate-400 mt-1">Create your first lead to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const statusCfg = LEAD_STATUSES.find(s => s.key === lead.status) || LEAD_STATUSES[0];
                  const score = lead.score || 0;
                  return (
                    <tr key={lead.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-indigo-600">{(lead.name || lead.email)[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{lead.name || '—'}</p>
                            <p className="text-xs text-slate-400">{lead.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {lead.company ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span className="text-sm text-slate-600">{lead.company}</span>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={lead.status}
                          onChange={e => updateLead.mutate({ id: lead.id, data: { status: e.target.value } })}
                          onClick={e => e.stopPropagation()}
                          className={`text-xs font-medium px-2.5 py-1.5 rounded-full border cursor-pointer bg-transparent ${statusCfg.color}`}
                        >
                          {LEAD_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-500">{lead.source || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full">
                            <div className={`h-full rounded-full ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                              style={{ width: `${score}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${SCORE_COLOR(score)}`}>{score}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-500 capitalize">{lead.plan || '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {lead.created_date ? format(new Date(lead.created_date), 'dd MMM yy') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                            onClick={() => { setEditLead(lead); setShowModal(true); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                            onClick={() => deleteLead.mutate(lead.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {showModal && <LeadModal lead={editLead} onClose={() => { setShowModal(false); setEditLead(null); }} />}
    </div>
  );
}