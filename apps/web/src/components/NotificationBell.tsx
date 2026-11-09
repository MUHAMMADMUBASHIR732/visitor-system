import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Bell, DoorClosed, DoorOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useNotifications } from '@/lib/queries';
import { Sheet } from './overlays';
import { Button, EmptyState } from './ui';

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** Bell with an unread count. Arrivals and departures for you and your team land here. */
export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;

  const readAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={clsx('relative flex size-10 items-center justify-center rounded-full text-soft transition duration-200 hover:bg-sunken hover:text-ink hover:shadow-card', className)}
      >
        <Bell className={clsx('size-5', unread > 0 && 'origin-top animate-[swing_2.6s_ease-out_1]')} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute top-0.5 right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] leading-[18px] font-bold text-accent-ink">
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications" footer={unread > 0 ? <Button variant="soft" className="w-full" loading={readAll.isPending} onClick={() => readAll.mutate()}>Mark all as read</Button> : undefined}>
        {!data || data.items.length === 0 ? (
          <EmptyState icon={<Bell className="size-6" />} title="Nothing yet" body="When a visitor arrives or leaves, you and the people above you will be told here." />
        ) : (
          <ul className="-mx-1 space-y-1.5">
            {data.items.map((n, i) => {
              const arrived = n.kind === 'visit.arrived';
              return (
                <motion.li key={n.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className={clsx('flex gap-3 rounded-2xl p-3 transition duration-200 hover:bg-sunken hover:shadow-card', !n.readAt && 'bg-accent-wash/60')}>
                  <span className={clsx('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', arrived ? 'bg-success-wash text-success' : 'bg-sunken text-soft')}>
                    {arrived ? <DoorOpen className="size-[18px]" /> : <DoorClosed className="size-[18px]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {n.title}
                      {!n.readAt && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
                    </p>
                    <p className="mt-0.5 text-[15px] text-soft">{n.body}</p>
                    <p className="mt-1 text-sm text-soft/80">{ago(n.createdAt)}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </>
  );
}
