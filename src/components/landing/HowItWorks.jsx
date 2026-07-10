import React from 'react';
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Tell us your needs",
    description: "Share your workflow, preferences, and pain points. We'll match you with a VA who specializes in exactly what you need."
  },
  {
    number: "02",
    title: "Get matched instantly",
    description: "Our team matches you with a vetted virtual assistant within 24 hours. No interviews, no hassle — just the right fit."
  },
  {
    number: "03",
    title: "Delegate & thrive",
    description: "Hand off tasks through our intuitive platform. Your VA works seamlessly in the background while you focus on growth."
  }
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-20"
        >
          <span className="text-sm font-semibold text-primary tracking-wider uppercase">How It Works</span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight">
            Three steps to
            <br />
            <span className="text-primary">total freedom</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative text-center"
            >
              <div className="text-7xl lg:text-8xl font-display font-bold text-primary/10 mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-semibold mb-3 -mt-4">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>

              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 -right-6 lg:-right-8 w-12 lg:w-16 h-px bg-border" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}