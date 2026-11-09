import { clsx } from 'clsx';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={clsx('size-9', className)} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#2D211B" />
      <rect x="18" y="11" width="28" height="42" rx="8" fill="#F8F1E8" />
      <rect x="26" y="16" width="12" height="4" rx="2" fill="#2D211B" />
      <circle cx="32" cy="32" r="6.5" fill="#B9784D" />
      <rect x="23" y="43" width="18" height="3.4" rx="1.7" fill="#7B5A48" />
    </svg>
  );
}

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showName && <span className="font-display text-[22px] font-bold tracking-tight">Foyer</span>}
    </span>
  );
}
