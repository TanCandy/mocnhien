import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, User, Menu, X, Search, Send, Globe, Share2, Settings } from "lucide-react";
import { motion } from "motion/react";
import { api } from "../lib/api";
import { clearSession, getSessionUser } from "../lib/auth";
import { useUser } from "../context/UserContext";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useUser();
  const sessionUser = getSessionUser();
  const isAdmin = user?.role === "admin" || sessionUser?.role === "admin";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Tracking", path: "/tracking" },
    { name: "Dashboard", path: "/dashboard" },
    { name: "Profile", path: "/profile" },
    { name: "Support", path: "/support" },
  ];

  const adminLinks = [
    { name: "Manage Users", path: "/admin/dashboard" },
    { name: "Manage Orders", path: "/admin/orders" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl shadow-[0_20px_40px_rgba(93,74,65,0.06)]">
        <div className="flex justify-between items-center px-4 md:px-8 py-4 max-w-7xl mx-auto">
          <Link to="/" className="text-xl md:text-2xl font-headline font-bold text-primary">
            Mộc Nhiên Authentic
          </Link>

          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`font-medium transition-all duration-300 ${
                  location.pathname === link.path
                    ? "text-primary border-b-2 border-primary pb-1 font-bold"
                    : "text-stone-500 hover:text-primary"
                }`}
              >
                {link.name}
              </Link>
            ))}
            {isAdmin && (
              <>
                <span className="text-outline">|</span>
                {adminLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`font-medium transition-all duration-300 flex items-center gap-1 ${
                      location.pathname === link.path
                        ? "text-secondary border-b-2 border-secondary pb-1 font-bold"
                        : "text-stone-500 hover:text-secondary"
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    {link.name}
                  </Link>
                ))}
              </>
            )}
          </div>

          {/* Desktop Right Side Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button className="p-2 text-primary hover:bg-primary-container/10 rounded-full transition-all">
              <Bell className="w-5 h-5" />
            </button>
            {sessionUser ? (
              <>
                <Link to="/profile" className="p-2 text-primary hover:bg-primary-container/10 rounded-full transition-all">
                  <User className="w-5 h-5" />
                </Link>
                <button
                  onClick={async () => {
                    try {
                      await api.post("/api/auth/logout");
                    } catch {
                      // always clear local state
                    }
                    clearSession();
                    window.location.href = "/login";
                  }}
                  className="px-4 py-2 text-sm font-bold text-primary border border-primary rounded-full hover:bg-primary hover:text-on-primary transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="px-4 py-2 text-sm font-bold text-primary border border-primary rounded-full hover:bg-primary hover:text-on-primary transition-all">
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background border-t border-stone-200 shadow-lg">
            <div className="px-4 py-4 space-y-3 max-w-7xl mx-auto">
              {/* Mobile Nav Links */}
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 px-4 rounded-lg font-medium transition-all ${
                    location.pathname === link.path
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-stone-600 hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {/* Admin Links */}
              {isAdmin && (
                <div className="pt-3 border-t border-stone-200">
                  {adminLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 py-2 px-4 rounded-lg font-medium transition-all ${
                        location.pathname === link.path
                          ? "bg-secondary/10 text-secondary font-bold"
                          : "text-stone-600 hover:bg-secondary/5 hover:text-secondary"
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Mobile Auth Actions */}
              <div className="pt-3 border-t border-stone-200">
                {sessionUser ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 py-2 px-4 rounded-lg font-medium text-stone-600 hover:bg-primary/5 hover:text-primary"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <button
                      onClick={async () => {
                        try {
                          await api.post("/api/auth/logout");
                        } catch {
                          // always clear local state
                        }
                        clearSession();
                        window.location.href = "/login";
                      }}
                      className="w-full mt-2 px-4 py-2 text-sm font-bold text-primary border border-primary rounded-full hover:bg-primary hover:text-on-primary transition-all"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full text-center px-4 py-2 text-sm font-bold text-primary border border-primary rounded-full hover:bg-primary hover:text-on-primary transition-all"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-grow pt-20">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-stone-100 dark:bg-stone-950 w-full rounded-t-[20px] mt-20 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 md:px-8 lg:px-16 py-8 md:py-12 max-w-7xl mx-auto">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="font-headline text-xl md:text-2xl font-semibold text-primary">Mộc Nhiên Authentic</div>
            <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
              Connecting you with authentic products from around the world through dedicated logistics excellence.
            </p>
          </div>

          {/* Quick Links (Navigation + Contact) */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h6 className="font-headline text-lg text-primary">Navigation</h6>
              <Link to="/tracking" className="text-stone-600 dark:text-stone-400 text-sm hover:text-primary transition-colors">Track Order</Link>
              <Link to="#" className="text-stone-600 dark:text-stone-400 text-sm hover:text-primary transition-colors">Privacy Policy</Link>
              <Link to="#" className="text-stone-600 dark:text-stone-400 text-sm hover:text-primary transition-colors">Terms of Service</Link>
            </div>
            <div className="flex flex-col gap-3">
              <h6 className="font-headline text-lg text-primary">Contact</h6>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-outline mb-2">Hotline</p>
                <a href="tel:0392811031" className="block text-stone-600 dark:text-stone-400 text-sm hover:text-primary transition-colors">
                  0392 811 031
                </a>
                <a href="tel:0935196052" className="block text-stone-600 dark:text-stone-400 text-sm hover:text-primary transition-colors">
                  0935 196 052
                </a>
                <a href="tel:0918170661" className="block text-stone-600 dark:text-stone-400 text-sm hover:text-primary transition-colors">
                  0918 170 661
                </a>
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <div className="flex flex-col gap-4">
            <h6 className="font-headline text-lg text-primary">Stay Updated</h6>
            <div className="relative">
              <input
                className="w-full bg-white dark:bg-stone-900 border-none rounded-full px-4 md:px-6 py-2 md:py-3 text-sm focus:ring-2 focus:ring-primary/20"
                placeholder="Email address"
                type="email"
              />
              <button className="absolute right-2 top-2 bg-primary p-1.5 rounded-full text-white">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-stone-200 dark:border-stone-800 px-4 md:px-8 lg:px-16 py-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-stone-600 dark:text-stone-400 text-xs uppercase tracking-widest text-center md:text-left">
            © 2024 Mộc Nhiên Authentic. All rights reserved.
          </p>
          <div className="flex gap-6 opacity-80">
            <Globe className="w-5 h-5 cursor-pointer hover:text-primary transition-colors" />
            <Share2 className="w-5 h-5 cursor-pointer hover:text-primary transition-colors" />
          </div>
        </div>
      </footer>
    </div>
  );
}
