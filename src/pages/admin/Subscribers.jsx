const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';

export default function Subscribers() {
  const qc = useQueryClient();
  const { data: subscribers = [] } = useQuery({ queryKey: ['subscribers'], queryFn: () => db.entities.Subscriber.list('-created_date') });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Subscriber.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscribers'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.Subscriber.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscribers'] }),
  });

  return (
    <AdminLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Subscribers</h1>
          <p className="text-muted-foreground mt-1">{subscribers.filter(s => s.status === 'active').length} active subscribers</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-secondary/50">
              <tr>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Subscribed</th>
                <th className="text-left px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map(sub => (
                <tr key={sub.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4 font-medium">{sub.email}</td>
                  <td className="px-6 py-4 text-muted-foreground">{sub.created_date ? format(new Date(sub.created_date), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2 justify-end">
                    {sub.status === 'active' && (
                      <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: sub.id, data: { status: 'unsubscribed' } })}>
                        Unsubscribe
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(sub.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No subscribers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
    </AdminLayout>
  );
}