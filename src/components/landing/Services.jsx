import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Mail, Calendar, Users, Cpu, Workflow, BarChart2 } from 'lucide-react';

const SERVICES = [
  {
    number: '01',
    icon: Cpu,
    title: 'AI Assistance',
    description:
      'Your built-in AI layer handles research, drafts, summaries, and routine decisions so your team focuses on what only humans can do.',
  },
  {
    number: '02',
    icon: Workflow,
    title: 'Workflow Automation',
    description:
      'Map your recurring processes once. Ikamva runs them reliably — from intake to completion — with full audit visibility.',
  },
  {
    number: '03',
    icon: Mail,
    title: 'Email & Calendar Management',
    description:
      'Inbox triage, response drafts, meeting scheduling, and diary management handled before they hit your attention.',
  },
  {
    number: '04',
    icon: Users,
    title: 'Team Coordination',
    description:
      'Shared task queues, progress tracking, and structured handoffs keep everyone aligned without constant check-ins.',
  },
  {
    number: '05',
    icon: Calendar,
    title: 'Schedule & Operations',
    description:
      'End-to-end coordination of meetings, travel, events, and deadlines — managed proactively, not reactively.',
  },
  {
    number: '06',
    icon: BarChart2,
    title: 'Business Insights',
    description:
      'Clear reporting and structured data summaries surface what matters, giving you the visibility to make confident decisions.',
  },
];

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  }),
};

export default function Services() {
  const [active, setActive] = useState(null);
  const prefersReduced = useReducedMotion();

  return (
    <section id="services" className="py-28 lg:py-40 relative">
      {/* Section label */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-end justify-between mb-16 lg:mb-24 border-b border-white/10 pb-8">
          <div>
            <span className="text-[#fcfc03] text-xs font-semibold tracking-[0.2em] uppercase">
              Capabilities
            </span>
            <h2
              className="mt-4 text-4xl lg:text-6xl font-display font-bold text-[#fafaf9] tracking-tight leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              What Ikamva
              <br />
              does for you.
            </h2>
          </div>
          <p className="hidden lg:block max-w-xs text-[#fafaf9]/40 text-sm leading-relaxed text-right">
            Six interconnected capabilities that span the full breadth of your
            operational workload.
          </p>
        </div>

        {/* Service rows */}
        <div className="divide-y divide-white/8">
          {SERVICES.map((service, i) => {
            const Icon = service.icon;
            const isActive = active === i;
            return (
              <motion.div
                key={service.number}
                custom={i}
                variants={prefersReduced ? {} : rowVariants}
                initial={prefersReduced ? false : 'hidden'}
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className={`group flex items-start gap-6 py-8 cursor-default transition-all duration-300 ${
                  isActive ? 'opacity-100' : active !== null ? 'opacity-40' : 'opacity-100'
                }`}
              >
                {/* Number */}
                <span className="shrink-0 text-xs font-semibold text-[#fafaf9]/25 tracking-widest pt-1 w-8">
                  {service.number}
                </span>

                {/* Icon */}
                <div
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-[#fcfc03] text-[#0a0a05]'
                      : 'bg-white/6 text-[#fafaf9]/40'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-6">
                    <h3
                      className={`text-lg lg:text-xl font-semibold transition-colors duration-300 ${
                        isActive ? 'text-[#fafaf9]' : 'text-[#fafaf9]/70'
                      }`}
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {service.title}
                    </h3>
                    <motion.div
                      animate={prefersReduced ? {} : { rotate: isActive ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 w-4 h-4 text-[#fafaf9]/20 group-hover:text-[#fcfc03] transition-colors"
                    >
                      ↗
                    </motion.div>
                  </div>
                  <motion.p
                    animate={prefersReduced ? {} : { height: isActive ? 'auto' : 0, opacity: isActive ? 1 : 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="text-[#fafaf9]/45 text-sm leading-relaxed overflow-hidden"
                  >
                    {service.description}
                  </motion.p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}