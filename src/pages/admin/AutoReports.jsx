const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, Loader2, Plus, Trash2, Eye, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const YEARS = ['2024', '2025', '2026', '2027'];

const EMPTY_FORM = {
  client_email: '',
  month_name: '',
  year: '2026',
  hours_used: '',
  hours_allocated: '',
  tasks_completed: '',
  task_breakdown: '',
  notes: '',
};

export default function AutoReports() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [preview, setPreview] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => db.entities.UsageReport.list('-created_date', 100),
  });

  const deleteMut = useMutation({
    mutationFn: id => db.entities.UsageReport.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      toast.success('Report deleted');
    },
  });

  const saveMut = useMutation({
    mutationFn: (data) => db.entities.UsageReport.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      setModal(false);
      setForm(EMPTY_FORM);
      setGeneratedSummary('');
      toast.success('Report saved and visible to client');
    },
  });

  const generateSummary = async () => {
    if (!form.client_email || !form.hours_used || !form.hours_allocated) {
      toast.error('Please fill in client email, hours used, and hours allocated first.');
      return;
    }
    setGenerating(true);
    const breakdownText = form.task_breakdown
      ? `\nTask breakdown:\n${form.task_breakdown}`
      : '';
    const res = await db.integrations.Core.InvokeLLM({
      prompt: `You are a professional virtual assistant agency writing a monthly usage report for a client.

Client: ${form.client_email}
Month: ${form.month_name} ${form.year}
Hours Used: ${form.hours_used} of ${form.hours_allocated} allocated hours
Tasks Completed: ${form.tasks_completed || 'not specified'}
${breakdownText}
Additional notes from VA: ${form.notes || 'none'}

Write a professional, warm 2-3 sentence summary of the work done this month. Focus on value delivered, progress made, and next steps if applicable. Keep it concise and client-friendly.`,
      response_json_schema: {
        type: 'object',
        properties: { summary: { type: 'string' } },
      },
    });
    setGeneratedSummary(res.summary || '');
    setGenerating(false);
  };

  const parseBreakdown = (text) => {
    if (!text) return [];
    return text.split('\n').map(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        return { task: parts[0].trim(), hours: parseFloat(parts[1]) || 0 };
      }
      return null;
    }).filter(Boolean);
  };

  const handleSave = () => {
    const month = `${form.month_name} ${form.year}`;
    const breakdown = parseBreakdown(form.task_breakdown);
    saveMut.mutate({
      client_email: form.client_email,
      month,
      hours_used: parseFloat(form.hours_used),
      hours_allocated: parseFloat(form.hours_allocated),
      tasks_completed: parseInt(form.tasks_completed) || 0,
      summary: generatedSummary,
      breakdown,
    });
  };

  const groupedByClient = reports.reduce((acc, r) => {
    if (!acc[r.client_email]) acc[r.client_email] = [];
    acc[r.client_email].push(r);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Automated Reports</h1>
          <p className="text-muted-foreground mt-1">Generate AI-powered monthly usage reports for clients.</p>
        </div>
        <Button onClick={() => { setModal(true); setGeneratedSummary(''); setForm(EMPTY_FORM); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Generate Report
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && reports.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg">No reports yet</p>
          <p className="text-muted-foreground text-sm mt-1">Generate your first AI-powered usage report above.</p>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groupedByClient).map(([email, clientReports]) => (
          <div key={email} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-6 py-4 bg-secondary/30 border-b border-border/50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{email}</p>
                <p className="text-xs text-muted-foreground">{clientReports.length} report{clientReports.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {clientReports.map(report => (
                <div key={report.id} className="flex items-center justify-between px-6 py-4 hover:bg-secondary/20 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{report.month}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {report.hours_used}h / {report.hours_allocated}h · {report.tasks_completed || 0} tasks
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 mr-4">
                      <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min((report.hours_used / report.hours_allocated) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((report.hours_used / report.hours_allocated) * 100)}%
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setPreview(report)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (window.confirm('Delete this report?')) deleteMut.mutate(report.id);
                    }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Generate Report Modal */}
      <Dialog open={modal} onOpenChange={v => { setModal(v); if (!v) { setForm(EMPTY_FORM); setGeneratedSummary(''); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Generate Monthly Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Client Email *</Label>
              <Input className="mt-1" placeholder="client@example.com"
                value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Month *</Label>
                <Select value={form.month_name} onValueChange={v => setForm(f => ({ ...f, month_name: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select month" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year *</Label>
                <Select value={form.year} onValueChange={v => setForm(f => ({ ...f, year: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Hours Used *</Label>
                <Input className="mt-1" type="number" placeholder="e.g. 18"
                  value={form.hours_used} onChange={e => setForm(f => ({ ...f, hours_used: e.target.value }))} />
              </div>
              <div>
                <Label>Hours Allocated *</Label>
                <Input className="mt-1" type="number" placeholder="e.g. 20"
                  value={form.hours_allocated} onChange={e => setForm(f => ({ ...f, hours_allocated: e.target.value }))} />
              </div>
              <div>
                <Label>Tasks Completed</Label>
                <Input className="mt-1" type="number" placeholder="e.g. 14"
                  value={form.tasks_completed} onChange={e => setForm(f => ({ ...f, tasks_completed: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Task Breakdown <span className="text-muted-foreground font-normal">(one per line: Task Name: hours)</span></Label>
              <Textarea className="mt-1 h-28 font-mono text-sm" placeholder={"Email management: 6\nCalendar scheduling: 4\nDocument preparation: 5\nClient communication: 3"}
                value={form.task_breakdown} onChange={e => setForm(f => ({ ...f, task_breakdown: e.target.value }))} />
            </div>
            <div>
              <Label>VA Notes <span className="text-muted-foreground font-normal">(used by AI to craft summary)</span></Label>
              <Textarea className="mt-1 h-20" placeholder="e.g. Great month overall, client launched new campaign. Helped with outreach emails and report preparation."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* AI Generate Button */}
            <div className="bg-secondary/40 rounded-xl p-4 border border-border/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-sm">AI Summary</p>
                  <p className="text-xs text-muted-foreground">Auto-generate a professional monthly summary</p>
                </div>
                <Button variant="outline" size="sm" onClick={generateSummary} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {generating ? 'Generating...' : 'Generate with AI'}
                </Button>
              </div>
              {generatedSummary && (
                <Textarea
                  className="h-24 text-sm bg-card"
                  value={generatedSummary}
                  onChange={e => setGeneratedSummary(e.target.value)}
                />
              )}
              {!generatedSummary && (
                <p className="text-xs text-muted-foreground italic">Fill in the fields above and click "Generate with AI" to create a client-ready summary.</p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setModal(false); setForm(EMPTY_FORM); setGeneratedSummary(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMut.isPending || !form.client_email || !form.month_name || !form.hours_used || !form.hours_allocated}
              className="gap-2"
            >
              {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save & Publish to Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {preview && (
        <Dialog open onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{preview.month} — Usage Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold">{preview.hours_used}h</p>
                  <p className="text-xs text-muted-foreground">Used</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold">{preview.hours_allocated}h</p>
                  <p className="text-xs text-muted-foreground">Allocated</p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold">{preview.tasks_completed || 0}</p>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                </div>
              </div>
              {preview.summary && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</p>
                  <p className="leading-relaxed">{preview.summary}</p>
                </div>
              )}
              {preview.breakdown?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breakdown</p>
                  <div className="space-y-1.5">
                    {preview.breakdown.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">{item.task}</span>
                        <span className="font-medium">{item.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}