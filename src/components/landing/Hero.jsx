import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function DemoModal({ onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="aspect-video w-full bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-2">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-2">Fullscope VA Demo</h3>
              <p className="text-white/60 max-w-md text-sm leading-relaxed">
                See how our virtual assistants handle your email management, calendar scheduling, document preparation, and more — all through your personal client portal.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 w-full max-w-xl">
              {[
                { label: '📧 Email Management', desc: 'Inbox zero in 24hrs' },
                { label: '📅 Calendar Scheduling', desc: 'Zero double-bookings' },
                { label: '📄 Document Prep', desc: 'Professional output' },
                { label: '📊 Monthly Reports', desc: 'Full transparency' },
                { label: '💬 Communication Hub', desc: 'Never miss a call' },
                { label: '🔒 Secure Portal', desc: 'Your data, safe' },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-white text-xs font-medium">{item.label}</p>
                  <p className="text-white/40 text-xs mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
            <a href="/onboarding">
              <Button className="mt-2 rounded-full px-8 bg-white text-black hover:bg-white/90 gap-2">
                Get Started Today <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Hero() {
  const [showDemo, setShowDemo] = useState(false);
  return (
    <><section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 w-full py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center lg:text-left">
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Professional Virtual Assistance
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold leading-tight tracking-tight">
              Your time is{' '}
              <span className="text-primary">precious.</span>
              <br />
              Let us handle the rest.
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Ikamva Virtual Admin Assist provides dependable remote administrative support to busy professionals, founders, and small businesses — without the cost of full-time staff.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <a href="/onboarding">
                <Button size="lg" className="rounded-full px-8 text-base gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <Button variant="ghost" size="lg" onClick={() => setShowDemo(true)} className="rounded-full px-8 text-base gap-2 text-muted-foreground">
                <div className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                Watch Demo
              </Button>
            </div>

            <div className="mt-12 flex items-center gap-6 justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {['bg-violet-400', 'bg-blue-400', 'bg-emerald-400', 'bg-amber-400'].map((c, i) =>
                <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-background`} />
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">2,000+</span> professionals trust Fullscope
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative hidden lg:block">
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-3xl blur-2xl scale-95" />
              <div className="relative bg-gradient-to-br from-primary/5 to-accent/5 rounded-3xl overflow-hidden border border-border/30 shadow-2xl aspect-[4/3] flex items-center justify-center">
                <div className="text-center p-12">
                  <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-12 h-12 text-primary" />
                  </div>
                  <p className="text-2xl font-display font-bold text-foreground mb-2">Meet IKA</p>
                  <p className="text-muted-foreground">Your dedicated virtual assistant team</p>
                  <div className="mt-6 flex gap-2 justify-center flex-wrap">
                    {['Email', 'Calendar', 'Documents', 'Data Entry', 'CRM', 'Reporting'].map((tag) =>
                    <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{tag}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="absolute -left-8 bottom-16 bg-card rounded-2xl shadow-xl border border-border/50 p-4">
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-lg">✓</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">Task Completed</p>
                  <p className="text-xs text-muted-foreground">Inbox organized — 47 emails sorted</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
    {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
    </>
  );
}