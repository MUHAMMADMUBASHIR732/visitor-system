import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { STATUS_LABEL, initials } from '@/lib/format';
import { Typewriter } from './Typewriter';
import type { VisitStatus } from '@/lib/types';

/* ---------- Buttons ---------- */

type Variant = 'primary' | 'accent' | 'soft' | 'ghost' | 'danger' | 'alert';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary-hover shadow-sm hover:shadow-md',
  accent: 'bg-accent text-accent-ink hover:brightness-110 shadow-sm hover:shadow-md',
  soft: 'bg-sunken text-ink hover:bg-line',
  ghost: 'text-ink hover:bg-sunken',
  danger: 'bg-danger-wash text-danger hover:brightness-95',
  alert: 'bg-[#a33a2a] text-[#fff7f0] hover:brightness-110 shadow-sm hover:shadow-md',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-14 px-7 text-base gap-2.5',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra?: string) =>
  clsx(
    'inline-flex select-none items-center justify-center rounded-full font-semibold whitespace-nowrap',
    'transition duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    extra,
  );

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, icon, children, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({
  variant,
  size,
  className,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

/* ---------- Form fields ---------- */

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function FieldShell({ label, error, hint, className, children, htmlFor }: FieldShellProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-soft">{hint}</p>
      ) : null}
    </div>
  );
}

const control = clsx(
  'w-full rounded-control border border-line-strong bg-surface px-3.5 text-[15px] text-ink',
  'placeholder:text-soft/70 transition duration-150',
  'hover:border-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20',
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-70',
);

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  fieldClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input(
  { label, error, hint, fieldClassName, className, id, ...rest },
  ref,
) {
  const fieldId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <FieldShell label={label} error={error} hint={hint} className={fieldClassName} htmlFor={fieldId}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        className={clsx(control, 'h-11', error && 'border-danger focus:border-danger focus:ring-danger/20', className)}
        {...rest}
      />
    </FieldShell>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select(
  { label, error, hint, fieldClassName, className, id, children, ...rest },
  ref,
) {
  const fieldId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <FieldShell label={label} error={error} hint={hint} className={fieldClassName} htmlFor={fieldId}>
      <select ref={ref} id={fieldId} aria-invalid={Boolean(error)} className={clsx(control, 'h-11 appearance-none bg-[length:16px] pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237B5A48' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function Textarea(
  { label, error, hint, fieldClassName, className, id, ...rest },
  ref,
) {
  const fieldId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <FieldShell label={label} error={error} hint={hint} className={fieldClassName} htmlFor={fieldId}>
      <textarea ref={ref} id={fieldId} aria-invalid={Boolean(error)} className={clsx(control, 'min-h-24 py-3', className)} {...rest} />
    </FieldShell>
  );
});

/* ---------- Surfaces ---------- */

export function Card({
  className,
  interactive,
  children,
  ...rest
}: { interactive?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-card border border-line bg-surface shadow-card transition-[box-shadow,transform,border-color] duration-300 ease-out hover:shadow-lift',
        interactive && 'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-center justify-between gap-3', className)}>
      <h2 className="text-xl font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold md:text-4xl">{typeof title === 'string' ? <Typewriter text={title} speed={26} /> : title}</h1>
        {subtitle && <p className="mt-1.5 max-w-prose text-[15px] text-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ---------- Status ---------- */

const statusStyle: Record<VisitStatus, { box: string; dot: string; pulse?: boolean }> = {
  SCHEDULED: { box: 'bg-accent-wash text-accent-text', dot: 'bg-accent' },
  PENDING_APPROVAL: { box: 'bg-warning-wash text-warning', dot: 'bg-warning', pulse: true },
  APPROVED: { box: 'bg-success-wash text-success', dot: 'bg-success' },
  CHECKED_IN: { box: 'bg-success-wash text-success', dot: 'bg-success', pulse: true },
  CHECKED_OUT: { box: 'bg-sunken text-soft', dot: 'bg-soft' },
  CANCELLED: { box: 'bg-sunken text-soft line-through decoration-soft/50', dot: 'bg-soft' },
  REJECTED: { box: 'bg-danger-wash text-danger', dot: 'bg-danger' },
  NO_SHOW: { box: 'bg-warning-wash text-warning', dot: 'bg-warning' },
};

export function StatusBadge({ status, className }: { status: VisitStatus; className?: string }) {
  const s = statusStyle[status];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold', s.box, className)}>
      <span className={clsx('size-1.5 rounded-full', s.dot, s.pulse && 'animate-pulse-dot text-current')} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'success'; className?: string }) {
  const tones = {
    neutral: 'bg-sunken text-soft',
    accent: 'bg-accent-wash text-accent-text',
    warning: 'bg-warning-wash text-warning',
    danger: 'bg-danger-wash text-danger',
    success: 'bg-success-wash text-success',
  };
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold', tones[tone], className)}>{children}</span>;
}

/* ---------- Avatar ---------- */

const avatarTones = ['bg-accent-wash text-accent-text', 'bg-sunken text-ink', 'bg-success-wash text-success', 'bg-warning-wash text-warning'];

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const tone = avatarTones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarTones.length];
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold', !src && tone, className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

/* ---------- Feedback ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-sunken text-soft">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[15px] text-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-control border border-danger/30 bg-danger-wash px-4 py-3 text-sm font-medium text-danger">
      {message}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-sunken p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition duration-200',
              active ? 'bg-surface text-ink shadow-sm' : 'text-soft hover:text-ink',
            )}
          >
            {o.label}
            {o.count !== undefined && o.count > 0 && (
              <span className={clsx('rounded-full px-1.5 text-xs', active ? 'bg-accent text-accent-ink' : 'bg-line text-soft')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
