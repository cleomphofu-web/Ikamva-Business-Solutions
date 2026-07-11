import authService from '@/lib/auth-service';
import appServices from '@/lib/app-services';
import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/client/DashboardLayout';
import { Clock, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const statusIcon = {
  active: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  paused: <PauseCircle className="w-4 h-4 text-yellow-500" />,
  cancelled: <XCircle className="w-4 h-4 text-red-400" />,
};

const serviceLabels = {
  schedule_management: 'Schedule Management',
  email_management: 'Email Management',
  document_preparation: 'Document Preparation',
  communication_hub: 'Communication Hub',
};

export default function ServiceHours() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['client-services', user?.email],
    queryFn: () => appServices.records.ClientService.filter({ client_email: user.email }),
    enabled: !!user?.email,
  });

  return (
    <DashboardLayout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Service Hours</h1>
        <p className="text-muted-foreground mt-1">Track your allocated and used hours across all active services.</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && services.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg">No services yet</p>
          <p className="text-muted-foreground text-sm mt-1">Your service details will appear here once a plan is activated.</p>
        </div>
      )}

      <div className="space-y-5">
        {services.map(service => {
          const pct = service.hours_allocated ? Math.min(Math.round((service.hours_used / service.hours_allocated) * 100), 100) : 0;
          const remaining = (service.hours_allocated || 0) - (service.hours_used || 0);
          const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-primary';

          return (
            <div key={service.id} className="bg-card rounded-2xl border border-border/50 p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcon[service.status]}
                    <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                      service.status === 'active' ? 'bg-green-100 text-green-700' :
                      service.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-600'
                    }`}>{service.status}</span>
                  </div>
                  <h3 className="text-lg font-semibold capitalize">{service.plan} Plan</h3>
                  {service.service_type && (
                    <p className="text-muted-foreground text-sm">{serviceLabels[service.service_type] || service.service_type}</p>
                  )}
                </div>
                {service.va_name && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Assigned VA</p>
                    <p className="font-medium text-sm">{service.va_name}</p>
                    {service.va_email && <p className="text-xs text-muted-foreground">{service.va_email}</p>}
                  </div>
                )}
              </div>

              {service.hours_allocated > 0 && (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Hours used this month</span>
                    <span className="font-semibold">{service.hours_used}h / {service.hours_allocated}h</span>
                  </div>
                  <div className="h-3 w-full bg-secondary rounded-full overflow-hidden mb-2">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{pct}% used</span>
                    <span>{remaining > 0 ? `${remaining}h remaining` : 'Hours exhausted'}</span>
                  </div>
                </>
              )}

              {service.renewal_date && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Next renewal: <span className="text-foreground font-medium">{format(new Date(service.renewal_date), 'dd MMMM yyyy')}</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}