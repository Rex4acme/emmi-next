'use client';
// components/layout/AppShell.tsx — Main App Shell
// Provides: sidebar navigation (desktop), bottom nav (mobile),
// header bar, and wraps all authenticated pages.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import {
  Zap, LayoutDashboard, Cpu, AlertTriangle,
  ClipboardList, User, LogOut, Menu, X, Bell, Trophy
} from 'lucide-react';

// ── Nav items ─────────────────────────────────────────────────
// href: route path, icon: Lucide icon component, label: display name
const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/equipment',  icon: Cpu,             label: 'Equipment'  },
  { href: '/faults',     icon: AlertTriangle,   label: 'Faults'     },
  { href: '/activities', icon: ClipboardList,   label: 'Activities' },
  { href: '/kpi',        icon: Trophy,          label: 'KPI'        },
  { href: '/profile',    icon: User,            label: 'Profile'    },
];

interface Props {
  children: React.ReactNode;
  title?: string;        // Page title shown in header
  action?: React.ReactNode; // Optional button in header top-right
}

export default function AppShell({ children, title, action }: Props) {
  const pathname  = usePathname(); // current route — used to highlight active nav item
  const router    = useRouter();
  const supabase  = createBrowserClient();
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar toggle
  const [unreadAlerts, setUnreadAlerts] = useState(0);   // badge count for unresolved faults

  // ── Sign out ───────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  // ── Check for unresolved faults (for bell badge) ──────────
  useEffect(() => {
    async function checkAlerts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get count of faults that were logged before midnight and are still open
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0); // start of today

      const { count } = await supabase
        .from('faults')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['open', 'under_investigation', 'recurring'])
        .lt('detected_at', midnight.toISOString())
        .eq('reminder_sent', false);

      setUnreadAlerts(count || 0);
    }
    checkAlerts();
  }, [pathname]); // re-check whenever we navigate to a new page

  // ── Determine active route ────────────────────────────────
  // Highlight nav item if current path starts with its href
  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-dvh bg-surface overflow-hidden">

      {/* ── Sidebar (desktop) ───────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-56 flex-shrink-0"
        style={{ background: 'var(--base)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <Zap size={22} style={{ color: 'var(--amber)' }} strokeWidth={2.5}/>
          <span className="text-lg font-bold font-display" style={{ color: 'var(--amber)' }}>EMMI</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isActive(href) ? 'rgba(240,165,0,0.12)' : 'transparent',
                color:      isActive(href) ? 'var(--amber)'          : 'var(--text-2)',
                border:     isActive(href) ? '1px solid rgba(240,165,0,0.2)' : '1px solid transparent',
              }}
            >
              <Icon size={17} strokeWidth={isActive(href) ? 2.5 : 2}/>
              {label}
              {/* Bell badge on Faults nav item */}
              {href === '/faults' && unreadAlerts > 0 && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'var(--red)', color: '#fff' }}>
                  {unreadAlerts}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Sign out button */}
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ color: 'var(--text-2)' }}
          >
            <LogOut size={16}/>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile sidebar overlay ──────────────────────────── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative w-64 flex flex-col h-full z-10"
            style={{ background: 'var(--base)', borderRight: '1px solid var(--border)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Zap size={20} style={{ color: 'var(--amber)' }}/>
                <span className="font-bold font-display" style={{ color: 'var(--amber)' }}>EMMI</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-2)' }}>
                <X size={20}/>
              </button>
            </div>
            {/* Nav links */}
            <nav className="flex-1 py-4 px-3 space-y-1">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: isActive(href) ? 'rgba(240,165,0,0.12)' : 'transparent',
                    color:      isActive(href) ? 'var(--amber)'          : 'var(--text-2)',
                  }}
                >
                  <Icon size={18}/>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm"
                style={{ color: 'var(--text-2)' }}>
                <LogOut size={16}/> Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content area ───────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Top header bar */}
        <header className="flex items-center justify-between px-4 py-3 flex-shrink-0 md:px-8"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--base)' }}>

          {/* Hamburger menu (mobile only) */}
          <button
            className="md:hidden p-1.5 rounded-lg"
            onClick={() => setSidebarOpen(true)}
            style={{ color: 'var(--text-2)' }}
          >
            <Menu size={22}/>
          </button>

          {/* Page title */}
          <h1 className="text-base font-bold font-display" style={{ color: 'var(--text)' }}>
            {title || 'EMMI'}
          </h1>

          {/* Right side — action button or bell icon */}
          <div className="flex items-center gap-2">
            {unreadAlerts > 0 && (
              <Link href="/faults" className="relative p-1.5" style={{ color: 'var(--text-2)' }}>
                <Bell size={20}/>
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: 'var(--red)', color: '#fff', fontSize: '9px' }}>
                  {unreadAlerts}
                </span>
              </Link>
            )}
            {action}
          </div>
        </header>

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 pb-24 md:pb-6 page-enter max-w-4xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Bottom nav (mobile only) ────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex pb-safe"
        style={{ background: 'var(--base)', borderTop: '1px solid var(--border)' }}>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center py-2.5 gap-1 text-xs font-medium transition-all relative"
            style={{ color: isActive(href) ? 'var(--amber)' : 'var(--text-3)' }}
          >
            <Icon size={20} strokeWidth={isActive(href) ? 2.5 : 1.8}/>
            <span className="text-[10px]">{label}</span>
            {/* Fault alert dot */}
            {href === '/faults' && unreadAlerts > 0 && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full"
                style={{ background: 'var(--red)' }}/>
            )}
          </Link>
        ))}
      </nav>

      {/* ── Floating EMMI pulse indicator — visible on every page ── */}
      <div className="emmi-pulse-indicator" title="EMMI Active">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>

    </div>
  );
}
