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
    { label: 'Total Inquiries', value: inquiries.length, icon: MessageSquare, color: 'text-cyan-800', bg: 'bg-cyan-100/70' },
    { label: 'New / Unread', value: newCount, icon: Clock, color: 'text-amber-800', bg: 'bg-amber-100/75' },
    { label: 'Converted', value: convertedCount, icon: TrendingUp, color: 'text-emerald-800', bg: 'bg-emerald-100/75' },
    { label: 'Subscribers', value: subscribers.filter(s => s.status === 'active').length, icon: Users, color: 'text-lime-900', bg: 'bg-lime-200/70' },
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
          className="mb-8 flex flex-col justify-between gap-4 rounded-[1.75rem] border border-emerald-950/10 bg-white/58 p-6 shadow-[0_22px_70px_-52px_rgba(23,55,39,0.45)] backdrop-blur-2xl md:flex-row md:items-end"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-950/55">Operations cockpit</p>
            <h1 className="mt-3 text-4xl font-display font-semibold tracking-normal text-emerald-950">Dashboard</h1>
            <p className="mt-2 text-sm text-emerald-950/60">Overview of Ikamva Virtual Admin Assist</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/applications">
              <Button size="sm" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Approve applications{pendingApplications.length ? ` (${pendingApplications.length})` : ''}
              </Button>
            </Link>
            <Link to="/admin/inquiries"><Button variant="outline" size="sm">Review Queue</Button></Link>
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
              className="rounded-[1.7rem] border border-emerald-950/10 bg-white/62 p-6 shadow-[0_22px_70px_-52px_rgba(23,55,39,0.45)] backdrop-blur-2xl"
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="mt-1 text-sm text-emerald-950/58">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="rounded-[1.7rem] border border-emerald-950/10 bg-white/62 p-6 shadow-[0_22px_70px_-52px_rgba(23,55,39,0.45)] backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">Recent Inquiries</h2>
            <Link to="/admin/inquiries"><Button variant="outline" size="sm">View All</Button></Link>
          </div>
          <div className="space-y-3">
            {inquiries.slice(0, 5).map(inq => (
              <div key={inq.id} className="flex items-center justify-between border-b border-emerald-950/10 py-3 last:border-0">
                <div>
                  <p className="font-medium text-sm">{inq.name}</p>
                  <p className="text-xs text-emerald-950/55">{inq.email} · {inq.service?.replace(/_/g, ' ')}</p>
                </div>
                <StatusBadge status={inq.status} />
              </div>
            ))}
            {inquiries.length === 0 && <p className="py-4 text-center text-sm text-emerald-950/55">No inquiries yet.</p>}
          </div>
        </motion.div>
      </AdminLayout>
  );
}

export function StatusBadge({ status }) {
  const map = {
    new: 'bg-blue-100 text-blue-700',
    in_review: 'bg-yellow-100 text-yellow-700',
    contacted: 'bg-teal-100 text-teal-700',
    converted: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}
