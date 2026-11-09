import { motion, useScroll, useSpring, useTransform } from 'motion/react';

/**
 * Scroll-driven colour only: a fixed wash whose angle and warmth follow the page scroll,
 * plus a thin progress bar. No shapes, blobs or particles.
 */
export function ScrollGradient() {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });
  const angle = useTransform(smooth, [0, 1], [160, 205]);
  const warm = useTransform(smooth, [0, 0.5, 1], [0.0, 0.55, 0.25]);

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-grad"
        style={{ scaleX: smooth }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={
          {
            '--a': angle,
            '--w': warm,
            background:
              'linear-gradient(calc(var(--a) * 1deg), var(--page) 0%, color-mix(in srgb, var(--accent-wash) calc(var(--w) * 100%), var(--page)) 52%, color-mix(in srgb, var(--gold) calc(var(--w) * 22%), var(--page)) 100%)',
          } as never
        }
      />
    </>
  );
}
