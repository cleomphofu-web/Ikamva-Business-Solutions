import appServices from '@/lib/app-services';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Plus, X, Save, Loader2, DollarSign, Calendar, User, Zap, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STAGES = [
  { key: 'prospecting', label: 'Prospecting', color: 'border-t-slate-400', bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-600' },
  { key: 'qualification', label: 'Qualification', color: 'border-t-blue-400', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  { key: 'proposal', label: 'Proposal', color: 'border-t-amber-400', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  { key: 'negotiation', label: 'Negotiation', color: 'border-t-orange-400', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
  { key: 'closed_won', label: 'Closed Won', color: 'border-t-green-500', bg: 'bg-green-50', badge: 'bg-green-100 text-green-700' },
  { key: 'closed_lost', label: 'Closed Lost', color: 'border-t-red-400', bg: 'bg-red-50', badge: 'bg-red-100 text-red-600' },
];

function DealCard({ deal, onEdit, onDelete, onStageChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const daysToClose = deal.due_date
    ? Math.ceil((new Date(deal.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow group relative">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800 leading-snug flex-1 pr-2">{deal.title || deal.name}</p>
        <div className="relative flex-shrink-0">
          <button className="p-1 rounded-lg hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setMenuOpen(v => !v)}>
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 bg-white rounded-xl border border-slate-200 shadow-lg z-10 py-1 w-32">
              <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2"
                onClick={() => { onEdit(deal); setMenuOpen(false); }}>
                <Edit2 className="w-3 h-3" /> Edit
              </button>
              <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                onClick={() => { onDelete(deal.id); setMenuOpen(false); }}>
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {deal.company && (
        <div className="flex items-center gap-1 mb-2">
          <User className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-500">{deal.company}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-600">
            R{(deal.value || 0).toLocaleString()}
          </span>
        </div>
        {daysToClose !== null && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${daysToClose < 0 ? 'bg-red-100 text-red-600' : daysToClose <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
            {daysToClose < 0 ? `${Math.abs(daysToClose)}d overdue` : `${daysToClose}d left`}
          </span>
        )}
      </div>

      {/* Stage mover */}
      <div className="flex gap-1 mt-3 pt-3 border-t border-slate-100">
        <select
          value={deal.stage || 'prospecting'}
          onChange={e => onStageChange(deal.id, e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 w-full"
          onClick={e => e.stopPropagation()}
        >
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function DealModal({ deal, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!deal?.id;
  const [form, setForm] = useState(deal || {
    title: '', company: '', email: '', value: 0, stage: 'prospecting',
    probability: 50, due_date: '', notes: ''
  });

  const save = useMutation({
    mutationFn: data => isEdit
      ? appServices.records.Project.update(data.id, data)
      : appServices.records.Project.create({ ...data, client_email: data.email || 'unknown@crm.com', status: 'not_started', type: 'project_based' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success(isEdit ? 'Deal updated' : 'Deal created');
      onClose();
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">{isEdit ? 'Edit Deal' : 'New Deal'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Deal Title *</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Acme — Starter Plan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Company / Client</label>
              <Input value={form.company || ''} onChange={e => set('company', e.target.value)} placeholder="Company name" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Contact Email</label>
              <Input type="email" value={form.email || form.client_email || ''} onChange={e => set('email', e.target.value)} placeholder="email@company.com" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Deal Value (R)</label>
              <Input type="number" value={form.value || form.fixed_quote || 0} onChange={e => set('value', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Stage</label>
              <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                value={form.stage || 'prospecting'} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Probability %</label>
              <Input type="number" min={0} max={100} value={form.probability || 50} onChange={e => set('probability', Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Expected Close Date</label>
            <Input type="date" value={form.due_date || form.close_date || ''} onChange={e => set('due_date', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Notes</label>
            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={2}
              value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Deal notes…" />
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.title || save.isPending} className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => save.mutate(form)}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Update' : 'Create Deal'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CRMDeals() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editDeal, setEditDeal] = useState(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['crm-deals'],
    queryFn: () => appServices.records.Project.list('-created_date'),
  });

  const updateStage = useMutation({
    mutationFn: ({ id, stage }) => appServices.records.Project.update(id, { stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-deals'] }),
  });

  const deleteDeal = useMutation({
    mutationFn: id => appServices.records.Project.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-deals'] }); toast.success('Deal removed'); },
  });

  const dealsByStage = STAGES.reduce((acc, s) => {
    acc[s.key] = projects.filter(p => (p.stage || 'prospecting') === s.key);
    return acc;
  }, {});

  const totalPipelineValue = projects.reduce((a, p) => a + (p.value || p.fixed_quote || 0), 0);
  const wonDeals = dealsByStage['closed_won'] || [];
  const wonValue = wonDeals.reduce((a, p) => a + (p.value || p.fixed_quote || 0), 0);

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {projects.length} deals · R{totalPipelineValue.toLocaleString()} pipeline · R{wonValue.toLocaleString()} won
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5" onClick={() => { setEditDeal(null); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> New Deal
        </Button>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[900px]">
            {STAGES.map(stage => {
              const deals = dealsByStage[stage.key] || [];
              const stageValue = deals.reduce((a, d) => a + (d.value || d.fixed_quote || 0), 0);
              return (
                <div key={stage.key} className="flex-1 min-w-[200px] max-w-[260px]">
                  <div className={`rounded-2xl border border-slate-200 ${stage.bg} border-t-4 ${stage.color} overflow-hidden`}>
                    <div className="px-3 py-3 border-b border-slate-200/70">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stage.badge}`}>{stage.label}</span>
                        <span className="text-xs text-slate-500 font-medium">{deals.length}</span>
                      </div>
                      {stageValue > 0 && (
                        <p className="text-xs text-slate-500 mt-1.5 font-medium">R{stageValue.toLocaleString()}</p>
                      )}
                    </div>
                    <div className="p-2 space-y-2 min-h-[300px]">
                      {deals.map(deal => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onEdit={d => { setEditDeal(d); setShowModal(true); }}
                          onDelete={id => deleteDeal.mutate(id)}
                          onStageChange={(id, stage) => updateStage.mutate({ id, stage })}
                        />
                      ))}
                      {deals.length === 0 && (
                        <div className="py-6 text-center">
                          <p className="text-xs text-slate-400">No deals here</p>
                        </div>
                      )}
                      <button
                        className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-xl transition-colors flex items-center justify-center gap-1"
                        onClick={() => { setEditDeal({ stage: stage.key }); setShowModal(true); }}
                      >
                        <Plus className="w-3 h-3" /> Add deal
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && <DealModal deal={editDeal} onClose={() => { setShowModal(false); setEditDeal(null); }} />}
    </div>
  );
}