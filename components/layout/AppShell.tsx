'use client';
// components/layout/AppShell.tsx — Main App Shell
// Built from the live version — adds Feed, Tasks, Health, Schedule,
// Permits, Inventory, QR Scan to nav. Presence tracking included.

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import {
  Zap, LayoutDashboard, Cpu, AlertTriangle,
  ClipboardList, User, LogOut, Menu, X, Bell, Trophy,
  Rss, CheckSquare, Heart, ShieldCheck, CalendarDays,
  QrCode, Package,
} from 'lucide-react';

// ── Sidebar nav — all pages ────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/feed',       icon: Rss,             label: 'Feed'       },
  { href: '/equipment',  icon: Cpu,             label: 'Equipment'  },
  { href: '/faults',     icon: AlertTriangle,   label: 'Faults'     },
  { href: '/activities', icon: ClipboardList,   label: 'Activities' },
  { href: '/schedule',   icon: CalendarDays,    label: 'Schedule'   },
  { href: '/permit',     icon: ShieldCheck,     label: 'Permits'    },
  { href: '/tasks',      icon: CheckSquare,     label: 'Tasks'      },
  { href: '/inventory',  icon: Package,         label: 'Inventory'  },
  { href: '/health',     icon: Heart,           label: 'Health'     },
  { href: '/kpi',        icon: Trophy,          label: 'KPI'        },
  { href: '/qr',         icon: QrCode,          label: 'QR Scan'    },
  { href: '/profile',    icon: User,            label: 'Profile'    },
];

// ── Bottom nav — mobile only, max 5 most-used ─────────────────
const BOTTOM_NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Home'    },
  { href: '/feed',       icon: Rss,             label: 'Feed'    },
  { href: '/faults',     icon: AlertTriangle,   label: 'Faults'  },
  { href: '/tasks',      icon: CheckSquare,     label: 'Tasks'   },
  { href: '/profile',    icon: User,            label: 'Profile' },
];

// ── Online presence ────────────────────────────────────────────
interface OnlineUser { userId: string; name: string; avatar?: string; }

interface Props {
  children:           React.ReactNode;
  title?:             string;
  action?:            React.ReactNode;
  notificationCount?: number;
}

