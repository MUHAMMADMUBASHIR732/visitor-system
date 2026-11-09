import { clsx } from 'clsx';
import { useEffect, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  delay?: number;
  className?: string;
  /** Show the blinking caret while typing (and briefly after). */
  caret?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'span' | 'p';
}

/**
 * Types a heading out one character at a time. The full text is always laid out (the unseen part is
 * transparent), so the page never jumps, and screen readers get the whole sentence at once.
 */
export function Typewriter({ text, speed = 38, delay = 0, className, caret = true, as: Tag = 'span' }: Props) {
  const [n, setN] = useState(() => (reduced() ? text.length : 0));

  useEffect(() => {
    if (reduced()) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setN(i);
      if (i < text.length) timer = setTimeout(tick, speed + (/[ ,.]/.test(text[i - 1]) ? 50 : 0));
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [text, speed, delay]);

  const typing = n < text.length;
  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden>
        {text.slice(0, n)}
        <span className="opacity-0">{text.slice(n)}</span>
        {caret && (
          <span className="relative inline-block h-[1em] w-0 align-baseline">
            <span className={clsx('caret-blink absolute top-[0.08em] left-[0.04em] h-[0.82em] w-[0.07em] min-w-[2px] rounded-full bg-accent transition-opacity duration-700', typing ? 'opacity-100' : 'opacity-0 delay-[1400ms]')} />
          </span>
        )}
      </span>
    </Tag>
  );
}
