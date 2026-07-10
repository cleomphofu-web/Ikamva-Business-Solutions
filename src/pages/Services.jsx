const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Calendar, Mail, FileText, Phone, X, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

// ── Data ────────────────────────────────────────────────────────────────────

const SERVICES = [
  {
    key: 'schedule_management',
    icon: Calendar,
    title: 'Schedule Management',
    description: 'Smart calendar organization, meeting coordination, and time-blocking to maximize your productivity.',
    features: ['Calendar setup & management', 'Meeting scheduling & reminders', 'Time-blocking strategies', 'Travel logistics coordination'],
  },
  {
    key: 'email_management',
    icon: Mail,
    title: 'Email Management',
    description: 'Inbox zero achieved. We filter, prioritize, and draft responses so nothing important slips through.',
    features: ['Inbox triage & labelling', 'Drafting replies on your behalf', 'Unsubscribe & spam clean-up', 'Daily email briefings'],
  },
  {
    key: 'document_preparation',
    icon: FileText,
    title: 'Document Preparation',
    description: 'Professional presentations, proposals, and documents crafted with precision and attention to detail.',
    features: ['Proposals & presentations', 'Report formatting & design', 'Proofreading & editing', 'Template creation'],
  },
  {
    key: 'communication_hub',
    icon: Phone,
    title: 'Communication Hub',
    description: 'Call screening, voicemail management, and client follow-ups handled with a personal touch.',
    features: ['Call screening & logging', 'Voicemail transcription', 'Client follow-up emails', 'CRM data entry'],
  },
];

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '3,500',
    rate: 'R350/hr',
    hours: 10,
    description: 'Best for light admin support',
    features: ['10 hours/month VA support', 'Email & inbox management', 'Calendar scheduling', 'File organisation', 'Client portal access', 'Standard response time'],
    popular: false,
  },
  {
    key: 'professional',
    name: 'Growth',
    price: '7,500',
    rate: 'R300/hr',
    hours: 25,
    description: 'Best for recurring admin needs',
    features: ['25 hours/month VA support', 'Calendar & document management', 'Data entry & reporting', 'CRM updates & sales admin', 'Dedicated VA assigned', 'Priority response time'],
    popular: true,
  },
  {
    key: 'enterprise',
    name: 'Premium',
    price: '15,000',
    rate: 'R300/hr',
    hours: 50,
    description: 'Best for executives & fast turnaround',
    features: ['50+ hours/month VA support', 'Priority task handling', 'Fast turnaround guaranteed', 'Meeting & travel coordination', 'Dedicated VA assigned', 'Account manager included'],
    popular: false,
  },
];

// ── Request Modal ────────────────────────────────────────────────────────────

function RequestModal({ preselectedPlan, preselectedService, onClose }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    service: preselectedService || 'general',
    plan: preselectedPlan || '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await db.entities.Inquiry.create({ ...form, status: 'new' });
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div>
            <h2 className="font-bold text-lg">Request a Service</h2>
            <p className="text-muted-foreground text-sm mt-0.5">We'll be in touch within 24 hours</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {done ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-bold text-xl mb-2">Request Received!</h3>
            <p className="text-muted-foreground">Thank you, we'll review your request and get back to you within 24 hours.</p>
            <Button className="mt-6 rounded-full px-8" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name *</label>
                <Input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email *</label>
                <Input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone</label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+27 82 000 0000" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Company</label>
                <Input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Inc." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Service of Interest</label>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.service} onChange={e => set('service', e.target.value)}
                >
                  <option value="general">General Enquiry</option>
                  {SERVICES.map(s => <option key={s.key} value={s.key}>{s.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Plan of Interest</label>
                <select
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.plan} onChange={e => set('plan', e.target.value)}
                >
                  <option value="">— Select a plan —</option>
                  {PLANS.map(p => <option key={p.key} value={p.key}>{p.name} (R{p.price}/mo)</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
              <textarea
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3} value={form.message} onChange={e => set('message', e.target.value)}
                placeholder="Tell us a bit about what you need help with…"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="gap-2 rounded-full px-6">
                <Send className="w-4 h-4" />
                {submitting ? 'Sending…' : 'Submit Request'}
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [modal, setModal] = useState(null); // { plan?, service? } | null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-36 pb-20 text-center px-6">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-medium text-primary">Virtual Assistant Services</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
            Services built around <span className="text-primary">your workflow</span>
          </h1>
          <p className="mt-5 text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            Choose a service area and a plan that fits your needs. Our VAs are ready to take work off your plate from day one.
          </p>
          <Button size="lg" className="mt-8 rounded-full px-8" onClick={() => setModal({})}>
            Get Started Today
          </Button>
        </motion.div>
      </section>

      {/* Services */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary tracking-wider uppercase">What we do</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Our core services</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {SERVICES.map((service, i) => (
              <motion.div
                key={service.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card rounded-2xl border border-border/50 p-8 hover:border-primary/20 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <service.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">{service.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">{service.description}</p>
                    <ul className="space-y-1.5 mb-5">
                      {service.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setModal({ service: service.key })}>
                      Request this service
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-sm font-semibold text-primary tracking-wider uppercase">Pricing</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Choose your plan</h2>
            <p className="mt-3 text-muted-foreground">No hidden fees. No long-term contracts. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  plan.popular
                    ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/25 scale-105'
                    : 'bg-card border border-border/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-foreground text-background text-xs font-semibold rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className={`text-sm mt-1 ${plan.popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">R{plan.price}</span>
                  <span className={`text-sm ml-1 ${plan.popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>/month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.popular ? 'text-primary-foreground/80' : 'text-primary'}`} />
                      <span className={plan.popular ? 'text-primary-foreground/90' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full rounded-full ${plan.popular ? 'bg-white text-primary hover:bg-white/90' : ''}`}
                  variant={plan.popular ? 'secondary' : 'default'}
                  onClick={() => setModal({ plan: plan.key })}
                >
                  Get Started
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />

      <AnimatePresence>
        {modal && (
          <RequestModal
            preselectedPlan={modal.plan}
            preselectedService={modal.service}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}