import appServices from '@/lib/app-services';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Plus, X, Save, Loader2, Megaphone, Edit2, Trash2, TrendingUp, DollarSign, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
};

const TYPE_ICONS = { email: '📧', social: '📱', referral: '🤝', event: '📅', other: '📌' };

function CampaignModal({ campaign, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!campaign?.id;
  const [form, setForm] = useState(campaign || { name: '', type: 'email', status: 'draft', channel: '', budget: 0, start_date: '', end_date: '', notes: '' });

  const save = useMutation({
    mutationFn: data => isEdit ? appServices.records.Campaign.update(data.id, data) : appServices.records.Campaign.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-campaigns'] }); toast.success(isEdit ? 'Campaign updated' : 'Campaign created'); onClose(); },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-bold text-slate-900">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Campaign Name *</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Summer Lead Gen" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Type</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="email">Email</option><option value="social">Social</option><option value="referral">Referral</option><option value="event">Event</option><option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Status</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Channel</label>
            <Input value={form.channel || ''} onChange={e => set('channel', e.target.value)} placeholder="LinkedIn, Newsletter, etc." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Budget (R)</label>
              <Input type="number" value={form.budget || 0} onChange={e => set('budget', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Leads Generated</label>
              <Input type="number" value={form.leads_generated || 0} onChange={e => set('leads_generated', Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Start Date</label>
              <Input type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">End Date</label>
              <Input type="date" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Notes</label>
            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name || save.isPending} className="bg-indigo-600 hover:bg-indigo-700" onClick={() => save.mutate(form)}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CRMMarketing() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['crm-campaigns'], queryFn: () => appServices.records.Campaign.list('-created_date') });
  const { data: subscribers = [] } = useQuery({ queryKey: ['crm-subscribers'], queryFn: () => appServices.records.Subscriber.list() });
  const { data: leads = [] } = useQuery({ queryKey: ['crm-leads'], queryFn: () => appServices.records.Inquiry.list() });

  const deleteCampaign = useMutation({
    mutationFn: id => appServices.records.Campaign.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-campaigns'] }); toast.success('Campaign deleted'); },
  });

  const totalBudget = campaigns.reduce((a, c) => a + (c.budget || 0), 0);
  const totalLeads = campaigns.reduce((a, c) => a + (c.leads_generated || 0), 0);
  const activeCount = campaigns.filter(c => c.status === 'active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Marketing Hub</h1>
          <p className="text-sm text-slate-500 mt-0.5">{campaigns.length} campaigns · {activeCount} active</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5" onClick={() => { setEditItem(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> New Campaign
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Campaigns', value: campaigns.length, icon: Megaphone, gradient: 'from-pink-500 to-rose-600' },
          { label: 'Total Budget', value: `R${totalBudget.toLocaleString()}`, icon: DollarSign, gradient: 'from-emerald-500 to-emerald-600' },
          { label: 'Leads Generated', value: totalLeads, icon: TrendingUp, gradient: 'from-blue-500 to-blue-600' },
          { label: 'Subscribers', value: subscribers.filter(s => s.status === 'active').length, icon: Users, gradient: 'from-violet-500 to-violet-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.gradient} flex items-center justify-center mb-3`}>
              <k.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl font-bold text-slate-900">{k.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : campaigns.length === 0 ? (
        <div className="py-16 text-center">
          <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No campaigns yet</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{TYPE_ICONS[c.type] || '📌'}</span>
                  <div>
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    {c.channel && <p className="text-xs text-slate-400">{c.channel}</p>}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG[c.status]?.color}`}>{STATUS_CONFIG[c.status]?.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-sm font-bold text-slate-800">R{c.budget || 0}</p>
                  <p className="text-[10px] text-slate-400">Budget</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-sm font-bold text-blue-600">{c.leads_generated || 0}</p>
                  <p className="text-[10px] text-slate-400">Leads</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-sm font-bold text-green-600">{c.conversions || 0}</p>
                  <p className="text-[10px] text-slate-400">Conv.</p>
                </div>
              </div>
              {(c.start_date || c.end_date) && (
                <p className="text-xs text-slate-400 mb-3">
                  {c.start_date ? format(new Date(c.start_date), 'dd MMM') : '—'} → {c.end_date ? format(new Date(c.end_date), 'dd MMM') : '—'}
                </p>
              )}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600" onClick={() => { setEditItem(c); setShowModal(true); }}>
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" onClick={() => deleteCampaign.mutate(c.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <CampaignModal campaign={editItem} onClose={() => { setShowModal(false); setEditItem(null); }} />}
    </div>
  );
}