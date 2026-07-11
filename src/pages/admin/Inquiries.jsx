import appServices from '@/lib/app-services';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { StatusBadge } from './Dashboard';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Search } from "lucide-react";
import { format } from 'date-fns';

export default function Inquiries() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: inquiries = [] } = useQuery({ queryKey: ['inquiries'], queryFn: () => appServices.records.Inquiry.list('-created_date') });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => appServices.records.Inquiry.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inquiries'] }),
  });

  const filtered = inquiries.filter(i => {
    const matchSearch = i.name?.toLowerCase().includes(search.toLowerCase()) || i.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <AdminLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Inquiries</h1>
          <p className="text-muted-foreground mt-1">Manage all contact form submissions</p>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-secondary/50">
              <tr>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground hidden md:table-cell">Service</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inq => (
                <tr key={inq.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium">{inq.name}</p>
                    <p className="text-xs text-muted-foreground">{inq.email}</p>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell capitalize text-muted-foreground">{inq.service?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-6 py-4 hidden lg:table-cell text-muted-foreground">{inq.created_date ? format(new Date(inq.created_date), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-6 py-4"><StatusBadge status={inq.status} /></td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(inq)}>View</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No inquiries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      {selected && (
        <InquiryDrawer
          inquiry={selected}
          onClose={() => setSelected(null)}
          onUpdate={(id, data) => { updateMutation.mutate({ id, data }); setSelected(prev => ({ ...prev, ...data })); }}
        />
      )}
    </AdminLayout>
  );
}

function InquiryDrawer({ inquiry, onClose, onUpdate }) {
  const [status, setStatus] = useState(inquiry.status);
  const [notes, setNotes] = useState(inquiry.notes || '');

  const handleSave = () => {
    onUpdate(inquiry.id, { status, notes });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-semibold text-lg">Inquiry Details</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5 flex-1">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Name</p><p className="font-medium mt-0.5">{inquiry.name}</p></div>
            <div><p className="text-muted-foreground">Email</p><p className="font-medium mt-0.5">{inquiry.email}</p></div>
            <div><p className="text-muted-foreground">Phone</p><p className="font-medium mt-0.5">{inquiry.phone || '—'}</p></div>
            <div><p className="text-muted-foreground">Company</p><p className="font-medium mt-0.5">{inquiry.company || '—'}</p></div>
            <div><p className="text-muted-foreground">Service</p><p className="font-medium mt-0.5 capitalize">{inquiry.service?.replace(/_/g, ' ') || '—'}</p></div>
            <div><p className="text-muted-foreground">Plan</p><p className="font-medium mt-0.5 capitalize">{inquiry.plan || '—'}</p></div>
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">Message</p>
            <p className="text-sm bg-secondary/50 rounded-xl p-4 border border-border/50">{inquiry.message}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">Status</p>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-muted-foreground text-sm mb-1">Internal Notes</p>
            <Textarea placeholder="Add notes..." className="h-28" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="p-6 border-t border-border/50">
          <Button className="w-full rounded-full" onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}