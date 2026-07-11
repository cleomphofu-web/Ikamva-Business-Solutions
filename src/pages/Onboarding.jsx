import appServices from '@/lib/app-services';
import React, { useState } from 'react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, User, Building2, Clock, ClipboardList } from "lucide-react";
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import WhatsAppButton from '@/components/landing/WhatsAppButton';
import { motion } from "framer-motion";

const STEPS = [
  { id: 1, label: 'Your Details', icon: User },
  { id: 2, label: 'Business Info', icon: Building2 },
  { id: 3, label: 'Service Needs', icon: ClipboardList },
  { id: 4, label: 'Schedule', icon: Clock },
];

const EMPTY = {
  // Step 1
  name: '', email: '', phone: '',
  // Step 2
  company: '', industry: '', company_size: '', website: '',
  // Step 3
  service: '', plan: '', primary_tasks: '', tools_used: '', pain_points: '',
  // Step 4
  availability: '', start_date: '', timezone: '', message: '',
};

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const setVal = (field) => (val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async () => {
    setLoading(true);
    await appServices.records.Inquiry.create({
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company,
      service: form.service,
      plan: form.plan,
      message: `
INTAKE FORM SUBMISSION

Business: ${form.company} | Industry: ${form.industry} | Size: ${form.company_size}
Website: ${form.website || 'N/A'}

Primary Tasks Needed: ${form.primary_tasks}
Tools Currently Used: ${form.tools_used || 'N/A'}
Pain Points: ${form.pain_points}

Preferred Availability: ${form.availability}
Desired Start Date: ${form.start_date || 'ASAP'}
Timezone: ${form.timezone || 'SAST'}

Additional Notes: ${form.message || 'None'}
      `.trim(),
      status: 'new',
    });
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-28 pb-24 flex items-center justify-center px-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-3xl border border-border/50 p-12 text-center max-w-lg w-full shadow-lg">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">You're All Set!</h2>
            <p className="text-muted-foreground leading-relaxed">
              Thank you, <strong>{form.name}</strong>! We've received your intake form and will reach out within <strong>24 business hours</strong> to schedule your onboarding call.
            </p>
            <div className="mt-8 bg-secondary/50 rounded-2xl p-4 text-sm text-muted-foreground">
              <p>📧 Check your inbox for a confirmation email</p>
              <p className="mt-1">💬 WhatsApp us at +27 67 340 3752 for urgent queries</p>
            </div>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-28 pb-24 max-w-3xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <span className="text-sm font-semibold text-primary tracking-wider uppercase">Client Onboarding</span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">Let's Get You Started</h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Complete this intake form so we can match you with the right virtual assistant and service plan.
          </p>
        </motion.div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-10 px-4">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  step > s.id ? 'bg-primary border-primary text-primary-foreground' :
                  step === s.id ? 'border-primary text-primary bg-primary/10' :
                  'border-border text-muted-foreground'
                }`}>
                  {step > s.id ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step === s.id ? 'text-primary' : 'text-muted-foreground'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > s.id ? 'bg-primary' : 'bg-border'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-card rounded-3xl border border-border/50 p-8">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <h2 className="text-xl font-semibold mb-6">Your Personal Details</h2>
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Jane Smith" value={form.name} onChange={set('name')} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email Address *</Label>
                <Input type="email" placeholder="jane@company.com" value={form.email} onChange={set('email')} required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number *</Label>
                <Input placeholder="+27 82 000 0000" value={form.phone} onChange={set('phone')} required />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <h2 className="text-xl font-semibold mb-6">Business Information</h2>
              <div className="space-y-1.5">
                <Label>Company / Business Name *</Label>
                <Input placeholder="Acme Corp" value={form.company} onChange={set('company')} required />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select onValueChange={setVal('industry')}>
                    <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="real_estate">Real Estate</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Company Size</Label>
                  <Select onValueChange={setVal('company_size')}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solo">Solo / Freelancer</SelectItem>
                      <SelectItem value="2-10">2–10 employees</SelectItem>
                      <SelectItem value="11-50">11–50 employees</SelectItem>
                      <SelectItem value="51+">51+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Website (optional)</Label>
                <Input placeholder="https://yourwebsite.com" value={form.website} onChange={set('website')} />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <h2 className="text-xl font-semibold mb-6">Service Requirements</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Primary Service Needed *</Label>
                  <Select onValueChange={setVal('service')}>
                    <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="schedule_management">Schedule Management</SelectItem>
                      <SelectItem value="email_management">Email Management</SelectItem>
                      <SelectItem value="document_preparation">Document Preparation</SelectItem>
                      <SelectItem value="communication_hub">Communication Hub</SelectItem>
                      <SelectItem value="general">General VA Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Plan of Interest *</Label>
                  <Select onValueChange={setVal('plan')}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (R3,500/mo)</SelectItem>
                      <SelectItem value="professional">Growth (R7,500/mo)</SelectItem>
                      <SelectItem value="enterprise">Premium (R15,000/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>What tasks do you need help with? *</Label>
                <Textarea
                  placeholder="e.g. Managing my calendar, responding to client emails, preparing monthly reports..."
                  className="h-28"
                  value={form.primary_tasks}
                  onChange={set('primary_tasks')}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tools / Software you currently use</Label>
                <Input placeholder="e.g. Google Workspace, Slack, Trello, Xero..." value={form.tools_used} onChange={set('tools_used')} />
              </div>
              <div className="space-y-1.5">
                <Label>What are your biggest pain points?</Label>
                <Textarea
                  placeholder="e.g. I'm spending too much time on admin and not enough on growing my business..."
                  className="h-24"
                  value={form.pain_points}
                  onChange={set('pain_points')}
                />
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <h2 className="text-xl font-semibold mb-6">Scheduling & Preferences</h2>
              <div className="space-y-1.5">
                <Label>Preferred Working Hours *</Label>
                <Select onValueChange={setVal('availability')}>
                  <SelectTrigger><SelectValue placeholder="Select availability" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Mornings (8am–12pm SAST)</SelectItem>
                    <SelectItem value="afternoon">Afternoons (12pm–5pm SAST)</SelectItem>
                    <SelectItem value="full_day">Full Day (8am–5pm SAST)</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                    <SelectItem value="after_hours">After Hours / Evenings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Desired Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={set('start_date')} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select onValueChange={setVal('timezone')}>
                    <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAST">SAST (UTC+2)</SelectItem>
                      <SelectItem value="CAT">CAT (UTC+2)</SelectItem>
                      <SelectItem value="EAT">EAT (UTC+3)</SelectItem>
                      <SelectItem value="WAT">WAT (UTC+1)</SelectItem>
                      <SelectItem value="GMT">GMT (UTC+0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Anything else you'd like us to know?</Label>
                <Textarea
                  placeholder="Additional requirements, preferences, or questions..."
                  className="h-28"
                  value={form.message}
                  onChange={set('message')}
                />
              </div>
            </motion.div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="rounded-full"
            >
              Back
            </Button>
            {step < 4 ? (
              <Button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={
                  (step === 1 && (!form.name || !form.email || !form.phone)) ||
                  (step === 2 && !form.company) ||
                  (step === 3 && (!form.service || !form.plan || !form.primary_tasks))
                }
                className="rounded-full"
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !form.availability}
                className="rounded-full"
              >
                {loading ? 'Submitting...' : 'Submit Intake Form'}
              </Button>
            )}
          </div>
        </div>
      </div>
      <WhatsAppButton />
      <Footer />
    </div>
  );
}