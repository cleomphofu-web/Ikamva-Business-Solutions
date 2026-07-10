import React from 'react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "3,500",
    rate: "R350/hr",
    hours: "10 hrs/month",
    description: "Best for light admin support",
    features: [
      "10 hours per month",
      "Inbox triage & email management",
      "Calendar scheduling",
      "File organisation",
      "Client portal access",
      "Standard response time"
    ],
    popular: false
  },
  {
    name: "Growth",
    price: "7,500",
    rate: "R300/hr",
    hours: "25 hrs/month",
    description: "Best for recurring admin needs",
    features: [
      "25 hours per month",
      "Calendar & document management",
      "Data entry & reporting",
      "CRM updates & sales admin",
      "Dedicated VA assigned",
      "Priority response time"
    ],
    popular: true
  },
  {
    name: "Premium",
    price: "15,000",
    rate: "R300/hr",
    hours: "50+ hrs/month",
    description: "Best for executives & fast turnaround",
    features: [
      "50+ hours per month",
      "Priority task handling",
      "Fast turnaround guaranteed",
      "Meeting & travel coordination",
      "Dedicated VA assigned",
      "Account manager included"
    ],
    popular: false
  }
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-20"
        >
          <span className="text-sm font-semibold text-primary tracking-wider uppercase">Pricing</span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight">
            Simple, transparent
            <br />
            <span className="text-primary">pricing</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            Retainer-based packages designed for reliable, ongoing admin support. Project-based pricing also available.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/25 scale-105'
                  : 'bg-card border border-border/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent text-accent-foreground text-xs font-semibold rounded-full whitespace-nowrap">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className={`text-sm mt-1 ${plan.popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {plan.description}
                </p>
              </div>

              <div className="mb-2">
                <span className="text-4xl font-bold">R{plan.price}</span>
                <span className={`text-sm ml-1 ${plan.popular ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  /month
                </span>
              </div>
              <div className={`mb-6 text-xs font-medium ${plan.popular ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                {plan.rate} · {plan.hours}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      plan.popular ? 'text-primary-foreground/80' : 'text-primary'
                    }`} />
                    <span className={plan.popular ? 'text-primary-foreground/90' : ''}>{feature}</span>
                  </li>
                ))}
              </ul>

              <a href={`/contact?plan=${plan.name.toLowerCase()}`}>
                <Button
                  className={`w-full rounded-full ${
                    plan.popular ? 'bg-white text-primary hover:bg-white/90' : ''
                  }`}
                  variant={plan.popular ? 'secondary' : 'default'}
                >
                  Get Started
                </Button>
              </a>
            </motion.div>
          ))}
        </div>

        {/* Project pricing note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 max-w-2xl mx-auto text-center bg-secondary/50 rounded-2xl p-6 border border-border/50"
        >
          <p className="font-semibold text-sm mb-1">Need once-off project support?</p>
          <p className="text-muted-foreground text-sm">Setup, clean-up, migration, formatting, or process documentation — billed at <strong>R450/hr</strong> or a fixed quote based on scope.</p>
          <a href="/contact" className="inline-flex mt-4 items-center gap-2 text-sm font-medium text-primary hover:underline">Get a custom quote →</a>
        </motion.div>
      </div>
    </section>
  );
}