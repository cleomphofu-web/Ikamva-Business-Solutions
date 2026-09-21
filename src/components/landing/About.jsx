import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },
});

export default function About() {
  const prefersReduced = useReducedMotion();

  return (
    <section id="about" className="py-28 lg:py-40 border-t border-white/8">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left column */}
          <div>
            <motion.span
              variants={prefersReduced ? {} : fadeUp(0)}
              initial={prefersReduced ? false : 'hidden'}
              whileInView="show"
              viewport={{ once: true }}
              className="text-[#fcfc03] text-xs font-semibold tracking-[0.2em] uppercase"
            >
              About Ikamva
            </motion.span>
            <motion.h2
              variants={prefersReduced ? {} : fadeUp(0.1)}
              initial={prefersReduced ? false : 'hidden'}
              whileInView="show"
              viewport={{ once: true }}
              className="mt-5 text-4xl lg:text-5xl font-display font-bold text-[#fafaf9] tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Built for teams
              <br />
              ready to work
              <br />
              <span className="text-[#fafaf9]/35">differently.</span>
            </motion.h2>
          </div>

          {/* Right column */}
          <motion.div
            variants={prefersReduced ? {} : fadeUp(0.2)}
            initial={prefersReduced ? false : 'hidden'}
            whileInView="show"
            viewport={{ once: true }}
            className="flex flex-col gap-8 pt-2 lg:pt-14"
          >
            <p className="text-[#fafaf9]/55 text-lg leading-relaxed">
              Ikamva is an AI-powered operating system for growing teams. It
              brings structure to the parts of your business that eat time without
              adding value — admin, coordination, and repetitive decision-making.
            </p>
            <p className="text-[#fafaf9]/40 text-base leading-relaxed">
              Most businesses grow by hiring more people to do the same kinds of
              work. Ikamva changes that pattern. It gives your existing team a
              durable, intelligent layer that handles operational load so they can
              focus on the work that actually matters.
            </p>
            <p className="text-[#fafaf9]/40 text-base leading-relaxed">
              Designed for founders, professionals, and small teams in South
              Africa and beyond who want a smarter way to run, not a bigger one.
            </p>

            <div className="pt-4">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#fcfc03] hover:text-[#fcfc03]/80 transition-colors group"
              >
                Start building with Ikamva
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
