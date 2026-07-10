import React from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Services from '../components/landing/Services';
import HowItWorks from '../components/landing/HowItWorks';
import Pricing from '../components/landing/Pricing';
import Testimonials from '../components/landing/Testimonials';
import CTA from '../components/landing/CTA';
import FAQ from '../components/landing/FAQ';
import WhatsAppButton from '../components/landing/WhatsAppButton';
import NewsletterBar from '../components/landing/NewsletterBar';
import Footer from '../components/landing/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Services />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <NewsletterBar />
      <WhatsAppButton />
      <Footer />
    </div>
  );
}