import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function GetStarted() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="py-28 lg:py-40 border-t border-white/8">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="relative rounded-3xl overflow-hidden bg-[#494920]/20 border border-[#fcfc03]/10 p-12 lg:p-20">
          {/* Glow accent */}
          <div
            className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#fcfc03]/8 blur-3xl pointer-events-none"
            aria-hidden
          />
          <div className="relative z-10 max-w-2xl">
            <motion.span
              initial={prefersReduced ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[#fcfc03] text-xs font-semibold tracking-[0.2em] uppercase"
            >
              Get started
            </motion.span>

            <motion.h2
              initial={prefersReduced ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mt-5 text-4xl lg:text-6xl font-display font-bold text-[#fafaf9] tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Ready to move
              <br />
              from tasks to
              <br />
              <span className="text-[#fcfc03]">progress?</span>
            </motion.h2>

            <motion.p
              initial={prefersReduced ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mt-7 text-[#fafaf9]/45 text-lg leading-relaxed"
            >
              Create your account and see how Ikamva fits your workflow.
              No commitment required to explore.
            </motion.p>

            <motion.div
              initial={prefersReduced ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-10 flex flex-col sm:flex-row gap-4"
            >
              <Link
                to="/signup"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#fcfc03] text-[#0a0a05] font-semibold text-sm transition-all duration-300 hover:bg-[#fcfc03]/90 hover:shadow-[0_0_50px_rgba(252,252,3,0.25)] hover:scale-[0.97]"
              >
                Create your account
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-white/15 text-[#fafaf9]/60 font-medium text-sm transition-all duration-300 hover:border-white/30 hover:text-[#fafaf9] hover:bg-white/5"
              >
                Talk to the team
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
