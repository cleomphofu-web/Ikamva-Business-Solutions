import authService from '@/lib/auth-service';
import appServices from '@/lib/app-services';
import React, { useEffect, useState } from 'react';

import DashboardLayout from '@/components/client/DashboardLayout';
import { CheckCircle2, Clock, Loader2, Circle, AlertCircle, Calendar, Upload, Download, Paperclip, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const COLUMNS = [
  { key: 'pending',     label: 'Pending',     icon: Circle,       color: 'text-slate-500',  bg: 'bg-slate-100',    dot: 'bg-slate-400' },
  { key: 'in_progress', label: 'In Progress', icon: Loader2,      color: 'text-blue-600',   bg: 'bg-blue-50',      dot: 'bg-blue-500' },
  { key: 'completed',   label: 'Completed',   icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50',     dot: 'bg-green-500' },
];

const priorityBadge = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-gray-100 text-gray-500',
};

const categoryLabel = {
  schedule_management:  'Schedule',
  email_management:     'Email',
  document_preparation: 'Documents',
  communication_hub:    'Comms',
  other:                'Other',
};

function FileUploadButton({ taskId, existingFiles = [], onUploaded }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await appServices.files.upload({ file });
    const newFile = { file_url, file_name: file.name, uploaded_at: new Date().toISOString() };
    const updated = [...existingFiles, newFile];
    await appServices.records.Task.update(taskId, { client_files: updated });
    onUploaded(taskId, updated);
    toast.success('File uploaded successfully');
    setUploading(false);
    e.target.value = '';
  };

  return (
    <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
      {uploading ? 'Uploading…' : 'Upload work'}
      <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
    </label>
  );
}

function TaskCard({ task, onUploaded }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-medium text-sm leading-snug">{task.title}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${priorityBadge[task.priority] || priorityBadge.medium}`}>
          {task.priority}
        </span>
      </div>
      {task.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
      
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          {task.category && (
            <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
              {categoryLabel[task.category] || task.category}
            </span>
          )}
          {task.va_name && <span className="text-xs text-muted-foreground">· {task.va_name}</span>}
        </div>
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {format(new Date(task.due_date), 'dd MMM')}
          </div>
        )}
      </div>

      {/* File sections */}
      <div className="border-t border-border/50 pt-3 space-y-2">
        {/* Upload work to VA */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Your files</span>
          <FileUploadButton taskId={task.id} existingFiles={task.client_files || []} onUploaded={onUploaded} />
        </div>
        {task.client_files?.length > 0 && (
          <div className="space-y-1">
            {task.client_files.map((f, i) => (
              <a key={i} href={f.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-[180px]">{f.file_name}</span>
              </a>
            ))}
          </div>
        )}

        {/* Download completed work from VA */}
        {task.completed_files?.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-muted-foreground mb-1">Completed work from VA</p>
            {task.completed_files.map((f, i) => (
              <a key={i} href={f.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:underline">
                <Download className="w-3 h-3" />
                <span className="truncate max-w-[180px]">{f.file_name}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientTasks() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { authService.getCurrentUser().then(setUser); }, []);

  useEffect(() => {
    if (!user?.email) return;
    appServices.records.Task.filter({ client_email: user.email }, '-created_date')
      .then(setTasks).finally(() => setLoading(false));

    const unsub = appServices.records.Task.subscribe(event => {
      if (event.type === 'create' && event.data.client_email === user.email) {
        setTasks(prev => [event.data, ...prev]);
      } else if (event.type === 'update') {
        setTasks(prev => prev.map(t => t.id === event.id ? event.data : t));
      } else if (event.type === 'delete') {
        setTasks(prev => prev.filter(t => t.id !== event.id));
      }
    });
    return unsub;
  }, [user?.email]);

  const handleUploaded = (taskId, updatedFiles) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, client_files: updatedFiles } : t));
  };

  return (
    <DashboardLayout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <p className="text-muted-foreground mt-1">Live status of work your VA is handling. Upload source files and download completed work.</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg">No tasks yet</p>
          <p className="text-muted-foreground text-sm mt-1">Your VA will add tasks here as they begin work.</p>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="grid md:grid-cols-3 gap-6">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.key);
            const Icon = col.icon;
            return (
              <div key={col.key} className="flex flex-col gap-3">
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${col.bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${col.color} ${col.key === 'in_progress' ? 'animate-spin' : ''}`} />
                    <span className={`font-semibold text-sm ${col.color}`}>{col.label}</span>
                  </div>
                  <span className={`w-6 h-6 rounded-full ${col.dot} text-white text-xs font-bold flex items-center justify-center`}>
                    {colTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-3 min-h-24">
                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center">
                      <p className="text-xs text-muted-foreground">No tasks here</p>
                    </div>
                  )}
                  {colTasks.map(task => <TaskCard key={task.id} task={task} onUploaded={handleUploaded} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}