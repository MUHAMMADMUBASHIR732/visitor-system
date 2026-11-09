import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Crown,
  FileBarChart,
  Footprints,
  ScanLine,
  ShieldBan,
  Siren,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { PassCard } from '@/components/PassCard';
import { ScrollGradient } from '@/components/ScrollGradient';
import { SplitText } from '@/components/SplitText';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Typewriter } from '@/components/Typewriter';
import { LinkButton } from '@/components/ui';
import { samplePass } from '@/lib/sample';

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ScanLine, title: 'Scan, or type a code', body: 'The guard taps Scan, points the camera at the pass and the visitor is cleared. No camera? Upload a photo of the pass or type the 6-digit code.' },
  { icon: Bell, title: 'The right people are told', body: 'When a visitor arrives or leaves, the host, their manager and the senior manager above them are all notified straight away.' },
  { icon: Siren, title: 'Emergency roll call', body: 'One tap freezes the list of everyone inside. Mark each person safe at the assembly point and every screen shows the status live.' },
  { icon: Footprints, title: 'Walk-ins, handled', body: 'A visitor without an appointment is photographed and sent to their host to approve or decline, in seconds.' },
  { icon: ShieldBan, title: 'Blacklist and audit trail', body: 'Block people by phone or ID number. Every sensitive action is written to a log nobody can quietly edit.' },
  { icon: FileBarChart, title: 'Reports that answer questions', body: 'Busiest hours, no-shows, how long visits last. Each manager sees their own team, and can export to a spreadsheet.' },
];

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CalendarPlus, title: 'Invite', body: 'A host, employee or manager adds the visitor. They get an email with a QR pass, or you share it on WhatsApp.' },
  { icon: ScanLine, title: 'Scan at the door', body: 'Security scans the pass, takes a photo and prints a badge. The visitor is checked in and inside.' },
  { icon: Bell, title: 'Everyone knows', body: 'The host and the people above them are notified. When the visitor leaves, they are told again.' },
];

