const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";

export default function NewsletterBar() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await db.entities.Subscriber.create({ email, status: 'active' });
    setDone(true);
    setLoading(false);
  };

  return (
    <section className="py-16 bg-secondary/50 border-y border-border/50">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h3 className="text-xl font-bold mb-2">Stay in the loop</h3>
        <p className="text-muted-foreground text-sm mb-6">Get productivity tips and Aura updates straight to your inbox.</p>
        {done ? (
          <div className="flex items-center justify-center gap-2 text-primary font-medium">
            <CheckCircle2 className="w-5 h-5" />
            You're subscribed — thank you!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" className="rounded-full px-6" disabled={loading}>
              {loading ? '...' : 'Subscribe'}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}