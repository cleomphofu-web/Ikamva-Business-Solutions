import authService from '@/lib/auth-service';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/client/DashboardLayout';
import { Clock, FileText, BarChart3, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { EmployeeChat } from '@/components/ikamva/employee-chat';
import { MissionControlErrorBoundary } from './MissionControl/MissionControlErrorBoundary';
import { accountOpsApi } from '@/lib/ikamva/api-client';

export default function ClientOverview() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  const { data: services = [] } = useQuery({
    queryKey: ['client-services', user?.email],
    queryFn: async () => (await accountOpsApi.summary()).services?.filter(service => service.client_email === user.email) || [],
    enabled: !!user?.email,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['client-reports', user?.email],
    queryFn: () => appServices.records.UsageReport.filter({ client_email: user.email }, '-created_date', 3),
    enabled: !!user?.email,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['client-documents', user?.email],
    queryFn: () => appServices.records.SharedDocument.filter({ client_email: user.email }, '-created_date', 5),
    enabled: !!user?.email,
  });

  const activeService = services.find(s => s.status === 'active');
  const usedPct = activeService ? Math.round((activeService.hours_used / activeService.hours_allocated) * 100) : 0;
  const cardMotion = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <DashboardLayout user={user}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 rounded-3xl border border-white/10 bg-card/60 p-6 shadow-2xl backdrop-blur-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Mission Control</p>
        <h1 className="mt-3 text-4xl font-display font-semibold tracking-normal text-foreground md:text-5xl">Workspace Overview</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Supervise and interact with your AI employee.</p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
        <motion.div
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* AI Employee Chat Interface */}
          <motion.section variants={cardMotion} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <MissionControlErrorBoundary><EmployeeChat suggestions={["What are my latest tasks?", "Summarize my active projects"]} /></MissionControlErrorBoundary>
          </motion.section>
          
          {/* Active plan card */}
          {activeService ? (
            <motion.div
              variants={cardMotion}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col justify-between gap-5 rounded-3xl border border-white/10 bg-gradient-to-r from-card to-card/80 p-6 text-foreground shadow-2xl backdrop-blur-2xl sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#fcfc03]">Active Plan</p>
                <p className="text-2xl font-bold capitalize mt-1">{activeService.plan}</p>
                {activeService.va_name && <p className="mt-1 text-sm text-muted-foreground">VA: {activeService.va_name}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Hours this month</p>
                <p className="text-3xl font-bold">{activeService.hours_used} <span className="text-lg font-normal text-muted-foreground">/ {activeService.hours_allocated}h</span></p>
                {activeService.renewal_date && (
                  <p className="mt-1 text-xs text-muted-foreground">Renews {format(new Date(activeService.renewal_date), 'dd MMM yyyy')}</p>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div variants={cardMotion} className="flex items-center gap-4 rounded-3xl border border-white/10 bg-card/50 p-6 shadow-2xl backdrop-blur-2xl">
              <AlertCircle className="h-8 w-8 flex-shrink-0 text-[#fcfc03]" />
              <div>
                <p className="font-semibold text-foreground">No active service</p>
                <p className="text-sm text-muted-foreground">Contact us to get started with a plan.</p>
              </div>
              <Link to="/contact" className="ml-auto">
                <span className="text-sm font-semibold text-primary hover:underline">Get started -&gt;</span>
              </Link>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Stats row */}
          <div className="grid gap-4">
            <motion.div variants={cardMotion} className="rounded-2xl border border-white/10 bg-card/50 p-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fcfc03]/10 text-[#fcfc03]">
                  <Clock className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Hours Used</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{activeService?.hours_used ?? '—'}</p>
              {activeService && (
                <div className="mt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#fcfc03] transition-all" style={{ width: `${Math.min(usedPct, 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{usedPct}% of {activeService.hours_allocated}h used</p>
                </div>
              )}
            </motion.div>

            <motion.div variants={cardMotion} className="rounded-2xl border border-white/10 bg-card/50 p-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Reports</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{reports.length}</p>
              <Link to="/dashboard/reports" className="mt-1 block text-xs font-semibold text-primary hover:underline">View all reports -&gt;</Link>
            </motion.div>

            <motion.div variants={cardMotion} className="rounded-2xl border border-white/10 bg-card/50 p-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Shared Documents</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{documents.length}</p>
              <Link to="/dashboard/documents" className="mt-1 block text-xs font-semibold text-primary hover:underline">View all files -&gt;</Link>
            </motion.div>
          </div>
          
          {/* Recent documents */}
          {documents.length > 0 && (
            <motion.div variants={cardMotion} className="rounded-2xl border border-white/10 bg-card/50 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">Recent Documents</h2>
                <Link to="/dashboard/documents" className="text-sm font-semibold text-primary hover:underline">View all</Link>
              </div>
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 border-b border-white/10 py-2 last:border-0">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/5">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{doc.category} · {doc.shared_by || 'Your VA'}</p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs font-semibold text-primary hover:underline">
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
