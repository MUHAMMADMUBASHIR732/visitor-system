import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { KeyRound, LogOut, Menu, ScanLine, Search, Siren } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLive } from '@/lib/live';
import { isGateRole, ROLE_LABEL } from '@/lib/roles';
import type { RollCall } from '@/lib/types';
import { ChangePasswordModal } from './ChangePassword';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';
import { navFor, primaryNavFor, type NavItem } from './nav';
import { Sheet } from './overlays';
import { Avatar, Skeleton } from './ui';

function LiveDot() {
  const { connected, polling } = useLive();
  return (
    <span
      className={clsx('inline-flex items-center gap-2 text-sm', connected ? 'text-success' : 'text-soft')}
      title={connected ? (polling ? 'Updates refresh every few seconds' : 'Live updates are on') : 'Reconnecting to live updates'}
    >
      <span className={clsx('size-2 rounded-full', connected ? 'animate-pulse-dot bg-success' : 'bg-line-strong')} />
      <span className="text-soft">{connected ? (polling ? 'Auto' : 'Live') : 'Offline'}</span>
    </span>
  );
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={item.end} className="group relative flex h-11 items-center gap-3 rounded-full px-4 text-[15px] font-semibold text-soft transition-colors duration-200 hover:text-ink">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="side-pill"
              className="absolute inset-0 rounded-full bg-primary"
              transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            />
          )}
          <item.icon className={clsx('relative size-[19px] transition-transform duration-200 group-hover:scale-110', isActive && 'text-primary-ink')} />
          <span className={clsx('relative', isActive && 'text-primary-ink')}>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function groupItems(items: NavItem[]) {
  const groups: { name?: string; items: NavItem[] }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.name === it.group) last.items.push(it);
    else groups.push({ name: it.group, items: [it] });
  }
  return groups;
}

