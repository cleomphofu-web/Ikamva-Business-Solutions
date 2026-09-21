import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Services from '../components/landing/Services';
import About from '../components/landing/About';
import Pillars from '../components/landing/Pillars';
import GetStarted from '../components/landing/GetStarted';
import Footer from '../components/landing/Footer';
import WhatsAppButton from '../components/landing/WhatsAppButton';

// Sections removed in this redesign:
// - HowItWorks (replaced by Services editorial rows)
// - Pricing (replaced by GetStarted CTA — no pricing finalized)
// - Testimonials (no verified testimonials exist)
// - FAQ (moved inline if needed; currently omitted)
// - CTA (replaced by GetStarted)
// - NewsletterBar (no newsletter flow implemented)

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0a0a05]">
      <Navbar />
      <Hero />
      <Services />
      <About />
      <Pillars />
      <GetStarted />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
