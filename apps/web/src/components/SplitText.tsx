import { motion, useReducedMotion } from 'motion/react';
import { clsx } from 'clsx';

interface Props {
  text: string;
  className?: string;
  /** Split into whole words (default) or single letters. */
  by?: 'word' | 'char';
  delay?: number;
  stagger?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

/** Reveals text piece by piece, each piece sliding up out of a mask when it scrolls into view. */
export function SplitText({ text, className, by = 'word', delay = 0, stagger, as = 'span' }: Props) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const pieces = by === 'word' ? text.split(' ') : Array.from(text);
  const step = stagger ?? (by === 'word' ? 0.06 : 0.025);

  if (reduce) return <Tag className={className}>{text}</Tag>;

  return (
    <Tag className={className} aria-label={text} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} transition={{ staggerChildren: step, delayChildren: delay }}>
      {pieces.map((p, i) => (
        <span key={i} aria-hidden className={clsx('inline-block overflow-hidden pb-[0.12em] align-bottom', by === 'word' && 'mr-[0.28em] last:mr-0')}>
          <motion.span
            className="inline-block"
            variants={{ hidden: { y: '115%', opacity: 0, rotate: 3 }, show: { y: '0%', opacity: 1, rotate: 0 } }}
            transition={{ type: 'spring', damping: 22, stiffness: 190 }}
          >
            {p === ' ' ? ' ' : p}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
