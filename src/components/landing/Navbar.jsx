import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Services', href: '#services' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0a0a05]/80 backdrop-blur-2xl border-b border-white/8 shadow-[0_1px_0_rgba(255,255,255,0.05)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-18 py-4">
          {/* Wordmark */}
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#fcfc03] flex items-center justify-center">
              <span className="text-[#0a0a05] text-xs font-black tracking-tight">IK</span>
            </div>
            <span className="text-[#fafaf9] font-semibold text-base tracking-tight group-hover:text-[#fcfc03] transition-colors duration-300">
              Ikamva
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[#fafaf9]/55 hover:text-[#fafaf9] transition-colors duration-200 tracking-wide"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 text-sm text-[#fafaf9]/60 hover:text-[#fafaf9] transition-colors duration-200"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </Link>
            )}
            {!isAuthenticated && (
              <Link
                to="/signin"
                className="text-sm text-[#fafaf9]/60 hover:text-[#fafaf9] transition-colors duration-200"
              >
                Sign in
              </Link>
            )}
            {!isAuthenticated && (
              <Link
                to="/signup"
                className="text-sm font-semibold px-4 py-2 rounded-full bg-[#fcfc03] text-[#0a0a05] hover:bg-[#fcfc03]/90 transition-all duration-200 shadow-[0_0_20px_rgba(252,252,3,0.2)]"
              >
                Get started
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-[#fafaf9]/60 hover:text-[#fafaf9] transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden bg-[#0a0a05]/95 backdrop-blur-2xl border-b border-white/10"
          >
            <div className="px-6 py-6 flex flex-col gap-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[#fafaf9]/70 hover:text-[#fafaf9] transition-colors py-1"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                {!isAuthenticated && (
                  <Link
                    to="/signin"
                    className="text-sm text-center py-2.5 rounded-xl border border-white/15 text-[#fafaf9]/70 hover:text-[#fafaf9] transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign in
                  </Link>
                )}
                {!isAuthenticated && (
                  <Link
                    to="/signup"
                    className="text-sm font-semibold text-center py-2.5 rounded-xl bg-[#fcfc03] text-[#0a0a05] hover:bg-[#fcfc03]/90 transition-all"
                    onClick={() => setMobileOpen(false)}
                  >
                    Get started
                  </Link>
                )}
                {isAuthenticated && (
                  <Link
                    to="/dashboard"
                    className="text-sm font-semibold text-center py-2.5 rounded-xl bg-[#fcfc03] text-[#0a0a05]"
                    onClick={() => setMobileOpen(false)}
                  >
                    Go to Dashboard
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
