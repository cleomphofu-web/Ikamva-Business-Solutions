import authService from '@/lib/auth-service';
import appServices from '@/lib/app-services';
import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/client/DashboardLayout';
import { Receipt, CheckCircle2, Clock, AlertCircle, XCircle, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600',    icon: Clock },
  sent:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700',    icon: Receipt },
  paid:      { label: 'Paid',      color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  overdue:   { label: 'Overdue',   color: 'bg-red-100 text-red-700',      icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500',  icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function ClientBilling() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['client-invoices', user?.email],
    queryFn: () => appServices.records.Invoice.filter({ client_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const totalPaid     = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);
  const totalPending  = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0);
  const overdueCount  = invoices.filter(i => i.status === 'overdue').length;

  return (
    <DashboardLayout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Your invoice history and payment status.</p>
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Total Paid</p>
          </div>
          <p className="text-2xl font-bold text-green-700">R {totalPaid.toLocaleString()}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Outstanding</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">R {totalPending.toLocaleString()}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl ${overdueCount > 0 ? 'bg-red-50' : 'bg-secondary'} flex items-center justify-center`}>
              <AlertCircle className={`w-4 h-4 ${overdueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Overdue</p>
          </div>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : ''}`}>{overdueCount}</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && invoices.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg">No invoices yet</p>
          <p className="text-muted-foreground text-sm mt-1">Your billing history will appear here once invoices are issued.</p>
        </div>
      )}

      {!isLoading && invoices.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50">
            <h2 className="font-semibold">Invoice History</h2>
          </div>
          <div className="divide-y divide-border/50">
            {invoices.map(inv => (
              <div key={inv.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Receipt className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{inv.month}</p>
                      {inv.invoice_number && <span className="text-xs text-muted-foreground">· {inv.invoice_number}</span>}
                    </div>
                    {inv.hours_billed > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{inv.hours_billed}h billed @ R{inv.rate_per_hour}/hr</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                      {inv.due_date && <span>Due {format(new Date(inv.due_date), 'dd MMM yyyy')}</span>}
                      {inv.paid_date && inv.status === 'paid' && (
                        <span className="text-green-600">Paid {format(new Date(inv.paid_date), 'dd MMM yyyy')}</span>
                      )}
                    </div>
                    {inv.notes && <p className="text-xs text-muted-foreground mt-1 italic">{inv.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <p className="text-lg font-bold">R {(inv.total || 0).toLocaleString()}</p>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}