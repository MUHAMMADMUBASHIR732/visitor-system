import { clsx } from 'clsx';
import { CornerDownLeft, LogOut, Moon, Search, UserSearch } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { navFor } from './nav';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

/** Ctrl/Cmd + K: jump anywhere, search visits, switch theme, sign out. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { toggle } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      window.setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    if (!user) return [];
    const list: Command[] = navFor(user.role).map((n) => ({
      id: n.to,
      label: n.label,
      hint: n.group,
      icon: <n.icon className="size-[18px]" />,
      run: () => navigate(n.to),
    }));
    list.push(
      { id: 'theme', label: 'Switch theme', icon: <Moon className="size-[18px]" />, run: toggle },
      { id: 'out', label: 'Sign out', icon: <LogOut className="size-[18px]" />, run: logout },
    );
    const q = query.trim();
    const filtered = q ? list.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())) : list;
    if (q.length >= 2 && user.role !== 'GUARD') {
      const base = user.role === 'ADMIN' ? '/admin/visits' : user.role === 'SENIOR_MANAGER' || user.role === 'MANAGER' ? '/manage/visits' : '/host/visits';
      filtered.push({
        id: 'search',
        label: `Search visits for “${q}”`,
        icon: <UserSearch className="size-[18px]" />,
        run: () => navigate(`${base}?q=${encodeURIComponent(q)}`),
      });
    }
    return filtered;
  }, [user, query, navigate, toggle, logout]);

  const safeIndex = Math.min(index, Math.max(0, commands.length - 1));

  const pick = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => (i + 1) % Math.max(1, commands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => (i - 1 + commands.length) % Math.max(1, commands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(commands[safeIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12dvh]" role="dialog" aria-modal="true" aria-label="Search or jump to">
          <motion.div className="absolute inset-0 bg-[#1c1410]/55 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-[24px] border border-line bg-surface shadow-pop"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            onKeyDown={onKey}
          >
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search className="size-5 text-soft" />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                placeholder="Search pages or a visitor name"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-soft/70"
                aria-label="Search"
              />
            </div>
            <ul className="max-h-[50dvh] overflow-y-auto p-2" role="listbox">
              {commands.length === 0 && <li className="px-4 py-8 text-center text-[15px] text-soft">Nothing matches that. Try a page name.</li>}
              {commands.map((c, i) => (
                <li key={c.id} role="option" aria-selected={i === safeIndex}>
                  <button
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => pick(c)}
                    className={clsx('flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] font-medium transition-colors', i === safeIndex ? 'bg-sunken' : '')}
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-accent-wash text-accent-text">{c.icon}</span>
                    <span className="flex-1">{c.label}</span>
                    {c.hint && <span className="text-sm text-soft">{c.hint}</span>}
                    {i === safeIndex && <CornerDownLeft className="size-4 text-soft" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
