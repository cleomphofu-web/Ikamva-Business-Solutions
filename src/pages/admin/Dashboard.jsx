import appServices from '@/lib/app-services';
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Link } from 'react-router-dom';
import { MessageSquare, Users, TrendingUp, Clock } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { data: inquiries = [] } = useQuery({ queryKey: ['inquiries'], queryFn: () => appServices.records.Inquiry.list('-created_date') });
  const { data: subscribers = [] } = useQuery({ queryKey: ['subscribers'], queryFn: () => appServices.records.Subscriber.list() });

  const newCount = inquiries.filter(i => i.status === 'new').length;
  const convertedCount = inquiries.filter(i => i.status === 'converted').length;

  const stats = [
    { label: 'Total Inquiries', value: inquiries.length, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'New / Unread', value: newCount, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Converted', value: convertedCount, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Subscribers', value: subscribers.filter(s => s.status === 'active').length, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <AdminLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of Ikamva Virtual Admin Assist</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {stats.map(s => (
            <div key={s.label} className="bg-card rounded-2xl border border-border/50 p-6">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-muted-foreground text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg">Recent Inquiries</h2>
            <Link to="/admin/inquiries"><Button variant="outline" size="sm">View All</Button></Link>
          </div>
          <div className="space-y-3">
            {inquiries.slice(0, 5).map(inq => (
              <div key={inq.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                <div>
                  <p className="font-medium text-sm">{inq.name}</p>
                  <p className="text-xs text-muted-foreground">{inq.email} · {inq.service?.replace(/_/g, ' ')}</p>
                </div>
                <StatusBadge status={inq.status} />
              </div>
            ))}
            {inquiries.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No inquiries yet.</p>}
          </div>
        </div>
      </AdminLayout>
  );
}

export function StatusBadge({ status }) {
  const map = {
    new: 'bg-blue-100 text-blue-700',
    in_review: 'bg-yellow-100 text-yellow-700',
    contacted: 'bg-purple-100 text-purple-700',
    converted: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}