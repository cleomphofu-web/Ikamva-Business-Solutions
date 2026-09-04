import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { applicationsApi } from '@/lib/ikamva/api-client';

function Applications() {
  const [busyId, setBusyId] = useState('');
  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ['client-applications'],
    queryFn: async () => {
      const result = await applicationsApi.list({ status: 'pending' });
      return result.applications ?? [];
    },
  });

  const review = async (id, status) => {
    setBusyId(id);
    try {
      await applicationsApi.review(id, { status });
      toast.success(`Application ${status}.`);
      await refetch();
    } catch (error) {
      toast.error(error?.message || 'Unable to update application.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        <div className="rounded-[1.75rem] border border-emerald-950/10 bg-white/62 p-6 shadow-[0_22px_70px_-52px_rgba(23,55,39,0.45)] backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-950/55">Platform Review</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">Client Applications</h1>
          <p className="mt-2 text-sm text-emerald-950/60">Review pending signups and approve or reject them.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-emerald-950/10 bg-white/62 p-5">
            <p className="text-sm text-emerald-950/55">Pending</p>
            <p className="mt-2 text-3xl font-semibold">{data.length}</p>
          </div>
          <div className="rounded-[1.5rem] border border-emerald-950/10 bg-white/62 p-5">
            <p className="text-sm text-emerald-950/55">Total</p>
            <p className="mt-2 text-3xl font-semibold">{data.length}</p>
          </div>
          <div className="rounded-[1.5rem] border border-emerald-950/10 bg-white/62 p-5">
            <p className="text-sm text-emerald-950/55">Status</p>
            <p className="mt-2 text-3xl font-semibold">Live</p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-emerald-950/10 bg-white/62 p-6 shadow-[0_22px_70px_-52px_rgba(23,55,39,0.45)] backdrop-blur-2xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-emerald-950">Submitted applications</h2>
            <Badge variant="secondary" className="rounded-full">
              {isLoading ? 'Loading…' : `${data.length} records`}
            </Badge>
          </div>

          <div className="space-y-4">
            {data.map(application => (
              <article key={application.id} className="rounded-[1.5rem] border border-emerald-950/10 bg-white/78 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-950">{application.full_name}</p>
                    <p className="mt-1 text-sm text-emerald-950/62">{application.email}</p>
                    <p className="mt-1 text-sm text-emerald-950/62">{application.company_name || 'No company name provided'}</p>
                    <p className="mt-1 text-xs text-emerald-950/45">{application.phone || 'No phone provided'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={application.status === 'approved' ? 'default' : application.status === 'rejected' ? 'destructive' : 'secondary'}
                      className="rounded-full capitalize"
                    >
                      {application.status}
                    </Badge>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    onClick={() => review(application.id, 'approved')}
                    className="rounded-full"
                    disabled={busyId === application.id || application.status !== 'pending'}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => review(application.id, 'rejected')}
                    className="rounded-full"
                    disabled={busyId === application.id || application.status !== 'pending'}
                  >
                    Reject
                  </Button>
                </div>
              </article>
            ))}
            {data.length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-emerald-950/10 px-6 py-10 text-center text-sm text-emerald-950/55">
                No applications have been submitted yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Applications;
