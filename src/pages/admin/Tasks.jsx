import appServices from '@/lib/app-services';
import React, { useState, useEffect } from 'react';

import { notifyTaskAssigned } from '@/lib/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Plus, Pencil, Trash2, X, Save, Upload, Download, Paperclip, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUSES = ['pending', 'in_progress', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];
const CATEGORIES = ['schedule_management', 'email_management', 'document_preparation', 'communication_hub', 'other'];

const statusColors = {
  pending:     'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
};

const priorityColors = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-gray-100 text-gray-500',
};

const empty = { client_email: '', title: '', description: '', status: 'pending', priority: 'medium', category: 'other', due_date: '', va_name: '', notes: '' };

function TaskFormModal({ task, onClose, onSave, saving }) {
  const [form, setForm] = useState(task || empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-semibold text-lg">{task?.id ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Client Email *</label>
            <Input value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="client@example.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title *</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Task title" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
            <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Task details..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
              <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</label>
              <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due Date</label>
              <Input type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Assigned VA</label>
            <Input value={form.va_name || ''} onChange={e => set('va_name', e.target.value)} placeholder="VA full name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Internal Notes</label>
            <textarea className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Internal notes..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-border/50">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.client_email || !form.title}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save Task'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileDrawer({ task, onClose, onUpdated }) {
  const [uploadingClient, setUploadingClient] = useState(false);
  const [uploadingCompleted, setUploadingCompleted] = useState(false);

  const handleUploadCompleted = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCompleted(true);
    const { file_url } = await appServices.files.upload({ file });
    const newFile = { file_url, file_name: file.name, uploaded_at: new Date().toISOString() };
    const updated = [...(task.completed_files || []), newFile];
    await appServices.records.Task.update(task.id, { completed_files: updated });
    onUpdated({ ...task, completed_files: updated });
    toast.success('Completed file uploaded');
    setUploadingCompleted(false);
    e.target.value = '';
  };

  const removeCompletedFile = async (idx) => {
    const updated = task.completed_files.filter((_, i) => i !== idx);
    await appServices.records.Task.update(task.id, { completed_files: updated });
    onUpdated({ ...task, completed_files: updated });
    toast.success('File removed');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div>
            <h2 className="font-semibold">{task.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{task.client_email}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6 flex-1">
          {/* Client uploaded files */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Files from Client
            </h3>
            {(!task.client_files || task.client_files.length === 0) ? (
              <p className="text-xs text-muted-foreground">No files uploaded by client yet.</p>
            ) : (
              <div className="space-y-2">
                {task.client_files.map((f, i) => (
                  <a key={i} href={f.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border border-border/50 hover:bg-secondary/50 transition-colors group">
                    <Download className="w-4 h-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file_name}</p>
                      {f.uploaded_at && <p className="text-xs text-muted-foreground">{format(new Date(f.uploaded_at), 'dd MMM yyyy HH:mm')}</p>}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Upload completed work */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload Completed Work
            </h3>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors">
              {uploadingCompleted ? (
                <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Uploading…</span></>
              ) : (
                <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">Click to upload completed work</span></>
              )}
              <input type="file" className="hidden" onChange={handleUploadCompleted} disabled={uploadingCompleted} />
            </label>
            {task.completed_files?.length > 0 && (
              <div className="mt-3 space-y-2">
                {task.completed_files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50">
                    <Download className="w-4 h-4 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-green-800">{f.file_name}</p>
                      {f.uploaded_at && <p className="text-xs text-green-600">{format(new Date(f.uploaded_at), 'dd MMM yyyy HH:mm')}</p>}
                    </div>
                    <button onClick={() => removeCompletedFile(i)} className="text-green-600 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineStatusSelect({ task, onChange }) {
  return (
    <select value={task.status} onChange={e => onChange(task.id, e.target.value)}
      className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer capitalize appearance-none focus:outline-none focus:ring-2 focus:ring-ring ${statusColors[task.status]}`}>
      {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
    </select>
  );
}

export default function AdminTasks() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [fileDrawer, setFileDrawer] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: () => appServices.records.Task.list('-created_date'),
  });

  useEffect(() => {
    const unsub = appServices.records.Task.subscribe(() => {
      qc.invalidateQueries({ queryKey: ['admin-tasks'] });
    });
    return unsub;
  }, [qc]);

  const createMut = useMutation({
    mutationFn: data => appServices.records.Task.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin-tasks'] });
      setModal(null);
      if (created?.client_email) notifyTaskAssigned(created);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => appServices.records.Task.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tasks'] }),
  });

  const deleteMut = useMutation({
    mutationFn: id => appServices.records.Task.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tasks'] }),
  });

  const handleSave = (form) => {
    if (modal?.id) { updateMut.mutate({ id: modal.id, data: form }); setModal(null); }
    else createMut.mutate(form);
  };

  const handleStatusChange = (id, status) => updateMut.mutate({ id, data: { status } });

  const handleFileDrawerUpdated = (updatedTask) => {
    setFileDrawer(updatedTask);
    qc.invalidateQueries({ queryKey: ['admin-tasks'] });
  };

  const filtered = tasks.filter(t => {
    const matchStatus = filter === 'all' || t.status === filter;
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.client_email?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Task Board</h1>
          <p className="text-muted-foreground mt-1">Manage tasks, upload completed work, and download client files</p>
        </div>
        <Button onClick={() => setModal('new')} className="gap-2">
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <Input className="w-56" placeholder="Search tasks or client…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2">
          {['all', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground'}`}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <p className="font-semibold">No tasks found</p>
          <p className="text-muted-foreground text-sm mt-1">Create a new task or adjust your filters.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left">
                <th className="px-5 py-3.5 font-medium text-muted-foreground">Task</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden md:table-cell">Client</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden sm:table-cell">Priority</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden lg:table-cell">Files</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground hidden lg:table-cell">Due</th>
                <th className="px-5 py-3.5 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium">{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-muted-foreground text-xs">{task.client_email}</td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${priorityColors[task.priority] || priorityColors.medium}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <InlineStatusSelect task={task} onChange={handleStatusChange} />
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <button onClick={() => setFileDrawer(task)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{(task.client_files?.length || 0)} in</span>
                      <span className="text-green-600">/ {(task.completed_files?.length || 0)} out</span>
                    </button>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-xs text-muted-foreground">
                    {task.due_date ? format(new Date(task.due_date), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setFileDrawer(task)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors" title="Manage files">
                        <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setModal(task)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => deleteMut.mutate(task.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <TaskFormModal task={modal === 'new' ? null : modal} onClose={() => setModal(null)}
          onSave={handleSave} saving={createMut.isPending || updateMut.isPending} />
      )}
      {fileDrawer && (
        <FileDrawer task={fileDrawer} onClose={() => setFileDrawer(null)} onUpdated={handleFileDrawerUpdated} />
      )}
    </AdminLayout>
  );
}