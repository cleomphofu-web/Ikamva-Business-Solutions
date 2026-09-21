import React from 'react';
import { Link } from 'react-router-dom';

const links = {
  Product: [
    { label: 'Services', href: '#services' },
    { label: 'About', href: '#about' },
    { label: 'Client Portal', href: '/dashboard' },
  ],
  Company: [
    { label: 'Contact', href: '/contact' },
    { label: 'Sign In', href: '/signin' },
    { label: 'Get Started', href: '/signup' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-[#05050a]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="group inline-flex items-center gap-2.5 mb-5">
              <div className="h-7 w-7 rounded-lg bg-[#fcfc03] flex items-center justify-center">
                <span className="text-[#0a0a05] text-xs font-black tracking-tight">IK</span>
              </div>
              <span className="text-[#fafaf9] font-semibold text-base tracking-tight">
                Ikamva
              </span>
            </Link>
            <p className="text-sm text-[#fafaf9]/35 leading-relaxed max-w-[200px]">
              An AI-powered operating layer for growing teams.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold tracking-widest uppercase text-[#fafaf9]/35 mb-5">
                {category}
              </h4>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.href}
                      className="text-sm text-[#fafaf9]/50 hover:text-[#fafaf9] transition-colors duration-200"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-white/8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <p className="text-xs text-[#fafaf9]/25">
            © {new Date().getFullYear()} Ikamva Business Solutions. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://www.linkedin.com/company/ikamva-business-solutions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#fafaf9]/30 hover:text-[#fafaf9]/70 transition-colors"
            >
              LinkedIn
            </a>
            <a
              href="https://www.instagram.com/ikamva_va"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#fafaf9]/30 hover:text-[#fafaf9]/70 transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://wa.me/27673403752"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#fafaf9]/30 hover:text-[#fafaf9]/70 transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
