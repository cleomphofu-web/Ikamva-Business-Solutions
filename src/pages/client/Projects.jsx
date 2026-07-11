import authService from '@/lib/auth-service';
import appServices from '@/lib/app-services';
import React, { useEffect, useState, useRef } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/client/DashboardLayout';
import { FolderKanban, CheckCircle2, Circle, Clock, CalendarDays, User, Bell } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  not_started: { label: 'Not Started',  color: 'bg-gray-100 text-gray-600',   bar: 'bg-gray-300' },
  in_progress:  { label: 'In Progress',  color: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-500' },
  on_hold:      { label: 'On Hold',      color: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' },
  completed:    { label: 'Completed',    color: 'bg-green-100 text-green-700',  bar: 'bg-green-500' },
  cancelled:    { label: 'Cancelled',    color: 'bg-red-100 text-red-500',      bar: 'bg-red-400' },
};

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-600',
};

function ProgressBar({ logged, estimated, barColor }) {
  if (!estimated) return null;
  const pct = Math.min(100, Math.round(((logged || 0) / estimated) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{logged || 0} hrs logged</span>
        <span>{pct}% of {estimated} hrs</span>
      </div>
      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MilestoneList({ milestones }) {
  if (!milestones?.length) return null;
  const done = milestones.filter(m => m.done).length;
  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Milestones</p>
        <span className="text-xs text-muted-foreground">{done}/{milestones.length} done</span>
      </div>
      <div className="space-y-2">
        {milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {m.done
              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <span className={`text-sm ${m.done ? 'line-through text-muted-foreground' : ''}`}>{m.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function ClientProjects() {
  const [user, setUser] = useState(null);
  const qc = useQueryClient();
  const prevProjectsRef = useRef({});
  useEffect(() => { authService.getCurrentUser().then(setUser); }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['client-projects', user?.email],
    queryFn: () => appServices.records.Project.filter({ client_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  // Real-time subscription — show toast on status change or new project
  useEffect(() => {
    if (!user?.email) return;
    const unsubscribe = appServices.records.Project.subscribe((event) => {
      const p = event.data;
      if (!p || p.client_email !== user.email) return;

      if (event.type === 'create') {
        qc.invalidateQueries({ queryKey: ['client-projects', user.email] });
        toast.info(`New project started: "${p.title}"`, { duration: 6000, icon: '🗂️' });
      } else if (event.type === 'update') {
        const prev = prevProjectsRef.current[p.id];
        qc.invalidateQueries({ queryKey: ['client-projects', user.email] });
        if (prev && prev.status !== p.status) {
          toast.success(`"${p.title}" status → ${STATUS_LABELS[p.status] || p.status}`, { duration: 7000, icon: '📋' });
        } else if (prev) {
          toast.info(`Project "${p.title}" has been updated.`, { duration: 5000 });
        }
      }
      prevProjectsRef.current[p.id] = p;
    });
    return unsubscribe;
  }, [user?.email, qc]);

  // Keep ref in sync with loaded projects
  useEffect(() => {
    projects.forEach(p => { prevProjectsRef.current[p.id] = p; });
  }, [projects]);

  const active = projects.filter(p => p.status === 'in_progress').length;
  const completed = projects.filter(p => p.status === 'completed').length;

  return (
    <DashboardLayout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <p className="text-muted-foreground mt-1">Track progress on longer-term initiatives your VA is handling.</p>
      </div>

      {/* Summary stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">Total Projects</p>
          <p className="text-3xl font-bold">{projects.length}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">In Progress</p>
          <p className="text-3xl font-bold text-blue-600">{active}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-600">{completed}</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold">No projects yet</p>
          <p className="text-muted-foreground text-sm mt-1">Your VA will add projects here as work begins.</p>
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <div className="grid md:grid-cols-2 gap-5">
          {projects.map(p => {
            const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.not_started;
            return (
              <div key={p.id} className="bg-card rounded-2xl border border-border/50 p-6 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{p.title}</h3>
                    {p.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${sc.color}`}>
                    {sc.label}
                  </span>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {p.priority && (
                    <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_COLORS[p.priority]}`}>
                      {p.priority} priority
                    </span>
                  )}
                  {p.va_name && (
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.va_name}</span>
                  )}
                  {p.due_date && (
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Due {p.due_date}</span>
                  )}
                  {p.type && (
                    <span className="flex items-center gap-1 capitalize">
                      <Clock className="w-3 h-3" />{p.type.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <ProgressBar logged={p.hours_logged} estimated={p.estimated_hours} barColor={sc.bar} />

                {/* Milestones */}
                <MilestoneList milestones={p.milestones} />
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}