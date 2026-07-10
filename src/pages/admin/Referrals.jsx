const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Gift, Pencil, X, Save } from 'lucide-react';

const STATUSES = ['pending', 'contacted', 'converted', 'rewarded'];
const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-700',
  contacted: 'bg-blue-100 text-blue-700',
  converted: 'bg-green-100 text-green-700',
  rewarded:  'bg-violet-100 text-violet-700',
};

function EditModal({ referral, onClose, onSave, saving }) {
  const [form, setForm] = useState({ status: referral.status, reward_amount: referral.reward_amount || 500 });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-semibold">Update Referral</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Referral for</label>
            <p className="text-sm font-medium">{referral.referred_name} ({referral.referred_email})</p>
            <p className="text-xs text-muted-foreground">Referred by: {referral.referrer_email}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
            <select
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reward Amount (R)</label>
            <Input type="number" value={form.reward_amount} onChange={e => setForm(f => ({ ...f, reward_amount: parseFloat(e.target.value) || 0 }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-border/50">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminReferrals() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: () => db.entities.Referral.list('-created_date'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => db.entities.Referral.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-referrals'] }); setEditing(null); },
  });

  const filtered = referrals.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchSearch = !search || r.referred_name?.toLowerCase().includes(search.toLowerCase()) || r.referred_email?.toLowerCase().includes(search.toLowerCase()) || r.referrer_email?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalRewarded = referrals.filter(r => r.status === 'rewarded').reduce((s, r) => s + (r.reward_amount || 500), 0);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Referrals</h1>
          <p className="text-muted-foreground mt-1">Manage the referral programme and rewards</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">Total Referrals</p>
          <p className="text-3xl font-bold">{referrals.length}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">Converted</p>
          <p className="text-3xl font-bold text-green-600">{referrals.filter(r => ['converted','rewarded'].includes(r.status)).length}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">Rewards Issued</p>
          <p className="text-3xl font-bold text-violet-600">R {totalRewarded.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <Input className="w-56" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <Gift className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No referrals found</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left">
                <th className="px-5 py-3.5 font-medium text-muted-foreground">Referred</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden md:table-cell">Referred By</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden lg:table-cell">Company</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground">Reward</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium">{r.referred_name}</p>
                    <p className="text-xs text-muted-foreground">{r.referred_email}</p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-xs text-muted-foreground">{r.referrer_email}</td>
                  <td className="px-5 py-4 hidden lg:table-cell text-xs text-muted-foreground">{r.referred_company || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-medium">
                    {r.status === 'rewarded' ? <span className="text-green-600">R{(r.reward_amount || 500).toLocaleString()}</span> : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => setEditing(r)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditModal
          referral={editing}
          onClose={() => setEditing(null)}
          onSave={data => updateMut.mutate({ id: editing.id, data })}
          saving={updateMut.isPending}
        />
      )}
    </AdminLayout>
  );
}