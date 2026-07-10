const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/client/DashboardLayout';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function UsageReports() {
  const [user, setUser] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    db.auth.me().then(setUser);
  }, []);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['client-reports', user?.email],
    queryFn: () => db.entities.UsageReport.filter({ client_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const chartData = [...reports].reverse().map(r => ({
    month: r.month?.split(' ')[0] || r.month,
    used: r.hours_used,
    allocated: r.hours_allocated,
  }));

  return (
    <DashboardLayout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Usage Reports</h1>
        <p className="text-muted-foreground mt-1">Monthly breakdowns of your virtual assistant activity.</p>
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
          <p className="text-muted-foreground text-sm mt-1">Your monthly usage reports will appear here.</p>
        </div>
      )}

      {reports.length > 1 && (
        <div className="bg-card rounded-2xl border border-border/50 p-6 mb-6">
          <h2 className="font-semibold mb-4">Hours Overview</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                cursor={{ fill: 'hsl(var(--secondary))' }}
              />
              <Bar dataKey="allocated" fill="hsl(var(--secondary))" name="Allocated" radius={[4, 4, 0, 0]} />
              <Bar dataKey="used" fill="hsl(var(--primary))" name="Used" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="space-y-4">
        {reports.map(report => (
          <div key={report.id} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-6 hover:bg-secondary/30 transition-colors"
              onClick={() => setExpanded(expanded === report.id ? null : report.id)}
            >
              <div className="text-left">
                <p className="font-semibold">{report.month}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {report.hours_used}h used of {report.hours_allocated}h · {report.tasks_completed || 0} tasks completed
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:block w-32">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((report.hours_used / report.hours_allocated) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">{Math.round((report.hours_used / report.hours_allocated) * 100)}%</p>
                </div>
                {expanded === report.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {expanded === report.id && (
              <div className="px-6 pb-6 border-t border-border/50 pt-4 space-y-4">
                {report.summary && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</p>
                    <p className="text-sm leading-relaxed">{report.summary}</p>
                  </div>
                )}
                {report.breakdown?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Task Breakdown</p>
                    <div className="space-y-2">
                      {report.breakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.task}</span>
                          <span className="font-medium">{item.hours}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}