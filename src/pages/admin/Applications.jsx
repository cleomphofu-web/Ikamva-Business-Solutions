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
        <div className="rounded-3xl border border-white/10 bg-card/60 p-6 shadow-2xl backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Platform Review</p>
          <h1 className="mt-3 text-3xl font-display font-semibold tracking-tight text-foreground">Client Applications</h1>
          <p className="mt-2 text-sm text-muted-foreground">Review pending signups and approve or reject them.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-card/50 p-5 shadow-xl backdrop-blur-xl">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{data.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card/50 p-5 shadow-xl backdrop-blur-xl">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{data.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card/50 p-5 shadow-xl backdrop-blur-xl">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="mt-2 text-3xl font-bold text-[#fcfc03]">Live</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/60 p-6 shadow-2xl backdrop-blur-2xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Submitted applications</h2>
            <Badge variant="secondary" className="rounded-full bg-white/10 text-slate-200">
              {isLoading ? 'Loading…' : `${data.length} records`}
            </Badge>
          </div>

          <div className="space-y-4">
            {data.map(application => (
              <article key={application.id} className="rounded-2xl border border-white/10 bg-card/50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{application.full_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{application.email}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{application.company_name || 'No company name provided'}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">{application.phone || 'No phone provided'}</p>
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
                    className="rounded-xl h-10 px-5 font-medium bg-primary text-primary-foreground hover-scale"
                    disabled={busyId === application.id || application.status !== 'pending'}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => review(application.id, 'rejected')}
                    className="rounded-xl h-10 px-5 font-medium border-border/50 bg-black/20 text-foreground hover:bg-white/10"
                    disabled={busyId === application.id || application.status !== 'pending'}
                  >
                    Reject
                  </Button>
                </div>
              </article>
            ))}
            {data.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-muted-foreground">
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