function RollCallBanner() {
  const { data } = useQuery({ queryKey: ['rollcall'], queryFn: () => api<RollCall | null>('/roll-call/active'), refetchInterval: 60_000 });
  const { user } = useAuth();
  const navigate = useNavigate();
  const canAct = user?.role === 'GUARD' || user?.role === 'ADMIN';
  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="no-print overflow-hidden bg-[#a33a2a] text-[#fff7f0]"
          role="alert"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[15px] font-semibold md:px-10">
            <Siren className="size-5 animate-pulse" aria-hidden />
            <span>Emergency roll call is running.</span>
            <span className="font-medium opacity-90">
              {data.safe} of {data.total} visitors marked safe.
            </span>
            {canAct && (
              <button onClick={() => navigate('/gate/roll-call')} className="ml-auto rounded-full bg-white/20 px-4 py-1 transition hover:bg-white/30">
                Open roll call
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [more, setMore] = useState(false);
  const [palette, setPalette] = useState(false);
  const [changePw, setChangePw] = useState(false);
  const navigate = useNavigate();

  useEffect(() => setMore(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;
  const items = navFor(user.role);
  const primary = primaryNavFor(user.role);
  const rest = items.filter((i) => !primary.includes(i));

  return (
    <div className="flex min-h-dvh">
      {/* Desktop rail */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-line bg-page px-4 py-6 md:flex">
        <Logo className="px-3" />
        {isGateRole(user.role) && (
          <button
            onClick={() => navigate('/gate?scan=1')}
            className="bg-grad group mt-7 flex h-12 items-center justify-center gap-2.5 rounded-full text-[15px] font-bold text-[#2D211B] shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-glow active:scale-[0.98]"
          >
            <ScanLine className="size-5 transition-transform duration-200 group-hover:scale-110" />
            Scan QR
          </button>
        )}
        <button
          onClick={() => setPalette(true)}
          className={clsx('flex h-11 items-center gap-3 rounded-full border border-line-strong bg-surface px-4 text-[15px] text-soft transition duration-200 hover:border-soft hover:text-ink hover:shadow-card', isGateRole(user.role) ? 'mt-3' : 'mt-7')}
        >
          <Search className="size-[18px]" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-md bg-sunken px-1.5 py-0.5 text-xs font-semibold">Ctrl K</kbd>
        </button>

        <nav className="mt-6 flex-1 space-y-5 overflow-y-auto" aria-label="Main">
          {groupItems(items).map((g, i) => (
            <div key={g.name ?? i} className="space-y-1">
              {g.name && <p className="px-4 pb-1 text-sm font-semibold text-soft/80">{g.name}</p>}
              {g.items.map((it) => (
                <SideLink key={it.to} item={it} />
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-4 rounded-2xl border border-line bg-surface p-3 shadow-card transition duration-300 hover:shadow-lift">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] leading-tight font-semibold">{user.name}</p>
              <p className="truncate text-sm text-soft">{ROLE_LABEL[user.role]}</p>
            </div>
            <LiveDot />
          </div>
          <div className="mt-3 flex items-center justify-around border-t border-line pt-2.5">
            {user.role !== 'GUARD' && <NotificationBell />}
            <ThemeToggle />
            <button onClick={() => setChangePw(true)} aria-label="Change password" title="Change password" className="flex size-10 items-center justify-center rounded-full text-soft transition duration-200 hover:bg-sunken hover:text-ink hover:shadow-card">
              <KeyRound className="size-5" />
            </button>
            <button onClick={logout} aria-label="Sign out" title="Sign out" className="flex size-10 items-center justify-center rounded-full text-soft transition hover:bg-danger-wash hover:text-danger">
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <RollCallBanner />

        {/* Phone top bar */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-page/85 px-4 py-3 backdrop-blur-md md:hidden">
          <Logo />
          <div className="flex items-center gap-0.5">
            <LiveDot />
            {isGateRole(user.role) && (
              <button onClick={() => navigate('/gate?scan=1')} aria-label="Scan QR code" className="bg-grad ml-1 flex size-10 items-center justify-center rounded-full text-[#2D211B] shadow-card transition active:scale-95">
                <ScanLine className="size-5" />
              </button>
            )}
            {user.role !== 'GUARD' && <NotificationBell />}
            <button onClick={() => setPalette(true)} aria-label="Search" className="flex size-10 items-center justify-center rounded-full text-soft hover:bg-sunken">
              <Search className="size-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-32 md:px-10 md:pt-10 md:pb-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Suspense
                fallback={
                  <div className="space-y-4" aria-busy>
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Phone tab bar */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label="Main">
          <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5 pb-1.5">
            {primary.map((it) => (
              <li key={it.to} className="flex-1">
                <NavLink to={it.to} end={it.end} className="flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-xs font-semibold">
                  {({ isActive }) => (
                    <>
                      <span className={clsx('flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200', isActive ? 'bg-accent text-accent-ink' : 'text-soft')}>
                        <it.icon className="size-[22px]" />
                      </span>
                      <span className={isActive ? 'text-ink' : 'text-soft'}>{it.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
            <li className="flex-1">
              <button onClick={() => setMore(true)} className="flex w-full flex-col items-center gap-0.5 rounded-2xl py-1.5 text-xs font-semibold text-soft">
                <span className="flex h-8 w-14 items-center justify-center rounded-full">
                  <Menu className="size-[22px]" />
                </span>
                More
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <Sheet open={more} onClose={() => setMore(false)} title="Menu">
        <div className="space-y-5 pt-2">
          {rest.length > 0 && (
            <ul className="space-y-1">
              {rest.map((it) => (
                <li key={it.to}>
                  <NavLink to={it.to} end={it.end} className={({ isActive }) => clsx('flex h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold', isActive ? 'bg-sunken text-ink' : 'text-soft')}>
                    <it.icon className="size-5" />
                    {it.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <Avatar name={user.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-sm text-soft">{user.email}</p>
            </div>
            <ThemeToggle />
          </div>
          <button onClick={() => { setMore(false); setChangePw(true); }} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sunken font-semibold transition hover:bg-line">
            <KeyRound className="size-5" />
            Change password
          </button>
          <button onClick={logout} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-danger-wash font-semibold text-danger">
            <LogOut className="size-5" />
            Sign out
          </button>
        </div>
      </Sheet>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <ChangePasswordModal open={changePw} onClose={() => setChangePw(false)} />
    </div>
  );
}
