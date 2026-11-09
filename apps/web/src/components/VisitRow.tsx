import { clsx } from 'clsx';
import { ChevronRight, Clock, Footprints } from 'lucide-react';
import { useLive } from '@/lib/live';
import { fmtDate, fmtTime, minutesSince, fmtDuration } from '@/lib/format';
import { photoUrl } from '@/lib/api';
import type { Visit } from '@/lib/types';
import { Avatar, Pill, StatusBadge } from './ui';

interface Props {
  visit: Visit;
  onOpen: (v: Visit) => void;
  /** Show the host instead of the visitor's company (used on the guard and admin views). */
  showHost?: boolean;
  /** Show how long they have been inside. */
  showElapsed?: boolean;
  /** Narrow columns: drop the time, status and chevron so the name keeps its room. */
  compact?: boolean;
  trailing?: React.ReactNode;
}

export function VisitRow({ visit, onOpen, showHost, showElapsed, compact, trailing }: Props) {
  const { recent } = useLive();
  const flashing = recent.has(visit.id);
  const v = visit;
  const sub = compact
    ? `${fmtTime(v.expectedFrom)} \u00b7 to see ${v.host.name}`
    : [v.visitor.company, showHost ? `to see ${v.host.name}` : v.purpose].filter(Boolean).join(' \u00b7 ');
  const inside = v.status === 'CHECKED_IN' && v.checkInAt;
  const overdue = inside && new Date(v.expectedTo).getTime() + 30 * 60_000 < Date.now();

  return (
    <li className={clsx('border-b border-line last:border-b-0', flashing && 'row-flash')}>
      <div className="group flex items-center gap-1 pr-2 transition-colors duration-200 hover:bg-sunken/70">
        <button onClick={() => onOpen(v)} className="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3.5 text-left sm:px-5">
          <Avatar name={v.visitor.fullName} src={photoUrl(v.entryPhotoUrl)} size={44} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-base font-semibold">{v.visitor.fullName}</span>
              {v.isWalkIn && (
                <Pill tone="neutral" className="!px-2 !py-0 text-xs">
                  <Footprints className="size-3" aria-hidden />
                  Walk-in
                </Pill>
              )}
              {overdue && <Pill tone="danger" className="!px-2 !py-0 text-xs whitespace-nowrap">Past pass time</Pill>}
            </span>
            <span className="mt-0.5 block truncate text-sm text-soft">{sub}</span>
          </span>
          <span className={clsx('hidden shrink-0 text-right', compact ? 'xl:block' : 'sm:block')}>
            {showElapsed && inside ? (
              <span className="flex items-center justify-end gap-1.5 text-sm font-semibold text-success">
                <Clock className="size-4" aria-hidden />
                {fmtDuration(minutesSince(v.checkInAt!))}
              </span>
            ) : (
              <>
                <span className="block text-sm font-semibold">{fmtTime(v.checkInAt ?? v.expectedFrom)}</span>
                <span className="block text-xs text-soft">{fmtDate(v.checkInAt ?? v.expectedFrom)}</span>
              </>
            )}
          </span>
          {!compact && <StatusBadge status={v.status} className="shrink-0" />}
          {!compact && <ChevronRight className="hidden size-4 shrink-0 text-soft transition-transform duration-200 group-hover:translate-x-0.5 sm:block" aria-hidden />}
        </button>
        {trailing}
      </div>
    </li>
  );
}
