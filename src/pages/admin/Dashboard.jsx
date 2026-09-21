import appServices from '@/lib/app-services';
import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import { Link } from 'react-router-dom';
import { MessageSquare, Users, TrendingUp, Clock, ClipboardCheck } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from "@/components/ui/button";
import { applicationsApi } from '@/lib/ikamva/api-client';

export default function AdminDashboard() {
  const { data: inquiries = [] } = useQuery({ queryKey: ['inquiries'], queryFn: () => appServices.records.Inquiry.list('-created_date') });
  const { data: subscribers = [] } = useQuery({ queryKey: ['subscribers'], queryFn: () => appServices.records.Subscriber.list() });
  const { data: applicationsData = { applications: [] } } = useQuery({
    queryKey: ['admin-pending-applications'],
    queryFn: () => applicationsApi.list({ status: 'pending' }),
  });
  const pendingApplications = applicationsData.applications ?? [];

  const newCount = inquiries.filter(i => i.status === 'new').length;
  const convertedCount = inquiries.filter(i => i.status === 'converted').length;

  const stats = [
    { label: 'Total Inquiries', value: inquiries.length, icon: MessageSquare, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border border-cyan-500/20' },
    { label: 'New / Unread', value: newCount, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border border-amber-500/20' },
    { label: 'Converted', value: convertedCount, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20' },
    { label: 'Subscribers', value: subscribers.filter(s => s.status === 'active').length, icon: Users, color: 'text-[#fcfc03]', bg: 'bg-[#fcfc03]/10 border border-[#fcfc03]/20' },
  ];
  const cardMotion = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <AdminLayout>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-card/60 p-6 shadow-2xl backdrop-blur-2xl md:flex-row md:items-end"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Operations cockpit</p>
            <h1 className="mt-3 text-4xl font-display font-semibold tracking-normal text-foreground">Dashboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">Overview of Ikamva Virtual Admin Assist</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/applications">
              <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover-scale rounded-xl">
                <ClipboardCheck className="h-4 w-4" />
                Approve applications{pendingApplications.length ? ` (${pendingApplications.length})` : ''}
              </Button>
            </Link>
            <Link to="/admin/inquiries"><Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-foreground hover:bg-white/10">Review Queue</Button></Link>
          </div>
        </motion.div>

        <motion.div
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          animate="visible"
          className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map(s => (
            <motion.div
              key={s.label}
              variants={cardMotion}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-white/10 bg-card/50 p-6 shadow-xl backdrop-blur-xl"
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="text-3xl font-bold text-foreground">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-card/50 p-6 shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg text-foreground">Recent Inquiries</h2>
            <Link to="/admin/inquiries"><Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-foreground hover:bg-white/10">View All</Button></Link>
          </div>
          <div className="space-y-3">
            {inquiries.slice(0, 5).map(inq => (
              <div key={inq.id} className="flex items-center justify-between border-b border-white/10 py-3 last:border-0">
                <div>
                  <p className="font-medium text-sm text-foreground">{inq.name}</p>
                  <p className="text-xs text-muted-foreground">{inq.email} · {inq.service?.replace(/_/g, ' ')}</p>
                </div>
                <StatusBadge status={inq.status} />
              </div>
            ))}
            {inquiries.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No inquiries yet.</p>}
          </div>
        </motion.div>
      </AdminLayout>
  );
}

export function StatusBadge({ status }) {
  const map = {
    new: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',
    in_review: 'bg-amber-500/15 text-amber-300 border border-amber-500/20',
    contacted: 'bg-teal-500/15 text-teal-300 border border-teal-500/20',
    converted: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
    closed: 'bg-white/10 text-slate-300 border border-white/10',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${map[status] || 'bg-white/10 text-slate-300'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}
