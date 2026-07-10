import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/landing/Logo';

const footerLinks = {
  Services: [
  { label: 'Schedule Management', href: '/services' },
  { label: 'Email Management', href: '/services' },
  { label: 'Document Preparation', href: '/services' },
  { label: 'Communication Hub', href: '/services' }],

  Company: [
  { label: 'About Us', href: '/' },
  { label: 'How It Works', href: '/' },
  { label: 'Pricing', href: '/' },
  { label: 'Contact', href: '/contact' }],

  Clients: [
  { label: 'Client Portal', href: '/dashboard' },
  { label: 'Get Started', href: '/onboarding' },
  { label: 'Refer a Friend', href: '/dashboard/referrals' },
  { label: 'Submit Inquiry', href: '/contact' }],

  Legal: [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
  { label: 'Refund Policy', href: '#' }]

};

export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center mb-4">
              <Logo height={32} />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Professional virtual assistance for modern businesses across South Africa.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) =>
          <div key={category}>
              <h4 className="text-sm font-semibold mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) =>
              <li key={link.label}>
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
              )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-16 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© 2026 Ikamva Business Solutions. All rights reserved.

          </p>
          <div className="flex items-center gap-6">
            <a href="https://www.linkedin.com/company/fullscope-business-solutions" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">LinkedIn</a>
            <a href="https://www.instagram.com/fullscope_va" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Instagram</a>
            <a href="https://wa.me/27673403752" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">WhatsApp</a>
          </div>
        </div>
      </div>
    </footer>);

}