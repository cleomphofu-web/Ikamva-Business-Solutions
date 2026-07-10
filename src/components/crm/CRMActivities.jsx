const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Plus, X, Save, Loader2, CheckCircle2, Clock, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
};

const PRIORITY_CONFIG = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

function TaskFormModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '', client_email: '', status: 'pending', priority: 'medium', category: 'other', due_date: '' });

  const { data: users = [] } = useQuery({ queryKey: ['crm-users'], queryFn: () => db.entities.User.list() });
  const clients = users.filter(u => u.role !== 'admin');

  const create = useMutation({
    mutationFn: data => db.entities.Task.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-all-tasks'] }); toast.success('Task created'); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-900">New Task</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <Input placeholder="Task title*" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none" rows={3}
            placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}>
            <option value="">Select client*</option>
            {clients.map(c => <option key={c.id} value={c.email}>{c.full_name || c.email}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="schedule_management">Schedule</option>
              <option value="email_management">Email</option>
              <option value="document_preparation">Documents</option>
              <option value="communication_hub">Comms</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.title || !form.client_email || create.isPending}
            onClick={() => create.mutate(form)}>
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Create Task
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CRMActivities() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({ queryKey: ['crm-all-tasks'], queryFn: () => db.entities.Task.list() });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => db.entities.Task.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-all-tasks'] }),
  });

  const filtered = tasks.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.title?.toLowerCase().includes(q) || t.client_email?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const byStatus = {
    pending: filtered.filter(t => t.status === 'pending'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    completed: filtered.filter(t => t.status === 'completed'),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Activities & Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">{tasks.length} total tasks</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {['all', 'pending', 'in_progress', 'completed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban */}
      {filterStatus === 'all' ? (
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(byStatus).map(([status, items]) => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            return (
              <div key={status} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                    <Icon className="w-3 h-3" />{cfg.label}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">{items.length}</span>
                </div>
                <div className="p-3 space-y-2 min-h-32">
                  {items.map(task => (
                    <div key={task.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-sm font-medium text-slate-800 mb-1">{task.title}</p>
                      <p className="text-xs text-slate-500 mb-2">{task.client_email}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium}`}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className="text-xs text-slate-400">{format(new Date(task.due_date), 'dd MMM')}</span>
                        )}
                      </div>
                      <div className="flex gap-1 mt-2">
                        {status !== 'pending' && (
                          <button className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100"
                            onClick={() => updateTask.mutate({ id: task.id, data: { status: status === 'in_progress' ? 'pending' : 'in_progress' } })}>
                            ← Back
                          </button>
                        )}
                        {status !== 'completed' && (
                          <button className="text-xs text-primary hover:text-primary/80 px-2 py-0.5 rounded hover:bg-primary/5 ml-auto"
                            onClick={() => updateTask.mutate({ id: task.id, data: { status: status === 'pending' ? 'in_progress' : 'completed' } })}>
                            {status === 'pending' ? 'Start →' : 'Complete →'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No tasks here</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Task</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Priority</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Due</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={task.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{task.title}</p>
                      {task.description && <p className="text-xs text-slate-400 truncate max-w-48">{task.description}</p>}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-xs text-slate-500">{task.client_email}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell text-xs text-slate-500">
                      {task.due_date ? format(new Date(task.due_date), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <TaskFormModal onClose={() => setShowForm(false)} />}
    </div>
  );
}