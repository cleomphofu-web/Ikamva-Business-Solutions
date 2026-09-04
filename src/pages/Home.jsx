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
import Grainient from '@/components/Grainient';

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#F7F1DE]">
      <div className="fixed inset-0 w-screen h-screen -z-50 pointer-events-none overflow-hidden" aria-hidden>
        <Grainient
          warpSpeed={5.3}
          colorBalance={-0.22}
          blendSoftness={1}
          warpFrequency={3.5}
          noiseScale={1.3}
          timeSpeed={2.4}
          grainScale={2.3}
          color1="#60492c"
          color2="#1F150C"
          color3="#412D15"
          warpAmplitude={33}
          warpStrength={0.15}
          rotationAmount={740}
          zoom={1.5}
          grainAmount={0.18}
          grainAnimated={true}
        />
      </div>
      <Navbar />
      <div className="relative z-10 bg-transparent">
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
    </div>
  );
}
