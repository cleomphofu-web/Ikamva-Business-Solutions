import React from 'react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 md:px-16 md:py-24 text-center">
          
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-primary-foreground tracking-tight">
              Ready to reclaim
              <br />
              your time?
            </h2>
            <p className="mt-5 text-primary-foreground/75 text-lg max-w-xl mx-auto leading-relaxed">Join thousands of professionals who delegated their way to success. Get started today and let our team handle the rest.

            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/contact">
                <Button
                  size="lg"
                  className="rounded-full px-8 text-base bg-white text-primary hover:bg-white/90 shadow-lg gap-2">
                  
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="/contact">
                <Button
                  size="lg"
                  className="rounded-full px-8 text-base border border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent">
                  
                  Talk to Us
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>);

}