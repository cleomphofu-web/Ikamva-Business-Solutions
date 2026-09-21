import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Product pillars — no invented numbers or statistics
const PILLARS = [
  {
    label: 'Transparent',
    body: 'Every action Ikamva takes is logged and auditable. You always know what happened and why.',
  },
  {
    label: 'Reliable',
    body: 'Consistent execution on routine tasks, with escalation paths for anything that needs human judgement.',
  },
  {
    label: 'Contextual',
    body: 'Ikamva works from your actual processes and data — not generic templates that need constant adjustment.',
  },
  {
    label: 'Scalable',
    body: "As your team and workload grow, Ikamva scales with you without requiring you to rebuild from scratch.",
  },
];

export default function Pillars() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="py-28 lg:py-40 border-t border-white/8">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="mb-16 lg:mb-24">
          <motion.span
            initial={prefersReduced ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-[#fcfc03] text-xs font-semibold tracking-[0.2em] uppercase"
          >
            Principles
          </motion.span>
          <motion.h2
            initial={prefersReduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mt-4 text-4xl lg:text-5xl font-display font-bold text-[#fafaf9] tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            What we stand for.
          </motion.h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/8 rounded-2xl overflow-hidden">
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.label}
              initial={prefersReduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-[#0a0a05] p-8 lg:p-10 flex flex-col gap-4 group hover:bg-[#494920]/20 transition-colors duration-300"
            >
              <span className="text-xs font-semibold text-[#fcfc03] tracking-widest uppercase">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3
                className="text-xl font-semibold text-[#fafaf9] leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {pillar.label}
              </h3>
              <p className="text-sm text-[#fafaf9]/40 leading-relaxed">{pillar.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
