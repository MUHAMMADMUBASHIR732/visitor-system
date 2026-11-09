import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { CountUp } from './CountUp';
import { Skeleton } from './ui';

interface Props {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  tone?: 'default' | 'accent' | 'warning';
  onClick?: () => void;
  note?: string;
}

export function StatTile({ label, value, icon: Icon, tone = 'default', onClick, note }: Props) {
  const Tag = onClick ? 'button' : 'div';
  const toneClass = {
    default: 'bg-surface',
    accent: 'bg-primary text-primary-ink',
    warning: 'bg-warning-wash',
  }[tone];
  return (
    <Tag
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-card border border-line p-5 text-left shadow-card transition duration-300',
        toneClass,
        'hover:-translate-y-0.5 hover:shadow-glow',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={clsx('text-[15px] font-medium', tone === 'accent' ? 'text-primary-ink/75' : 'text-soft')}>{label}</p>
        <span
          className={clsx(
            'flex size-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6',
            tone === 'accent' ? 'bg-white/15 text-primary-ink' : 'bg-accent-wash text-accent-text',
          )}
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
      {value === undefined ? (
        <Skeleton className="mt-4 h-11 w-16" />
      ) : (
        <p className="mt-3 font-display text-5xl leading-none font-bold tabular-nums">
          <CountUp value={value} />
        </p>
      )}
      {note && <p className={clsx('mt-2 text-sm', tone === 'accent' ? 'text-primary-ink/70' : 'text-soft')}>{note}</p>}
    </Tag>
  );
}
