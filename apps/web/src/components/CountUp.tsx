import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/** Counts up to the value on first render, then glides to each new value. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      if (ref.current) ref.current.textContent = String(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, reduce, motionValue]);

  useEffect(
    () =>
      motionValue.on('change', (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v));
      }),
    [motionValue],
  );

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}
