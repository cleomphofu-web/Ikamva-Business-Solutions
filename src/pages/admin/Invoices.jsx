import appServices from '@/lib/app-services';
import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Plus, Pencil, Trash2, X, Save, Download } from 'lucide-react';
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';
import { notifyInvoiceCreated, notifyInvoicePaid } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  paid:      'bg-green-100 text-green-700',
  overdue:   'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

const empty = {
  client_email: '', invoice_number: '', month: '', period_start: '', period_end: '',
  hours_billed: '', rate_per_hour: '', subtotal: '', tax: 0, total: '', status: 'draft',
  due_date: '', paid_date: '', notes: '',
};

function calcTotals(form) {
  const sub = parseFloat(form.hours_billed || 0) * parseFloat(form.rate_per_hour || 0);
  const tax = parseFloat(form.tax || 0);
  return { subtotal: sub, total: sub + tax };
}

function InvoiceModal({ invoice, reports, onClose, onSave, saving }) {
  const [form, setForm] = useState(invoice || empty);
  const set = (k, v) => setForm(f => {
    const updated = { ...f, [k]: v };
    const { subtotal, total } = calcTotals(updated);
    return { ...updated, subtotal, total };
  });

  const handleAutoFill = (reportId) => {
    const r = reports.find(r => r.id === reportId);
    if (!r) return;
    setForm(f => {
      const hours = r.hours_used || 0;
      const rate = parseFloat(f.rate_per_hour || 0);
      const subtotal = hours * rate;
      const tax = parseFloat(f.tax || 0);
      return {
        ...f,
        usage_report_id: r.id,
        client_email: r.client_email,
        month: r.month,
        period_start: r.period_start || '',
        period_end: r.period_end || '',
        hours_billed: hours,
        subtotal,
        total: subtotal + tax,
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <h2 className="font-semibold text-lg">{invoice?.id ? 'Edit Invoice' : 'New Invoice'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Auto-fill from report */}
          {!invoice?.id && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Auto-fill from Usage Report</label>
              <select
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onChange={e => e.target.value && handleAutoFill(e.target.value)}
                defaultValue=""
              >
                <option value="">— Select a report —</option>
                {reports.map(r => (
                  <option key={r.id} value={r.id}>{r.client_email} · {r.month} ({r.hours_used}h)</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Client Email *</label>
              <Input value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="client@example.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Invoice #</label>
              <Input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="INV-2026-001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Billing Month *</label>
              <Input value={form.month} onChange={e => set('month', e.target.value)} placeholder="April 2026" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
              <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Hours Billed</label>
              <Input type="number" value={form.hours_billed} onChange={e => set('hours_billed', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rate / Hour (R)</label>
              <Input type="number" value={form.rate_per_hour} onChange={e => set('rate_per_hour', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subtotal (R)</label>
              <Input type="number" value={form.subtotal} onChange={e => set('subtotal', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tax (R)</label>
              <Input type="number" value={form.tax} onChange={e => set('tax', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block font-semibold">Total (R) *</label>
              <Input type="number" value={form.total} onChange={e => set('total', e.target.value)} className="font-semibold" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Due Date</label>
              <Input type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Paid Date</label>
              <Input type="date" value={form.paid_date || ''} onChange={e => set('paid_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-border/50">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.client_email || !form.month}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminInvoices() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: () => appServices.records.Invoice.list('-created_date'),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports-all'],
    queryFn: () => appServices.records.UsageReport.list('-created_date'),
  });

  const createMut = useMutation({
    mutationFn: data => appServices.records.Invoice.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin-invoices'] });
      setModal(null);
      if (created?.client_email) notifyInvoiceCreated(created);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data, prevStatus }) => appServices.records.Invoice.update(id, data).then(updated => ({ updated, prevStatus })),
    onSuccess: ({ updated, prevStatus }) => {
      qc.invalidateQueries({ queryKey: ['admin-invoices'] });
      setModal(null);
      if (updated?.status === 'paid' && prevStatus !== 'paid') notifyInvoicePaid(updated);
    },
  });

  const deleteMut = useMutation({
    mutationFn: id => appServices.records.Invoice.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-invoices'] }),
  });

  const handleSave = (form) => {
    if (modal?.id) updateMut.mutate({ id: modal.id, data: form, prevStatus: modal.status });
    else createMut.mutate(form);
  };

  const handleStatusChange = (id, status) => {
    const inv = invoices.find(i => i.id === id);
    const extra = status === 'paid' ? { paid_date: new Date().toISOString().split('T')[0] } : {};
    updateMut.mutate({ id, data: { status, ...extra }, prevStatus: inv?.status });
  };

  const filtered = invoices.filter(inv => {
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    const matchSearch = !search || inv.client_email?.toLowerCase().includes(search.toLowerCase()) || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) || inv.month?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalOutstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0);

  return (
    <AdminLayout>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Invoices</h1>
            <p className="text-muted-foreground mt-1">Generate and manage client billing</p>
          </div>
          <Button onClick={() => setModal('new')} className="gap-2">
            <Plus className="w-4 h-4" /> New Invoice
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <p className="text-sm text-muted-foreground mb-1">Total Invoices</p>
            <p className="text-3xl font-bold">{invoices.length}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
            <p className="text-3xl font-bold text-orange-600">R {totalOutstanding.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <p className="text-sm text-muted-foreground mb-1">Collected</p>
            <p className="text-3xl font-bold text-green-600">R {totalPaid.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap items-center">
          <Input className="w-56" placeholder="Search client, invoice #, month…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-2 flex-wrap">
            {['all', ...STATUSES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
            <p className="font-semibold">No invoices found</p>
            <p className="text-muted-foreground text-sm mt-1">Create a new invoice or adjust your filters.</p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left">
                  <th className="px-5 py-3.5 font-medium text-muted-foreground">Invoice</th>
                  <th className="px-5 py-3.5 font-medium text-muted-foreground hidden md:table-cell">Client</th>
                  <th className="px-5 py-3.5 font-medium text-muted-foreground hidden sm:table-cell">Period</th>
                  <th className="px-5 py-3.5 font-medium text-muted-foreground">Total</th>
                  <th className="px-5 py-3.5 font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3.5 font-medium text-muted-foreground hidden lg:table-cell">Due</th>
                  <th className="px-5 py-3.5 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4 font-medium">{inv.invoice_number || '—'}</td>
                    <td className="px-5 py-4 hidden md:table-cell text-muted-foreground text-xs">{inv.client_email}</td>
                    <td className="px-5 py-4 hidden sm:table-cell text-muted-foreground text-xs">{inv.month}</td>
                    <td className="px-5 py-4 font-semibold">R {(inv.total || 0).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <select
                        value={inv.status}
                        onChange={e => handleStatusChange(inv.id, e.target.value)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer capitalize appearance-none focus:outline-none ${STATUS_COLORS[inv.status]}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-xs text-muted-foreground">
                      {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => generateInvoicePdf(inv)} title="Download PDF" className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setModal(inv)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => deleteMut.mutate(inv.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {modal && (
        <InvoiceModal
          invoice={modal === 'new' ? null : modal}
          reports={reports}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </AdminLayout>
  );
}