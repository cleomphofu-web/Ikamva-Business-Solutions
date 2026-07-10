const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/client/DashboardLayout';
import { Clock, FileText, BarChart3, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function ClientOverview() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    db.auth.me().then(setUser);
  }, []);

  const { data: services = [] } = useQuery({
    queryKey: ['client-services', user?.email],
    queryFn: () => db.entities.ClientService.filter({ client_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['client-reports', user?.email],
    queryFn: () => db.entities.UsageReport.filter({ client_email: user.email }, '-created_date', 3),
    enabled: !!user?.email,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['client-documents', user?.email],
    queryFn: () => db.entities.SharedDocument.filter({ client_email: user.email }, '-created_date', 5),
    enabled: !!user?.email,
  });

  const activeService = services.find(s => s.status === 'active');
  const usedPct = activeService ? Math.round((activeService.hours_used / activeService.hours_allocated) * 100) : 0;

  return (
    <DashboardLayout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!</h1>
        <p className="text-muted-foreground mt-1">Here's a summary of your Fullscope account.</p>
      </div>

      {/* Active plan card */}
      {activeService ? (
        <div className="bg-primary text-primary-foreground rounded-2xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-primary-foreground/70 text-sm uppercase tracking-wider font-medium">Active Plan</p>
            <p className="text-2xl font-bold capitalize mt-1">{activeService.plan}</p>
            {activeService.va_name && <p className="text-primary-foreground/70 text-sm mt-1">VA: {activeService.va_name}</p>}
          </div>
          <div className="text-right">
            <p className="text-primary-foreground/70 text-sm">Hours this month</p>
            <p className="text-3xl font-bold">{activeService.hours_used} <span className="text-lg font-normal text-primary-foreground/70">/ {activeService.hours_allocated}h</span></p>
            {activeService.renewal_date && (
              <p className="text-primary-foreground/70 text-xs mt-1">Renews {format(new Date(activeService.renewal_date), 'dd MMM yyyy')}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/50 p-6 mb-6 flex items-center gap-4">
          <AlertCircle className="w-8 h-8 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="font-semibold">No active service</p>
            <p className="text-muted-foreground text-sm">Contact us to get started with a plan.</p>
          </div>
          <Link to="/contact" className="ml-auto">
            <span className="text-sm font-medium text-primary hover:underline">Get started →</span>
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Hours Used</p>
          </div>
          <p className="text-2xl font-bold">{activeService?.hours_used ?? '—'}</p>
          {activeService && (
            <div className="mt-2">
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(usedPct, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{usedPct}% of {activeService.hours_allocated}h used</p>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-violet-600" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Monthly Reports</p>
          </div>
          <p className="text-2xl font-bold">{reports.length}</p>
          <Link to="/dashboard/reports" className="text-xs text-primary hover:underline mt-1 block">View all reports →</Link>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Shared Documents</p>
          </div>
          <p className="text-2xl font-bold">{documents.length}</p>
          <Link to="/dashboard/documents" className="text-xs text-primary hover:underline mt-1 block">View all files →</Link>
        </div>
      </div>

      {/* Recent documents */}
      {documents.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Documents</h2>
            <Link to="/dashboard/documents" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{doc.category} · {doc.shared_by || 'Your VA'}</p>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary font-medium hover:underline flex-shrink-0">
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}