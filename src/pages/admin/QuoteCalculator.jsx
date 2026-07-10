import React, { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator, Plus, Trash2, Download } from 'lucide-react';

const RATES = { starter: 350, growth: 300, premium: 300, project: 450 };

const PACKAGES = [
  { key: 'starter', label: 'Starter Package', rate: 350, hours: 10, monthly: 3500 },
  { key: 'growth', label: 'Growth Package', rate: 300, hours: 25, monthly: 7500 },
  { key: 'premium', label: 'Premium Package', rate: 300, hours: null, monthly: 15000 },
  { key: 'project', label: 'Project Based', rate: 450, hours: null, monthly: null },
];

const emptyLine = { description: '', hours: '', rate: 450 };

export default function QuoteCalculator() {
  const [mode, setMode] = useState('package'); // 'package' | 'custom'
  const [selectedPkg, setSelectedPkg] = useState('starter');
  const [customHours, setCustomHours] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [clientName, setClientName] = useState('');
  const [vatRate, setVatRate] = useState(0);

  const addLine = () => setLines(l => [...l, { ...emptyLine }]);
  const removeLine = i => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, k, v) => setLines(l => l.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const pkg = PACKAGES.find(p => p.key === selectedPkg);

  const subtotal = mode === 'package'
    ? (selectedPkg === 'project'
        ? (parseFloat(customHours) || 0) * RATES.project
        : selectedPkg === 'premium'
          ? 15000
          : (pkg?.monthly || 0))
    : lines.reduce((s, l) => s + (parseFloat(l.hours) || 0) * (parseFloat(l.rate) || 0), 0);

  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Quote Calculator</h1>
        <p className="text-muted-foreground mt-1">Generate accurate quotes for clients</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Client */}
          <div className="bg-card rounded-2xl border border-border/50 p-6">
            <h2 className="font-semibold mb-4">Client Details</h2>
            <Input placeholder="Client name or company" value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>

          {/* Mode toggle */}
          <div className="bg-card rounded-2xl border border-border/50 p-6">
            <div className="flex gap-3 mb-6">
              <button onClick={() => setMode('package')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${mode === 'package' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                Package Pricing
              </button>
              <button onClick={() => setMode('custom')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${mode === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                Custom Quote
              </button>
            </div>

            {mode === 'package' && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Select a package</h3>
                {PACKAGES.map(p => (
                  <label key={p.key} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${selectedPkg === p.key ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-secondary/30'}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" className="accent-primary" checked={selectedPkg === p.key} onChange={() => setSelectedPkg(p.key)} />
                      <div>
                        <p className="font-medium text-sm">{p.label}</p>
                        <p className="text-xs text-muted-foreground">R{p.rate}/hr{p.hours ? ` · ${p.hours} hrs/month` : ''}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-sm">{p.monthly ? `R${p.monthly.toLocaleString()}/mo` : 'Variable'}</p>
                  </label>
                ))}
                {selectedPkg === 'project' && (
                  <div className="mt-4">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Estimated hours for this project</label>
                    <Input type="number" placeholder="e.g. 20" value={customHours} onChange={e => setCustomHours(e.target.value)} className="w-40" />
                  </div>
                )}
              </div>
            )}

            {mode === 'custom' && (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b border-border/50">
                  <span className="col-span-5">Description</span>
                  <span className="col-span-3">Hours</span>
                  <span className="col-span-3">Rate (R/hr)</span>
                  <span className="col-span-1"></span>
                </div>
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Input placeholder="e.g. Inbox management" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" placeholder="0" value={line.hours} onChange={e => updateLine(i, 'hours', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" value={line.rate} onChange={e => updateLine(i, 'rate', e.target.value)} />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => removeLine(i)} className="p-1 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addLine} className="gap-2 mt-2">
                  <Plus className="w-3.5 h-3.5" /> Add Line
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-5">
          <div className="bg-card rounded-2xl border border-border/50 p-6 sticky top-8">
            <div className="flex items-center gap-2 mb-5">
              <Calculator className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Quote Summary</h2>
            </div>

            {clientName && <p className="text-sm font-medium mb-4 pb-4 border-b border-border/50">For: {clientName}</p>}

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">R {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">VAT (%)</span>
                <Input type="number" value={vatRate} onChange={e => setVatRate(parseFloat(e.target.value) || 0)} className="w-20 h-7 text-xs text-right" />
              </div>
              {vatRate > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT ({vatRate}%)</span>
                  <span>R {vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-3 border-t border-border/50">
                <span>Total</span>
                <span>R {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="mt-5 space-y-2 text-xs text-muted-foreground bg-secondary/40 rounded-xl p-4">
              <p>• All amounts in South African Rand (ZAR)</p>
              <p>• Rates: R350/hr (Starter) · R300/hr (Growth/Premium) · R450/hr (Project)</p>
              <p>• Retainer packages billed monthly in advance</p>
            </div>

            <Button className="w-full mt-5 gap-2" onClick={() => window.print()}>
              <Download className="w-4 h-4" /> Print / Save Quote
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}