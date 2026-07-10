import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "How quickly can I get started with a virtual assistant?",
    answer: "Once you sign up, we match you with a dedicated VA within 24 hours. After a quick onboarding call to understand your workflow and priorities, your VA is ready to start taking tasks off your plate — usually the same day."
  },
  {
    question: "What types of tasks can my virtual assistant handle?",
    answer: "Your VA can handle a wide range: inbox management, calendar scheduling, meeting coordination, document preparation, data entry, research, client follow-ups, call screening, and much more. If you're unsure whether a task qualifies, just ask — we're flexible."
  },
  {
    question: "Is my data and business information kept confidential?",
    answer: "Absolutely. All Fullscope VAs sign strict NDAs and confidentiality agreements before working with any client. We use secure, encrypted platforms for all communication and file sharing, and we never share your information with third parties."
  },
  {
    question: "What happens if I'm not happy with my assigned VA?",
    answer: "Your satisfaction is our priority. If for any reason you're not the right fit with your VA, simply let us know and we'll arrange a replacement within 24 hours — no questions asked."
  },
  {
    question: "What packages do you offer?",
    answer: "We offer three retainer packages: Starter (10 hrs/month at R3,500), Growth (25 hrs/month at R7,500), and Premium (dedicated priority support at R15,000/month). We also offer project-based pricing at R450/hr or a fixed scope quote for once-off work like setup, clean-up, or process documentation."
  },
  {
    question: "Do unused hours roll over to the next month?",
    answer: "Hours on the Starter and Growth packages do not roll over. Premium clients can discuss custom arrangements. We encourage you to make full use of your hours — your VA can proactively suggest tasks if you're running low."
  },
  {
    question: "Can I upgrade or downgrade my plan at any time?",
    answer: "Yes! You can change your plan at any time with no penalties. Upgrades take effect immediately, and downgrades apply at the start of your next billing cycle."
  },
  {
    question: "How does the referral programme work?",
    answer: "For every client you successfully refer who signs up for a paid plan, you earn a R500 account credit. There's no limit to how many people you can refer, and credits can be used towards any future invoice."
  },
  {
    question: "What are your VAs' working hours?",
    answer: "Our VAs work standard business hours in South Africa (SAST), Monday to Friday. Enterprise clients can request extended coverage. We'll always communicate clearly about availability and response times upfront."
  }
];

function FAQItem({ faq, index }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border border-border/50 rounded-2xl overflow-hidden bg-card"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="font-medium text-sm sm:text-base pr-4">{faq.question}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-border/50 pt-4">
              {faq.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="py-24 lg:py-32">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-primary tracking-wider uppercase">FAQ</span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight">
            Frequently asked
            <br />
            <span className="text-primary">questions</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            Everything you need to know about working with Fullscope Business Solutions.
          </p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem key={i} faq={faq} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center bg-secondary/50 rounded-2xl p-8"
        >
          <p className="font-semibold">Still have questions?</p>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Our team is happy to help — reach out anytime.</p>
          <a href="/contact" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
            Contact Us
          </a>
        </motion.div>
      </div>
    </section>
  );
}