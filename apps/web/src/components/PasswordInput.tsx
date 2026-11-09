import { clsx } from 'clsx';
import { Check, Eye, EyeOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { FieldShell } from './ui';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  hint?: string;
  fieldClassName?: string;
  /** The current value, for the animated characters. Needed when the form sets the value in code. */
  value?: string;
  /** Show the live strength meter and checklist (use when choosing a new password). */
  meter?: boolean;
}

const rules = [
  { label: '8 or more characters', test: (v: string) => v.length >= 8 },
  { label: 'A letter', test: (v: string) => /[A-Za-z]/.test(v) },
  { label: 'A number', test: (v: string) => /\d/.test(v) },
];

export function passwordScore(v: string) {
  const base = rules.filter((r) => r.test(v)).length;
  const bonus = (v.length >= 12 ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) && /[A-Z]/.test(v) ? 1 : 0);
  return Math.min(5, base + bonus);
}
const LEVELS = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'];
const LEVEL_COLOR = ['bg-line', 'bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'];

/**
 * A password field that shows each character as it is typed (popping in as a dot, or as the letter
 * when revealed), with an eye button to re-check what was entered.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { label, error, hint, fieldClassName, className, id, value, meter, onChange, ...rest },
  ref,
) {
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState('');
  const text = value ?? typed;
  const fieldId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const score = passwordScore(text);

  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    setTyped(e.target.value);
    onChange?.(e);
  };

  return (
    <FieldShell label={label} error={error} hint={meter ? undefined : hint} className={fieldClassName} htmlFor={fieldId}>
      <div className="group relative">
        <input
          ref={ref}
          id={fieldId}
          type={shown ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          onChange={handle}
          spellCheck={false}
          autoCapitalize="off"
          className={clsx(
            'h-11 w-full rounded-control border border-line-strong bg-surface pr-12 pl-3.5 text-[15px] text-transparent caret-ink',
            'transition duration-150 selection:bg-accent/30 hover:border-soft focus:border-accent focus:ring-4 focus:ring-accent/20 focus:outline-none',
            'placeholder:text-soft/70 disabled:cursor-not-allowed disabled:opacity-70',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...rest}
        />
        {/* The visible characters. The real input above is transparent but still takes the typing. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-12 left-3.5 flex items-center overflow-hidden text-[15px] whitespace-pre text-ink">
          {Array.from(text).map((ch, i) => (
            <motion.span
              key={`${i}-${shown ? ch : '•'}`}
              initial={{ scale: 0.3, y: shown ? 10 : 0, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 420, delay: shown ? Math.min(i * 0.025, 0.4) : 0 }}
              className={clsx('inline-block', shown ? '' : 'text-accent-text')}
            >
              {shown ? ch : '•'}
            </motion.span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-soft transition duration-200 hover:bg-sunken hover:text-ink"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={shown ? 'off' : 'on'} initial={{ rotate: -50, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 50, opacity: 0, scale: 0.6 }} transition={{ duration: 0.15 }}>
              {shown ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      {meter && (
        <div className="mt-1 space-y-2" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <motion.span key={n} className={clsx('h-1.5 flex-1 rounded-full', score >= n ? LEVEL_COLOR[score] : 'bg-line')} animate={{ scaleY: score >= n ? 1 : 0.7 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} />
              ))}
            </div>
            <span className="w-12 text-right text-sm font-medium text-soft">{text ? LEVELS[score] : ''}</span>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {rules.map((r) => {
              const pass = r.test(text);
              return (
                <li key={r.label} className={clsx('flex items-center gap-1.5 text-sm transition-colors duration-200', pass ? 'text-success' : 'text-soft')}>
                  <motion.span animate={{ scale: pass ? [1, 1.35, 1] : 1 }} transition={{ duration: 0.3 }} className={clsx('flex size-4 items-center justify-center rounded-full border', pass ? 'border-success bg-success text-page' : 'border-line-strong')}>
                    {pass && <Check className="size-3" strokeWidth={3.5} />}
                  </motion.span>
                  {r.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </FieldShell>
  );
});