const LEVELS: { icon: LucideIcon; role: string; body: string; tint: string }[] = [
  { icon: Crown, role: 'Senior manager', body: 'Sees every team. Adds managers, and nobody else.', tint: 'from-[#b9784d] to-[#d49a52]' },
  { icon: Users, role: 'Manager', body: 'Has their own dashboard. Adds hosts and employees, and invites visitors for them.', tint: 'from-[#d49a52] to-[#c98b5f]' },
  { icon: UserRoundCheck, role: 'Host and employee', body: 'Invite their own visitors, approve walk-ins and get told when guests arrive.', tint: 'from-[#c98b5f] to-[#b8604a]' },
  { icon: BadgeCheck, role: 'Visitor', body: 'Gets a pass by email. Shows the QR code. That is all.', tint: 'from-[#b8604a] to-[#7b5a48]' },
];

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-page/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Page sections">
          {[
            ['#features', 'Features'],
            ['#how', 'How it works'],
            ['#roles', 'Roles'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-4 py-2 text-[15px] font-semibold text-soft transition duration-200 hover:bg-sunken hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <LinkButton to="/login" size="md" variant="primary">
            Sign in
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);

  return (
    <section ref={ref} className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 md:px-8 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28">
      <motion.div style={{ y: copyY, opacity: fade }}>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/80 px-4 py-1.5 text-sm font-semibold text-accent-text shadow-card">
          <span className="size-2 animate-pulse-dot rounded-full bg-accent" aria-hidden />
          Visitor management for modern offices
        </motion.p>
        <h1 className="mt-6 text-[2.75rem] leading-[1.05] font-bold sm:text-6xl lg:text-7xl">
          <Typewriter text="Every visitor," speed={55} />
          <br />
          <Typewriter text="accounted for." speed={55} delay={900} className="text-gradient" />
        </h1>
        <SplitText as="p" delay={1.8} className="mt-6 max-w-xl text-lg text-soft" text="Invite guests, check them in with one scan, and know who is inside at any moment. Your hosts, managers and senior managers are told the moment someone arrives or leaves." />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4 }} className="mt-9 flex flex-wrap gap-3">
          <LinkButton to="/login" size="lg" variant="primary" className="group shadow-lift hover:shadow-glow">
            Sign in to Foyer
            <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </LinkButton>
          <a href="#how" className="inline-flex h-14 items-center gap-2 rounded-full px-7 text-base font-semibold transition duration-200 hover:bg-sunken hover:shadow-card">
            See how it works
            <ChevronDown className="size-5" aria-hidden />
          </a>
        </motion.div>
        <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.7 }} className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-soft">
          {['QR pass in every invite', 'Live updates, no refreshing', 'Light and dark themes'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <BadgeCheck className="size-[18px] text-success" aria-hidden />
              {t}
            </li>
          ))}
        </motion.ul>
      </motion.div>

      <motion.div style={{ y }} className="flex justify-center">
        <PassCard pass={samplePass} />
      </motion.div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-8">
      <SplitText as="h2" className="max-w-2xl text-4xl font-bold md:text-5xl" text="Everything the front desk needs, nothing it doesn't." />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 0.08}>
            <div className="grad-border group h-full rounded-card border border-line bg-surface p-6 shadow-card transition duration-300 ease-out hover:-translate-y-1.5 hover:shadow-glow">
              <span className="bg-grad flex size-12 items-center justify-center rounded-2xl text-[#2D211B] shadow-card transition duration-300 group-hover:scale-110 group-hover:-rotate-6">
                <f.icon className="size-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-soft">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function How() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] });
  const grow = useSpring(scrollYProgress, { stiffness: 100, damping: 25 });

  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-8">
      <SplitText as="h2" className="max-w-2xl text-4xl font-bold md:text-5xl" text="From invitation to goodbye in three steps." />
      <div ref={ref} className="relative mt-14 max-w-3xl">
        <div className="absolute top-2 bottom-2 left-6 w-0.5 rounded-full bg-line" aria-hidden>
          <motion.div className="bg-grad h-full w-full origin-top rounded-full" style={{ scaleY: grow }} />
        </div>
        <ol className="space-y-10">
          {STEPS.map((s, i) => (
            <Reveal key={s.title}>
              <li className="group relative flex gap-6">
                <span className="bg-grad relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full text-[#2D211B] shadow-lift transition duration-300 group-hover:scale-110">
                  <s.icon className="size-6" />
                </span>
                <div className="rounded-card border border-line bg-surface p-5 shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:shadow-glow sm:flex-1">
                  <p className="text-sm font-semibold text-accent-text">Step {i + 1}</p>
                  <h3 className="mt-0.5 text-2xl font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] text-soft">{s.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section id="roles" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-8">
      <SplitText as="h2" className="max-w-3xl text-4xl font-bold md:text-5xl" text="A reporting line that matches your office." />
      <p className="mt-5 max-w-2xl text-lg text-soft">Each level adds the level below it, sees only their own people, and is told whenever one of their team&rsquo;s visitors arrives or leaves.</p>

      <div className="mt-12 grid gap-4 lg:grid-cols-4">
        {LEVELS.map((l, i) => (
          <Reveal key={l.role} delay={i * 0.1} className="relative">
            <div className="group h-full rounded-card border border-line bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1.5 hover:shadow-glow">
              <span className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${l.tint} text-[#fff7f0] shadow-card transition duration-300 group-hover:scale-110`}>
                <l.icon className="size-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold">{l.role}</h3>
              <p className="mt-2 text-[15px] text-soft">{l.body}</p>
            </div>
            {i < LEVELS.length - 1 && (
              <>
                <ChevronRight className="absolute top-1/2 -right-[18px] z-10 hidden size-5 -translate-y-1/2 text-accent-text lg:block" aria-hidden />
                <ChevronDown className="mx-auto mt-3 -mb-1 size-5 text-accent-text lg:hidden" aria-hidden />
              </>
            )}
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-8">
        <div className="grid items-center gap-6 rounded-card border border-line bg-surface p-6 shadow-card transition duration-300 hover:shadow-glow md:grid-cols-[1fr_auto] md:p-8">
          <div>
            <h3 className="flex items-center gap-2 text-2xl font-bold">
              <ClipboardList className="size-6 text-accent-text" aria-hidden />
              One arrival, three notifications
            </h3>
            <p className="mt-2 max-w-xl text-[15px] text-soft">When security checks a visitor in, the host, the host&rsquo;s manager and the senior manager each get an alert in the app and by email. The same when the visitor leaves.</p>
          </div>
          <ul className="space-y-2 text-[15px] font-semibold">
            {['Host', 'Manager', 'Senior manager'].map((n, i) => (
              <motion.li key={n} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.15 }} className="flex items-center gap-2 rounded-full bg-success-wash px-4 py-2 text-success">
                <BadgeCheck className="size-[18px]" aria-hidden />
                {n} notified
              </motion.li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}

function Closing() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 pb-24 md:px-8">
      <Reveal>
        <div className="bg-grad grad-drift rounded-[32px] px-6 py-16 text-center text-[#2D211B] shadow-pop md:px-12">
          <SplitText as="h2" className="mx-auto max-w-2xl text-4xl font-bold md:text-5xl" text="Welcome visitors like you mean it." />
          <p className="mx-auto mt-4 max-w-lg text-lg text-[#2D211B]/80">Sign in with the email and password your office gave you.</p>
          <LinkButton to="/login" size="lg" variant="primary" className="group mt-8 !bg-[#2D211B] !text-[#F8F1E8] hover:!bg-[#43322a]">
            Sign in
            <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </LinkButton>
        </div>
      </Reveal>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <ScrollGradient />
      <Nav />
      <main>
        <Hero />
        <Features />
        <How />
        <Roles />
        <Closing />
      </main>
      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 md:px-8">
          <Logo />
          <p className="text-sm text-soft">Foyer, visitor management. Built for offices that care who walks in.</p>
          <Link to="/login" className="text-sm font-semibold text-accent-text hover:underline">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
