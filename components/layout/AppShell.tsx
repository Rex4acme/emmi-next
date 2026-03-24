'use client';
// components/layout/AppShell.tsx
// Online presence: tracks who is currently online using Supabase Realtime.
// Bell badge in header shows count of pending colleague notifications.

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import {
  Zap, LayoutDashboard, Cpu, AlertTriangle,
  ClipboardList, User, LogOut, Menu, X, Bell, Trophy,
  Rss, CheckSquare, Heart, Circle, ShieldCheck, CalendarDays, QrCode, Package,
} from 'lucide-react';

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

const BOTTOM_NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Home'    },
  { href: '/feed',       icon: Rss,             label: 'Feed'    },
  { href: '/faults',     icon: AlertTriangle,   label: 'Faults'  },
  { href: '/tasks',      icon: CheckSquare,     label: 'Tasks'   },
  { href: '/profile',    icon: User,            label: 'Profile' },
];

interface OnlineUser {
  userId:   string;
  name:     string;
  avatar?:  string;
}

interface Props {
  children:           React.ReactNode;
  title?:             string;
  action?:            React.ReactNode;
  notificationCount?: number; // badge count passed from dashboard
}

export default function AppShell({ children, title, action, notificationCount = 0 }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createBrowserClient();

  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [unreadAlerts,   setUnreadAlerts]   = useState(0);
  const [openTasks,      setOpenTasks]      = useState(0);
  const [onlineUsers,    setOnlineUsers]    = useState<OnlineUser[]>([]);
  const [showOnline,     setShowOnline]     = useState(false);
  const presenceChannel  = useRef<any>(null);
  const currentUserId    = useRef<string>('');

  async function handleSignOut() {
    // Leave presence channel before signing out
    if (presenceChannel.current) {
      await presenceChannel.current.untrack();
      supabase.removeChannel(presenceChannel.current);
    }
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  // ── Unread fault alerts + task badge ──────────────────────
  useEffect(() => {
    async function checkAlerts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);

      const { count: faultCount } = await supabase
        .from('faults')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['open', 'under_investigation', 'recurring'])
        .lt('detected_at', midnight.toISOString())
        .eq('reminder_sent', false);

      setUnreadAlerts(faultCount || 0);

      const { count: taskCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .in('status', ['open', 'in_progress']);

      setOpenTasks(taskCount || 0);
    }
    checkAlerts();
  }, [pathname]);

  // ── Supabase Realtime Presence — who is online ───────────
  // This tracks every engineer currently using the app in real time.
  useEffect(() => {
    async function setupPresence() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      currentUserId.current = user.id;

      // Get this user's profile for their display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, org_id')
        .eq('id', user.id)
        .single();

      // Only track presence if in an org
      if (!profile?.org_id) return;

      const channel = supabase.channel(`plant:${profile.org_id}`, {
        config: { presence: { key: user.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<{ name: string; avatar?: string }>();
          const users: OnlineUser[] = Object.entries(state).map(([uid, presences]) => ({
            userId: uid,
            name:   (presences as any[])[0]?.name   || 'Engineer',
            avatar: (presences as any[])[0]?.avatar  || undefined,
          }));
          setOnlineUsers(users);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          // Handled by sync
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setOnlineUsers(prev => prev.filter(u => u.userId !== key));
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              name:   profile?.full_name || 'Engineer',
              avatar: profile?.avatar_url || null,
            });
          }
        });

      presenceChannel.current = channel;
    }

    setupPresence();

    return () => {
      if (presenceChannel.current) {
        presenceChannel.current.untrack();
        supabase.removeChannel(presenceChannel.current);
      }
    };
  }, []); // only once on mount

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  // Total bell badge = unread fault alerts + incoming notifications from dashboard
  const bellCount = unreadAlerts + notificationCount;

  // Online users excluding self
  const othersOnline = onlineUsers.filter(u => u.userId !== currentUserId.current);

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
              <span className="text-xs font-bold" style={{ color: 'var(--green)', fontSize: 9, letterSpacing: '0.06em' }}>
                {onlineUsers.length} ONLINE
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {onlineUsers.slice(0, 5).map(u => (
                <div key={u.userId} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--green)' }}/>
                  <span className="text-xs truncate" style={{
                    color: u.userId === currentUserId.current ? 'var(--amber)' : 'var(--text-2)',
                    fontSize: 11,
                  }}>
                    {u.userId === currentUserId.current ? 'You' : u.name}
                  </span>
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <span className="text-xs" style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  +{onlineUsers.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Nav */}
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
                  style={{ background: 'var(--red)', color: '#fff' }}>
                  {unreadAlerts}
                </span>
              )}
              {href === '/tasks' && openTasks > 0 && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'var(--blue)', color: '#fff' }}>
                  {openTasks}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
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
              <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-2)' }}>
                <X size={20}/>
              </button>
            </div>

            {/* Online strip in mobile drawer */}
            {onlineUsers.length > 0 && (
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }}/>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em' }}>
                    {onlineUsers.length} ONLINE NOW
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {onlineUsers.slice(0, 6).map(u => (
                    <div key={u.userId} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)', flexShrink: 0 }}/>
                      <span style={{
                        fontSize: 12, color: u.userId === currentUserId.current ? 'var(--amber)' : 'var(--text-2)',
                      }}>
                        {u.userId === currentUserId.current ? 'You' : u.name}
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
                      style={{ background: 'var(--blue)', color: '#fff' }}>
                      {openTasks}
                    </span>
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

            {/* Online presence pill — mobile header */}
            {othersOnline.length > 0 && (
              <button
                onClick={() => setShowOnline(v => !v)}
                className="md:hidden flex items-center gap-1.5 px-2 py-1 rounded-full"
                style={{ background: 'rgba(52,208,88,0.1)', border: '1px solid rgba(52,208,88,0.2)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }}/>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)' }}>
                  {othersOnline.length}
                </span>
              </button>
            )}

            {/* Bell — shows fault alerts + incoming toasts */}
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

        {/* Mobile online dropdown */}
        {showOnline && othersOnline.length > 0 && (
          <div className="md:hidden absolute top-14 right-4 z-40 rounded-xl shadow-xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', minWidth: 180, padding: '12px 14px' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.06em', marginBottom: 8 }}>
              ONLINE NOW
            </p>
            {othersOnline.map(u => (
              <div key={u.userId} className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: 'var(--green)' }}/>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{u.name}</span>
              </div>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 pb-24 md:pb-6 page-enter max-w-4xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Bottom nav (mobile) ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex pb-safe"
        style={{ background: 'var(--base)', borderTop: '1px solid var(--border)' }}>
        {BOTTOM_NAV.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className="flex-1 flex flex-col items-center py-2.5 gap-1 text-xs font-medium transition-all relative"
            style={{ color: isActive(href) ? 'var(--amber)' : 'var(--text-3)' }}>
            <Icon size={20} strokeWidth={isActive(href) ? 2.5 : 1.8}/>
            <span className="text-[10px]">{label}</span>
            {href === '/faults' && unreadAlerts > 0 && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full"
                style={{ background: 'var(--red)' }}/>
            )}
            {href === '/tasks' && openTasks > 0 && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full"
                style={{ background: 'var(--blue)' }}/>
            )}
            {href === '/feed' && notificationCount > 0 && (
              <span className="absolute top-1.5 right-1/4 w-2 h-2 rounded-full"
                style={{ background: 'var(--amber)' }}/>
            )}
          </Link>
        ))}
      </nav>

      <div className="emmi-pulse-indicator" title="EMMI Active">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>

    </div>
  );
}