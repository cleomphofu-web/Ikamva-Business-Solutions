import React from 'react';
import { motion } from "framer-motion";
import { Calendar, Mail, FileText, Database, BarChart2, Users, Plane, BookOpen, Settings, Star } from "lucide-react";

const coreServices = [
  { icon: Mail, title: "Email & Inbox Management", description: "Inbox triage, prioritisation, and draft responses so nothing important falls through the cracks." },
  { icon: Calendar, title: "Calendar & Diary Management", description: "Full diary management, time-blocking, and scheduling to protect your time and maximise focus." },
  { icon: Users, title: "Meeting Scheduling & Follow-ups", description: "End-to-end meeting coordination — from booking to follow-up notes and action items." },
  { icon: FileText, title: "Document Creation & Formatting", description: "Professional documents, proposals, and reports crafted with precision and attention to detail." },
  { icon: Database, title: "Data Entry & Spreadsheets", description: "Accurate data entry, spreadsheet maintenance, and CRM updates handled efficiently." },
  { icon: BarChart2, title: "Basic Reporting", description: "Clear, concise reports that give you the visibility you need to make confident decisions." },
];

const addOnServices = [
  { icon: Plane, title: "Travel & Itinerary Coordination" },
  { icon: BookOpen, title: "Simple Research Summaries" },
  { icon: Settings, title: "SOP Drafting & Process Documentation" },
  { icon: Star, title: "Event Coordination Support" },
  { icon: Users, title: "Client Onboarding Admin" },
];

export default function Services() {
  return (
    <section id="services" className="py-24 lg:py-32 relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-20"
        >
          <span className="text-sm font-semibold text-primary tracking-wider uppercase">Services</span>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight">
            Everything you need,
            <br />
            <span className="text-primary">nothing you don't</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
            Our virtual assistants specialize across dozens of disciplines to provide comprehensive support tailored to your workflow.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {coreServices.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative bg-card rounded-2xl border border-border/50 p-8 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                <service.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{service.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-secondary/50 rounded-2xl p-8"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-5 text-center">Add-On Services</p>
          <div className="flex flex-wrap justify-center gap-3">
            {addOnServices.map(s => (
              <div key={s.title} className="flex items-center gap-2 bg-card border border-border/50 rounded-full px-4 py-2 text-sm font-medium">
                <s.icon className="w-3.5 h-3.5 text-primary" />
                {s.title}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}