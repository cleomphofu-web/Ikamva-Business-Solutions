const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Search, Plus, Phone, Mail, Calendar, Clock, X, Save, Loader2, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

const NOTE_TYPES = [
  { key: 'call', label: 'Call', color: 'bg-blue-100 text-blue-700', icon: Phone },
  { key: 'email', label: 'Email', color: 'bg-purple-100 text-purple-700', icon: Mail },
  { key: 'meeting', label: 'Meeting', color: 'bg-green-100 text-green-700', icon: Calendar },
  { key: 'note', label: 'Note', color: 'bg-slate-100 text-slate-700', icon: X },
  { key: 'follow_up', label: 'Follow-up', color: 'bg-orange-100 text-orange-700', icon: Clock },
];

const PLAN_BADGE = {
  starter: 'bg-slate-100 text-slate-700',
  professional: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-violet-100 text-violet-700',
};

function ContactDrawer({ client, onClose }) {
  const qc = useQueryClient();
  const [noteForm, setNoteForm] = useState({ type: 'note', content: '', next_action: '', next_action_date: '' });
  const [addingNote, setAddingNote] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ['crm-notes', client.email],
    queryFn: () => db.entities.CRMNote.filter({ client_email: client.email }, '-created_date'),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['crm-tasks', client.email],
    queryFn: () => db.entities.Task.filter({ client_email: client.email }, '-created_date', 20),
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['crm-invoices', client.email],
    queryFn: () => db.entities.Invoice.filter({ client_email: client.email }, '-created_date', 10),
  });
  const { data: services = [] } = useQuery({
    queryKey: ['crm-services', client.email],
    queryFn: () => db.entities.ClientService.filter({ client_email: client.email }),
  });

  const createNote = useMutation({
    mutationFn: data => db.entities.CRMNote.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-notes', client.email] });
      qc.invalidateQueries({ queryKey: ['crm-all-notes'] });
      setNoteForm({ type: 'note', content: '', next_action: '', next_action_date: '' });
      setAddingNote(false);
      toast.success('Interaction logged');
    },
  });
  const deleteNote = useMutation({
    mutationFn: id => db.entities.CRMNote.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-notes', client.email] }),
  });

  const activeService = services.find(s => s.status === 'active');
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((a, i) => a + (i.total || 0), 0);
  const openTasks = tasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 flex-shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-primary">{(client.full_name || client.email)[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900">{client.full_name || '—'}</h2>
            <p className="text-sm text-slate-500">{client.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs content */}
        <div className="flex-1 overflow-y-auto">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 p-5">
            {[
              { label: 'Open Tasks', val: openTasks, color: 'text-blue-600' },
              { label: 'Invoices', val: invoices.length, color: 'text-slate-700' },
              { label: 'Outstanding', val: `R${outstanding.toLocaleString()}`, color: 'text-orange-600' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Active Service */}
          {activeService && (
            <div className="px-5 pb-4">
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold capitalize">{activeService.plan} Plan</p>
                  <p className="text-xs text-slate-500">{activeService.va_name || 'Assigned VA'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{activeService.hours_used || 0}h / {activeService.hours_allocated}h</p>
                  <div className="w-20 h-1.5 bg-slate-200 rounded-full mt-1">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(((activeService.hours_used || 0) / activeService.hours_allocated) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interaction History */}
          <div className="px-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Interaction History</h3>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddingNote(v => !v)}>
                <Plus className="w-3 h-3" /> Log
              </Button>
            </div>

            {addingNote && (
              <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3 border border-slate-200">
                <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={noteForm.type} onChange={e => setNoteForm(f => ({ ...f, type: e.target.value }))}>
                  {NOTE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <textarea className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm resize-none"
                  rows={3} placeholder="What happened?" value={noteForm.content}
                  onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))} />
                <Input placeholder="Next action (optional)" className="text-sm" value={noteForm.next_action}
                  onChange={e => setNoteForm(f => ({ ...f, next_action: e.target.value }))} />
                <Input type="date" value={noteForm.next_action_date}
                  onChange={e => setNoteForm(f => ({ ...f, next_action_date: e.target.value }))} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setAddingNote(false)}>Cancel</Button>
                  <Button size="sm" disabled={!noteForm.content || createNote.isPending}
                    onClick={() => createNote.mutate({ ...noteForm, client_email: client.email })}>
                    {createNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-5">
              {notes.map(note => {
                const t = NOTE_TYPES.find(n => n.key === note.type) || NOTE_TYPES[3];
                const Icon = t.icon;
                return (
                  <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>
                        <Icon className="w-3 h-3" />{t.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {note.created_date ? format(new Date(note.created_date), 'dd MMM yyyy') : ''}
                        </span>
                        <button onClick={() => deleteNote.mutate(note.id)} className="text-slate-300 hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700">{note.content}</p>
                    {note.next_action && (
                      <div className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Next: {note.next_action}
                        {note.next_action_date && ` · ${format(new Date(note.next_action_date), 'dd MMM')}`}
                      </div>
                    )}
                    {note.author && <p className="text-xs text-slate-400 mt-1">— {note.author}</p>}
                  </div>
                );
              })}
              {notes.length === 0 && !addingNote && (
                <p className="text-sm text-slate-400 py-2">No interactions logged yet.</p>
              )}
            </div>

            {/* Tasks */}
            {tasks.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Tasks</h3>
                <div className="space-y-1.5">
                  {tasks.slice(0, 5).map(task => (
                    <div key={task.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                      <span className="text-sm text-slate-700 truncate flex-1">{task.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ml-2 capitalize font-medium ${
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{task.status.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CRMContacts() {
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: users = [], isLoading } = useQuery({ queryKey: ['crm-users'], queryFn: () => db.entities.User.list() });
  const { data: services = [] } = useQuery({ queryKey: ['crm-all-services'], queryFn: () => db.entities.ClientService.list() });
  const { data: tasks = [] } = useQuery({ queryKey: ['crm-all-tasks'], queryFn: () => db.entities.Task.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['crm-all-invoices'], queryFn: () => db.entities.Invoice.list() });
  const { data: notes = [] } = useQuery({ queryKey: ['crm-all-notes'], queryFn: () => db.entities.CRMNote.list('-created_date', 200) });

  const clients = users.filter(u => u.role !== 'admin');
  const enriched = clients.map(client => {
    const activeService = services.find(s => s.client_email === client.email && s.status === 'active');
    const openTasks = tasks.filter(t => t.client_email === client.email && t.status !== 'completed').length;
    const outstanding = invoices.filter(i => i.client_email === client.email && (i.status === 'sent' || i.status === 'overdue')).reduce((a, i) => a + (i.total || 0), 0);
    const lastNote = notes.find(n => n.client_email === client.email);
    return { ...client, activeService, openTasks, outstanding, lastNote };
  });

  const filtered = enriched.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    const matchPlan = filterPlan === 'all' || c.activeService?.plan === filterPlan;
    return matchSearch && matchPlan;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">{clients.length} total clients</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {['all', 'starter', 'professional', 'enterprise'].map(p => (
            <button key={p} onClick={() => setFilterPlan(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filterPlan === p ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {p === 'all' ? 'All Plans' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm">No contacts found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Plan</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Open Tasks</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Outstanding</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Last Interaction</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => (
                <tr key={client.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setSelected(client)}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{(client.full_name || client.email)[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{client.full_name || '—'}</p>
                        <p className="text-xs text-slate-400">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {client.activeService ? (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${PLAN_BADGE[client.activeService.plan] || 'bg-slate-100 text-slate-700'}`}>
                        {client.activeService.plan}
                      </span>
                    ) : <span className="text-xs text-slate-400">No plan</span>}
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className={`text-sm font-semibold ${client.openTasks > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{client.openTasks}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className={`text-sm font-semibold ${client.outstanding > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                      {client.outstanding > 0 ? `R${client.outstanding.toLocaleString()}` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden xl:table-cell">
                    {client.lastNote ? (
                      <div className="text-xs text-slate-500">
                        <span className="capitalize">{client.lastNote.type}</span> · {format(new Date(client.lastNote.created_date), 'dd MMM yyyy')}
                      </div>
                    ) : <span className="text-xs text-slate-400">No interactions</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <ContactDrawer client={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}