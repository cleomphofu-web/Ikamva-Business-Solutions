const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Send, X, Loader2, Mail, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const TEMPLATES = [
  { id: 'welcome', name: 'Welcome Email', subject: 'Welcome to Ikamva Virtual Admin!', body: 'Hi {{name}},\n\nWelcome to Ikamva Virtual Admin Assist! We\'re thrilled to have you on board.\n\nYour dedicated VA will be in touch shortly to get started.\n\nBest regards,\nThe Ikamva Team' },
  { id: 'followup', name: 'Follow-up', subject: 'Following up on your inquiry', body: 'Hi {{name}},\n\nI wanted to follow up on your inquiry about our virtual admin services. Do you have any questions I can answer?\n\nBest regards,\nThe Ikamva Team' },
  { id: 'invoice', name: 'Invoice Reminder', subject: 'Invoice reminder', body: 'Hi {{name}},\n\nThis is a friendly reminder that your invoice is now due. Please let us know if you have any questions.\n\nBest regards,\nThe Ikamva Team' },
  { id: 'blank', name: 'Blank', subject: '', body: '' },
];

export default function CRMEmails() {
  const qc = useQueryClient();
  const [showCompose, setShowCompose] = useState(false);

  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: () => db.entities.User.list() });
  const { data: leads = [] } = useQuery({ queryKey: ['crm-leads'], queryFn: () => db.entities.Inquiry.list('-created_date') });

  const clients = users.filter(u => u.role !== 'admin');
  const recipients = [
    ...clients.map(c => ({ email: c.email, name: c.full_name || c.email, type: 'Client' })),
    ...leads.map(l => ({ email: l.email, name: l.name || l.email, type: 'Lead' })),
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Email Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">Send emails to clients and leads</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5" onClick={() => setShowCompose(true)}>
          <Mail className="w-4 h-4" /> Compose
        </Button>
      </div>

      {/* Templates */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Templates</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TEMPLATES.filter(t => t.id !== 'blank').map(t => (
            <button key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-300 hover:shadow-sm transition-all"
              onClick={() => setShowCompose({ template: t })}>
              <FileText className="w-5 h-5 text-indigo-500 mb-2" />
              <p className="text-sm font-medium text-slate-800">{t.name}</p>
              <p className="text-xs text-slate-400 mt-1 truncate">{t.subject}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recipients overview */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Recipients ({recipients.length})</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {recipients.slice(0, 15).map(r => (
            <div key={r.email} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-600">{r.name[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-400">{r.email}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.type}</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowCompose({ recipient: r })}>
                <Mail className="w-3 h-3" /> Email
              </Button>
            </div>
          ))}
          {recipients.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No recipients available</p>}
        </div>
      </div>

      {showCompose && <ComposeModal initialData={showCompose} recipients={recipients} onClose={() => setShowCompose(false)} />}
    </div>
  );
}

function ComposeModal({ initialData, recipients, onClose }) {
  const [form, setForm] = useState({
    to: initialData?.recipient?.email || '',
    name: initialData?.recipient?.name || '',
    subject: initialData?.template?.subject || '',
    body: initialData?.template?.body || '',
  });

  const send = useMutation({
    mutationFn: () => db.integrations.Core.SendEmail({
      to: form.to,
      subject: form.subject,
      body: form.body.replace(/{{name}}/g, form.name || 'there'),
    }),
    onSuccess: () => { toast.success('Email sent successfully'); onClose(); },
    onError: () => toast.error('Failed to send email'),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Compose Email</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Template</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              value={initialData?.template?.id || 'blank'}
              onChange={e => {
                const t = TEMPLATES.find(x => x.id === e.target.value);
                if (t) { set('subject', t.subject); set('body', t.body); }
              }}>
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">To *</label>
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              value={form.to} onChange={e => {
                const r = recipients.find(x => x.email === e.target.value);
                set('to', e.target.value);
                if (r) set('name', r.name);
              }}>
              <option value="">Select recipient…</option>
              {recipients.map(r => <option key={r.email} value={r.email}>{r.name} ({r.type})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Subject *</label>
            <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Email subject" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Body</label>
            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={8}
              value={form.body} onChange={e => set('body', e.target.value)} />
            <p className="text-xs text-slate-400 mt-1">Use {'{{name}}'} for recipient name</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.to || !form.subject || send.isPending} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            onClick={() => send.mutate()}>
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Email
          </Button>
        </div>
      </div>
    </div>
  );
}