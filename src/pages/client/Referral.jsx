import authService from '@/lib/auth-service';
import appServices from '@/lib/app-services';
import React, { useEffect, useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/client/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Gift, Users, CheckCircle2, Clock, Send, Star } from 'lucide-react';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700' },
  contacted: { label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  converted: { label: 'Converted', color: 'bg-green-100 text-green-700' },
  rewarded:  { label: 'Rewarded',  color: 'bg-violet-100 text-violet-700' },
};

const empty = { referred_name: '', referred_email: '', referred_company: '', message: '' };

export default function Referral() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(empty);
  const [submitted, setSubmitted] = useState(false);
  const qc = useQueryClient();

  useEffect(() => { authService.getCurrentUser().then(setUser); }, []);

  const { data: referrals = [] } = useQuery({
    queryKey: ['my-referrals', user?.email],
    queryFn: () => appServices.records.Referral.filter({ referrer_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const createMut = useMutation({
    mutationFn: data => appServices.records.Referral.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-referrals'] });
      setForm(empty);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.referred_name || !form.referred_email) return;
    createMut.mutate({
      ...form,
      referrer_email: user.email,
      referrer_name: user.full_name || user.email,
    });
  };

  const earned = referrals.filter(r => r.status === 'rewarded').reduce((s, r) => s + (r.reward_amount || 500), 0);
  const pending = referrals.filter(r => ['pending', 'contacted'].includes(r.status)).length;
  const converted = referrals.filter(r => ['converted', 'rewarded'].includes(r.status)).length;

  return (
    <DashboardLayout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Referral Programme</h1>
        <p className="text-muted-foreground mt-1">Earn R500 credit for every friend you refer who signs up.</p>
      </div>

      {/* Hero banner */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-6 md:p-8 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Gift className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">Earn R500 per referral</p>
            <p className="text-primary-foreground/75 text-sm mt-1">Share Fullscope with your network. When they sign up for a paid plan, you get R500 account credit — no limits.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center flex-shrink-0">
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <p className="text-2xl font-bold">{referrals.length}</p>
            <p className="text-xs text-primary-foreground/70 mt-0.5">Total</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <p className="text-2xl font-bold">{converted}</p>
            <p className="text-xs text-primary-foreground/70 mt-0.5">Converted</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <p className="text-2xl font-bold">R{earned.toLocaleString()}</p>
            <p className="text-xs text-primary-foreground/70 mt-0.5">Earned</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Referral form */}
        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <h2 className="font-semibold text-lg mb-1">Refer someone</h2>
          <p className="text-muted-foreground text-sm mb-6">Fill in their details and we'll reach out on your behalf.</p>

          {submitted && (
            <div className="flex items-center gap-3 bg-green-50 text-green-700 rounded-xl p-4 mb-5">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">Referral submitted! We'll be in touch with them shortly.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Their Name *</label>
              <Input value={form.referred_name} onChange={e => setForm(f => ({ ...f, referred_name: e.target.value }))} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Their Email *</label>
              <Input type="email" value={form.referred_email} onChange={e => setForm(f => ({ ...f, referred_email: e.target.value }))} placeholder="jane@company.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Their Company</label>
              <Input value={form.referred_company} onChange={e => setForm(f => ({ ...f, referred_company: e.target.value }))} placeholder="Company name (optional)" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Personal Message</label>
              <textarea
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Why you think they'd benefit from Fullscope..."
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={createMut.isPending || !form.referred_name || !form.referred_email}>
              <Send className="w-4 h-4" />
              {createMut.isPending ? 'Submitting…' : 'Submit Referral'}
            </Button>
          </form>
        </div>

        {/* How it works */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border/50 p-6">
            <h2 className="font-semibold text-lg mb-5">How it works</h2>
            <div className="space-y-5">
              {[
                { icon: Users, title: 'Refer a contact', desc: 'Submit the details of someone who could benefit from a VA.' },
                { icon: Send, title: 'We reach out', desc: 'Our team contacts them, mentioning your referral.' },
                { icon: CheckCircle2, title: 'They sign up', desc: 'When they subscribe to a paid plan, your referral is confirmed.' },
                { icon: Star, title: 'You earn R500', desc: 'R500 credit is applied to your next invoice automatically.' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terms */}
          <div className="bg-secondary/50 rounded-2xl p-5 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground text-sm mb-2">Terms & Conditions</p>
            <p>• Reward is R500 account credit per successful conversion.</p>
            <p>• Credits are applied after the referred client completes their first paid month.</p>
            <p>• There is no cap on the number of referrals you can make.</p>
            <p>• Credits cannot be exchanged for cash.</p>
          </div>
        </div>
      </div>

      {/* Referral history */}
      {referrals.length > 0 && (
        <div className="mt-8 bg-card rounded-2xl border border-border/50 p-6">
          <h2 className="font-semibold mb-5">My Referrals</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">Email</th>
                  <th className="pb-3 font-medium hidden md:table-cell">Company</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Reward</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map(r => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium">{r.referred_name}</td>
                    <td className="py-3 text-muted-foreground hidden sm:table-cell text-xs">{r.referred_email}</td>
                    <td className="py-3 text-muted-foreground hidden md:table-cell text-xs">{r.referred_company || '—'}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_CONFIG[r.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_CONFIG[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium">
                      {r.status === 'rewarded' ? <span className="text-green-600">R{(r.reward_amount || 500).toLocaleString()}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}