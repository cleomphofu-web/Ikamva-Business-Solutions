import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowDown } from 'lucide-react';

// Stagger container helpers
const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
};
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function Hero() {
  const containerRef = useRef(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Parallax on background only — no parallax for reduced-motion
  const bgY = useTransform(scrollYProgress, [0, 1], prefersReduced ? ['0%', '0%'] : ['0%', '35%']);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col justify-center overflow-hidden"
    >
      {/* Background image with parallax */}
      <div className="absolute inset-0 z-0 bg-[#05050a]">
        <motion.div
          style={{ y: bgY, position: 'absolute', inset: 0, top: '-15%', height: '130%' }}
        >
          <img
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1920&auto=format&fit=crop"
            alt=""
            aria-hidden
            className="w-full h-full object-cover object-center"
            style={{ filter: 'saturate(15%) brightness(0.28)' }}
          />
        </motion.div>
        {/* Gradient overlays for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#05050a]/60 via-transparent to-[#0a0a05]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a05]/80 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 w-full pt-32 pb-24 lg:pt-40 lg:pb-32">
        <motion.div
          variants={prefersReduced ? {} : container}
          initial={prefersReduced ? false : 'hidden'}
          animate="show"
          className="max-w-4xl"
        >
          {/* Status pill */}
          <motion.div variants={prefersReduced ? {} : fadeIn} className="mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#fcfc03]/20 bg-[#fcfc03]/5 text-[#fcfc03] text-xs font-semibold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fcfc03] animate-pulse" />
              Accepting new clients
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            variants={prefersReduced ? {} : fadeUp}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-hero font-normal leading-[0.95] tracking-tight text-[#fafaf9]"
            style={{ fontFamily: 'var(--font-hero)' }}
          >
            Work smarter.
            <br />
            <span className="text-[#fcfc03]">Move faster.</span>
            <br />
            <span className="text-[#fafaf9]/40">Stay human.</span>
          </motion.h1>

          {/* Supporting copy */}
          <motion.p
            variants={prefersReduced ? {} : fadeUp}
            className="mt-8 text-lg lg:text-xl text-[#fafaf9]/55 leading-relaxed max-w-xl"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Ikamva gives your team an AI-powered operating layer — handling the
            repetitive, coordinating the complex, and keeping your business moving
            without adding headcount.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={prefersReduced ? {} : fadeUp}
            className="mt-12 flex flex-col sm:flex-row items-start gap-4"
          >
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#fcfc03] text-[#0a0a05] font-semibold text-sm transition-all duration-300 hover:bg-[#fcfc03]/90 hover:shadow-[0_0_40px_rgba(252,252,3,0.3)] hover:scale-[0.97]"
            >
              Start with Ikamva
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#services"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/15 text-[#fafaf9]/70 font-medium text-sm transition-all duration-300 hover:border-white/30 hover:text-[#fafaf9] hover:bg-white/5"
            >
              Explore capabilities
            </a>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#fafaf9]/25"
        >
          <motion.div
            animate={prefersReduced ? {} : { y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowDown className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </div>

      {/* Typographic watermark */}
      <div
        className="absolute right-[-2vw] bottom-[-4vw] z-0 select-none pointer-events-none"
        aria-hidden
      >
        <span
          className="text-[20vw] font-hero font-normal leading-none text-[#fafaf9]/[0.025]"
          style={{ fontFamily: 'var(--font-hero)' }}
        >
          IK
        </span>
      </div>
    </section>
  );
}
