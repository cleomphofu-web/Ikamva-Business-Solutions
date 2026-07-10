import React from 'react';
import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "Fullscope gave me back 15 hours a week. My VA handles everything from email triage to travel booking. It's like having a superpower.",
    name: "Sarah Mitchell",
    role: "CEO, Bloom Studios",
    initials: "SM",
    color: "bg-violet-100 text-violet-600"
  },
  {
    quote: "The onboarding was incredibly smooth. Within a day, my VA understood my workflow better than most human assistants I've worked with.",
    name: "David Chen",
    role: "Managing Partner, NovaTech",
    initials: "DC",
    color: "bg-blue-100 text-blue-600"
  },
  {
    quote: "I was skeptical at first, but Fullscope's assistants are genuinely world-class. The research reports alone have been game-changing for our team.",
    name: "Emily Rodriguez",
    role: "Creative Director, Pixel & Co",
    initials: "ER",
    color: "bg-emerald-100 text-emerald-600"
  }
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 lg:py-32 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-20"
        >
          <span className="text-sm font-semibold text-primary tracking-wider uppercase">Testimonials</span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight">
            Loved by
            <br />
            <span className="text-primary">thousands</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-card rounded-2xl border border-border/50 p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex gap-1 mb-5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-foreground leading-relaxed mb-8">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${t.color}`}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}