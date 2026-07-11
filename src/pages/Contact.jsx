import appServices from '@/lib/app-services';
import React, { useState } from 'react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Mail, Phone, MapPin } from "lucide-react";
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import WhatsAppButton from '../components/landing/WhatsAppButton';
import { motion } from "framer-motion";

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', service: '', plan: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await appServices.records.Inquiry.create(form);
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-28 pb-24 max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-center mb-16">
          <span className="text-sm font-semibold text-primary tracking-wider uppercase">Get In Touch</span>
          <h1 className="mt-4 text-4xl lg:text-5xl font-bold tracking-tight">Let's talk about your needs</h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Tell us what you need help with and we'll get back to you within 24 hours.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-12">
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Email Us</p>
                <p className="text-muted-foreground text-sm mt-1">ayandamph95@outlook.com</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Call Us</p>
                <p className="text-muted-foreground text-sm mt-1">+27 67 340 3752</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Location</p>
                <p className="text-muted-foreground text-sm mt-1">South Africa (Remote Services Nationwide)</p>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-2xl p-6 border border-border/50">
              <p className="font-semibold mb-2">Response Time</p>
              <p className="text-muted-foreground text-sm">We respond to all inquiries within <span className="text-foreground font-medium">24 business hours</span>.</p>
            </div>
          </div>

          <div className="lg:col-span-2">
            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-card rounded-2xl border border-border/50 p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Message Received!</h3>
                <p className="text-muted-foreground">Thank you, {form.name}. We'll be in touch within 24 hours.</p>
                <Button className="mt-6 rounded-full" onClick={() => { setSubmitted(false); setForm({ name: '', email: '', phone: '', company: '', service: '', plan: '', message: '' }); }}>
                  Send Another
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border/50 p-8 space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full Name *</Label>
                    <Input placeholder="Jane Smith" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address *</Label>
                    <Input type="email" placeholder="jane@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone Number</Label>
                    <Input placeholder="+27 82 000 0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company</Label>
                    <Input placeholder="Your Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Service of Interest</Label>
                    <Select onValueChange={val => setForm({ ...form, service: val })}>
                      <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="schedule_management">Schedule Management</SelectItem>
                        <SelectItem value="email_management">Email Management</SelectItem>
                        <SelectItem value="document_preparation">Document Preparation</SelectItem>
                        <SelectItem value="communication_hub">Communication Hub</SelectItem>
                        <SelectItem value="general">General Enquiry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plan of Interest</Label>
                    <Select onValueChange={val => setForm({ ...form, plan: val })}>
                      <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter (R3,500/mo)</SelectItem>
                        <SelectItem value="professional">Growth (R7,500/mo)</SelectItem>
                        <SelectItem value="enterprise">Premium (R15,000/mo)</SelectItem>
                        <SelectItem value="project">Project Based (R450/hr)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Message *</Label>
                  <Textarea placeholder="Tell us about your needs and how we can help..." className="h-32" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required />
                </div>
                <Button type="submit" size="lg" className="w-full rounded-full" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
      <WhatsAppButton />
      <Footer />
    </div>
  );
}