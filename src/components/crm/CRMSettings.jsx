import React, { useState } from 'react';
import { Settings, Bell, Layout, Shield, Database, Palette, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SECTIONS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'modules', label: 'Modules', icon: Layout },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'data', label: 'Data Management', icon: Database },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

export default function CRMSettings() {
  const [active, setActive] = useState('general');
  const [prefs, setPrefs] = useState({
    crmName: 'Ikamva CRM',
    currency: 'ZAR',
    dateFormat: 'dd MMM yyyy',
    emailNotifications: true,
    taskReminders: true,
    leadAlerts: true,
    weeklyReport: false,
    twoFactor: false,
    sessionTimeout: '30',
  });

  const set = (k, v) => setPrefs(p => ({ ...p, [k]: v }));
  const save = () => { toast.success('Settings saved'); };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">CRM Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure your CRM preferences</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-2 space-y-0.5">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active === s.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                <s.icon className="w-4 h-4" /> {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            {active === 'general' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 mb-4">General Settings</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">CRM Name</label>
                    <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={prefs.crmName} onChange={e => set('crmName', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Currency</label>
                    <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={prefs.currency} onChange={e => set('currency', e.target.value)}>
                      <option>ZAR</option><option>USD</option><option>EUR</option><option>GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Date Format</label>
                    <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white" value={prefs.dateFormat} onChange={e => set('dateFormat', e.target.value)}>
                      <option>dd MMM yyyy</option><option>MM/dd/yyyy</option><option>yyyy-MM-dd</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Session Timeout (min)</label>
                    <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={prefs.sessionTimeout} onChange={e => set('sessionTimeout', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {active === 'modules' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 mb-4">Module Visibility</h3>
                {['Dashboard', 'Leads', 'Contacts', 'Accounts', 'Deals', 'Activities', 'Calendar', 'Emails', 'Reports', 'Marketing', 'Support', 'Documents', 'Users'].map(m => (
                  <div key={m} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-700">{m}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                ))}
              </div>
            )}

            {active === 'notifications' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 mb-4">Notification Preferences</h3>
                {[
                  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive email alerts for CRM activity' },
                  { key: 'taskReminders', label: 'Task Reminders', desc: 'Get reminded about upcoming task deadlines' },
                  { key: 'leadAlerts', label: 'Lead Alerts', desc: 'Notify when a new lead is created' },
                  { key: 'weeklyReport', label: 'Weekly Report', desc: 'Receive a weekly CRM summary email' },
                ].map(n => (
                  <div key={n.key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{n.label}</p>
                      <p className="text-xs text-slate-400">{n.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={prefs[n.key]} onChange={e => set(n.key, e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                ))}
              </div>
            )}

            {active === 'security' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 mb-4">Security Settings</h3>
                <div className="flex items-center justify-between py-3 border-b border-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
                    <p className="text-xs text-slate-400">Add an extra layer of security</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={prefs.twoFactor} onChange={e => set('twoFactor', e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs text-amber-700">Role-based access control is active. Only admins can modify CRM settings and manage users.</p>
                </div>
              </div>
            )}

            {active === 'data' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 mb-4">Data Management</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Export CRM Data</p>
                      <p className="text-xs text-slate-400">Download all leads, contacts, and deals</p>
                    </div>
                    <Button variant="outline" size="sm">Export</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Backup Database</p>
                      <p className="text-xs text-slate-400">Create a full backup snapshot</p>
                    </div>
                    <Button variant="outline" size="sm">Backup</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
                    <div>
                      <p className="text-sm font-medium text-red-700">Clear Test Data</p>
                      <p className="text-xs text-red-400">Remove all test records (irreversible)</p>
                    </div>
                    <Button variant="destructive" size="sm">Clear</Button>
                  </div>
                </div>
              </div>
            )}

            {active === 'appearance' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 mb-4">Appearance</h3>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">Theme</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Light', 'Dark', 'System'].map((t, i) => (
                      <div key={t} className={`p-4 rounded-xl border-2 cursor-pointer text-center text-sm font-medium ${i === 0 ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-2 block">Accent Color</label>
                  <div className="flex gap-2">
                    {['bg-indigo-600', 'bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-500'].map((c, i) => (
                      <button key={c} className={`w-8 h-8 rounded-full ${c} ${i === 0 ? 'ring-2 ring-offset-2 ring-indigo-600' : ''}`} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
              <Button className="bg-indigo-600 hover:bg-indigo-700 gap-1.5" onClick={save}>
                <Save className="w-4 h-4" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}