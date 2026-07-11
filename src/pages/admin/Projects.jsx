import appServices from '@/lib/app-services';
import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FolderKanban, Plus, X, Save, Pencil, Trash2, Clock } from 'lucide-react';
import { notifyProjectCreated, notifyProjectStatusChanged } from '@/lib/notifications';
import { toast } from 'sonner';

const STATUSES = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const STATUS_COLORS = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  on_hold:      'bg-yellow-100 text-yellow-700',
  completed:    'bg-green-100 text-green-700',
  cancelled:    'bg-red-100 text-red-600',
};
const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-600',
};

const emptyForm = {
  client_email: '', title: '', description: '', type: 'retainer',
  status: 'not_started', priority: 'medium', start_date: '', due_date: '',
  estimated_hours: '', hours_logged: '', hourly_rate: '', fixed_quote: '', va_name: '', notes: ''
};

function ProjectModal({ project, onClose, onSave, saving }) {
  const [form, setForm] = useState(project ? { ...project } : emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-semibold">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Client Email *</label>
              <Input value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="client@example.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Title *</label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Inbox setup & SOP" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
            <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="retainer">Retainer</option>
                <option value="project_based">Project Based</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
              <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
              <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Date</label>
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due Date</label>
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estimated Hours</label>
              <Input type="number" value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hours Logged</label>
              <Input type="number" value={form.hours_logged} onChange={e => set('hours_logged', e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hourly Rate (R)</label>
              <Input type="number" value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} placeholder="e.g. 350" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fixed Quote (R) — if applicable</label>
              <Input type="number" value={form.fixed_quote} onChange={e => set('fixed_quote', e.target.value)} placeholder="e.g. 5000" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Assigned VA</label>
              <Input value={form.va_name} onChange={e => set('va_name', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
            <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-border/50">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.client_email || !form.title}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save Project'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminProjects() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'new' | project object
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => appServices.records.Project.list('-created_date'),
  });

  const createMut = useMutation({
    mutationFn: d => appServices.records.Project.create(d),
    onSuccess: async (created) => {
      qc.invalidateQueries({ queryKey: ['admin-projects'] });
      setModal(null);
      toast.success('Project created');
      notifyProjectCreated(created).catch(() => {});
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data, oldStatus }) => appServices.records.Project.update(id, data).then(r => ({ result: r, oldStatus })),
    onSuccess: async ({ result, oldStatus }) => {
      qc.invalidateQueries({ queryKey: ['admin-projects'] });
      setModal(null);
      toast.success('Project updated');
      if (result.status !== oldStatus) {
        notifyProjectStatusChanged(result, oldStatus).catch(() => {});
      }
    },
  });
  const deleteMut = useMutation({
    mutationFn: id => appServices.records.Project.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-projects'] }),
  });

  const handleSave = (form) => {
    if (modal === 'new') createMut.mutate(form);
    else updateMut.mutate({ id: modal.id, data: form, oldStatus: modal.status });
  };

  const filtered = projects.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.client_email?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const inProgress = projects.filter(p => p.status === 'in_progress').length;
  const completed = projects.filter(p => p.status === 'completed').length;
  const totalHours = projects.reduce((s, p) => s + (p.hours_logged || 0), 0);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Project Tracking</h1>
          <p className="text-muted-foreground mt-1">Manage all client projects and track progress</p>
        </div>
        <Button onClick={() => setModal('new')} className="gap-2">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">Active Projects</p>
          <p className="text-3xl font-bold text-blue-600">{inProgress}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-600">{completed}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">Total Hours Logged</p>
          <p className="text-3xl font-bold">{totalHours.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <Input className="w-56" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2 flex-wrap">
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground'}`}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No projects found</p>
          <Button className="mt-4" onClick={() => setModal('new')}>Create First Project</Button>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left">
                <th className="px-5 py-3.5 font-medium text-muted-foreground">Project</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden md:table-cell">Client</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden sm:table-cell">Priority</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden lg:table-cell">
                  <Clock className="w-4 h-4 inline mr-1" />Hours
                </th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden lg:table-cell">Due</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium">{p.title}</p>
                    {p.va_name && <p className="text-xs text-muted-foreground">VA: {p.va_name}</p>}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-xs text-muted-foreground">{p.client_email}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[p.status]}`}>
                      {p.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${PRIORITY_COLORS[p.priority]}`}>
                      {p.priority}
                    </span>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-sm">
                    {p.hours_logged || 0} / {p.estimated_hours || '—'}
                    {p.estimated_hours > 0 && (
                      <div className="w-20 h-1.5 bg-secondary rounded-full mt-1">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ((p.hours_logged || 0) / p.estimated_hours) * 100)}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-xs text-muted-foreground">{p.due_date || '—'}</td>
                  <td className="px-5 py-4 text-right flex justify-end gap-1">
                    <button onClick={() => setModal(p)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteMut.mutate(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ProjectModal
          project={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </AdminLayout>
  );
}