export default function AppShell({ children, title, action, notificationCount = 0 }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [openTasks,    setOpenTasks]    = useState(0);
  const [onlineUsers,  setOnlineUsers]  = useState<OnlineUser[]>([]);
  const presenceRef    = useRef<any>(null);
  const currentUidRef  = useRef('');

  async function handleSignOut() {
    if (presenceRef.current) {
      await presenceRef.current.untrack();
      supabase.removeChannel(presenceRef.current);
    }
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  // ── Fault alerts + task badge ──────────────────────────────
  useEffect(() => {
    async function checkAlerts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const midnight = new Date(); midnight.setHours(0,0,0,0);
      const { count: fc } = await supabase.from('faults')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['open','under_investigation','recurring'])
        .lt('detected_at', midnight.toISOString())
        .eq('reminder_sent', false);
      setUnreadAlerts(fc || 0);

      const { count: tc } = await supabase.from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .in('status', ['open','in_progress']);
      setOpenTasks(tc || 0);
    }
    checkAlerts();
  }, [pathname]);

  // ── Presence — unified channel plant:{orgId} ──────────────
  useEffect(() => {
    async function setup() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      currentUidRef.current = user.id;
      const { data: profile } = await supabase
        .from('profiles').select('full_name,avatar_url,org_id').eq('id', user.id).single();
      if (!profile?.org_id) return;

      const ch = supabase.channel(`plant:${profile.org_id}`, {
        config: { presence: { key: user.id } },
      });
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{ name: string; avatar?: string }>();
        setOnlineUsers(Object.entries(state).map(([uid, arr]) => ({
          userId: uid, name: (arr as any[])[0]?.name || 'Engineer', avatar: (arr as any[])[0]?.avatar,
        })));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(p => p.filter(u => u.userId !== key));
      })
      .subscribe(async s => {
        if (s === 'SUBSCRIBED') await ch.track({
          name: profile.full_name || 'Engineer', avatar: profile.avatar_url || null,
        });
      });
      presenceRef.current = ch;
    }
    setup();
    return () => {
      if (presenceRef.current) { presenceRef.current.untrack(); supabase.removeChannel(presenceRef.current); }
    };
  }, []);

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  const bellCount = unreadAlerts + notificationCount;
  const othersOnline = onlineUsers.filter(u => u.userId !== currentUidRef.current);

  return (
    <div className="flex h-dvh bg-surface overflow-hidden">

      {/* ── Sidebar (desktop) ─────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0"
        style={{ background: 'var(--base)', borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <Zap size={22} style={{ color: 'var(--amber)' }} strokeWidth={2.5}/>
          <span className="text-lg font-bold font-display" style={{ color: 'var(--amber)' }}>EMMI</span>
        </div>

        {/* Online presence strip */}
        {onlineUsers.length > 0 && (
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }}/>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em' }}>
                {onlineUsers.length} ONLINE
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {onlineUsers.slice(0, 5).map(u => (
                <div key={u.userId} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: u.userId === currentUidRef.current ? 'var(--amber)' : 'var(--green)' }}/>
                  <span style={{ fontSize: 11, color: u.userId === currentUidRef.current ? 'var(--amber)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.userId === currentUidRef.current ? 'You' : u.name}
                  </span>
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>+{onlineUsers.length - 5} more</span>
              )}
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isActive(href) ? 'rgba(240,165,0,0.12)' : 'transparent',
                color:      isActive(href) ? 'var(--amber)'          : 'var(--text-2)',
                border:     isActive(href) ? '1px solid rgba(240,165,0,0.2)' : '1px solid transparent',
              }}>
              <Icon size={17} strokeWidth={isActive(href) ? 2.5 : 2}/>
              {label}
              {href === '/faults' && unreadAlerts > 0 && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'var(--red)', color: '#fff' }}>{unreadAlerts}</span>
              )}
              {href === '/tasks' && openTasks > 0 && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'var(--blue)', color: '#fff' }}>{openTasks}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ color: 'var(--text-2)' }}>
            <LogOut size={16}/> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile sidebar overlay ──────────────────────────── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)}/>
          <aside className="relative w-64 flex flex-col h-full z-10"
            style={{ background: 'var(--base)', borderRight: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Zap size={20} style={{ color: 'var(--amber)' }}/>
                <span className="font-bold font-display" style={{ color: 'var(--amber)' }}>EMMI</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-2)' }}><X size={20}/></button>
            </div>

            {/* Online strip in drawer */}
            {onlineUsers.length > 0 && (
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }}/>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em' }}>
                    {onlineUsers.length} ONLINE
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {onlineUsers.slice(0, 5).map(u => (
                    <div key={u.userId} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: u.userId === currentUidRef.current ? 'var(--amber)' : 'var(--green)', flexShrink: 0 }}/>
                      <span style={{ fontSize: 12, color: u.userId === currentUidRef.current ? 'var(--amber)' : 'var(--text-2)' }}>
                        {u.userId === currentUidRef.current ? 'You' : u.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: isActive(href) ? 'rgba(240,165,0,0.12)' : 'transparent',
                    color:      isActive(href) ? 'var(--amber)'          : 'var(--text-2)',
                  }}>
                  <Icon size={18}/> {label}
                  {href === '/tasks' && openTasks > 0 && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: 'var(--blue)', color: '#fff' }}>{openTasks}</span>
                  )}
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

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 flex-shrink-0 md:px-8"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--base)' }}>

          <button className="md:hidden p-1.5 rounded-lg" onClick={() => setSidebarOpen(true)}
            style={{ color: 'var(--text-2)' }}>
            <Menu size={22}/>
          </button>

          <h1 className="text-base font-bold font-display" style={{ color: 'var(--text)' }}>
            {title || 'EMMI'}
          </h1>

          <div className="flex items-center gap-2">
            {/* Online pill on mobile */}
            {othersOnline.length > 0 && (
              <div className="md:hidden flex items-center gap-1 px-2 py-1 rounded-full"
                style={{ background: 'rgba(52,208,88,0.1)', border: '1px solid rgba(52,208,88,0.2)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }}/>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)' }}>{othersOnline.length}</span>
              </div>
            )}
            {/* Bell */}
            {bellCount > 0 && (
              <Link href="/faults" className="relative p-1.5" style={{ color: 'var(--text-2)' }}>
                <Bell size={20}/>
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: 'var(--red)', color: '#fff', fontSize: '9px' }}>
                  {bellCount > 9 ? '9+' : bellCount}
                </span>
              </Link>
            )}
            {action}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 pb-24 md:pb-6 page-enter max-w-4xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Bottom nav (mobile) — 5 key items ───────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex pb-safe"
        style={{ background: 'var(--base)', borderTop: '1px solid var(--border)' }}>
        {BOTTOM_NAV.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className="flex-1 flex flex-col items-center py-2.5 gap-1 text-xs font-medium transition-all relative"
            style={{ color: isActive(href) ? 'var(--amber)' : 'var(--text-3)' }}>
            <Icon size={20} strokeWidth={isActive(href) ? 2.5 : 1.8}/>
            <span className="text-[10px]">{label}</span>
            {href === '/faults' && unreadAlerts > 0 && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full" style={{ background: 'var(--red)' }}/>
            )}
            {href === '/tasks' && openTasks > 0 && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full" style={{ background: 'var(--blue)' }}/>
            )}
            {href === '/feed' && notificationCount > 0 && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full" style={{ background: 'var(--amber)' }}/>
            )}
          </Link>
        ))}
      </nav>

      {/* EMMI pulse indicator */}
      <div className="emmi-pulse-indicator" title="EMMI Active">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>

    </div>
  );
}