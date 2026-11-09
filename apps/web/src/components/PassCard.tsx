import { CircleSlash, DoorOpen, Hourglass, LogOut } from 'lucide-react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx } from 'clsx';
import type { PointerEvent, ReactElement } from 'react';
import { fmtWindow, STATUS_LABEL } from '@/lib/format';
import type { VisitStatus } from '@/lib/types';
import { Avatar } from './ui';

export interface PassData {
  name: string;
  company?: string | null;
  hostName: string;
  purpose?: string;
  expectedFrom: string;
  expectedTo: string;
  status: VisitStatus;
  passToken: string | null;
  passCode: string | null;
  photo?: string | null;
  badgeNumber?: string | null;
}

const spacedCode = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

function Stand({ status }: { status: VisitStatus }) {
  const map: Partial<Record<VisitStatus, { icon: ReactElement; text: string }>> = {
    CHECKED_IN: { icon: <DoorOpen className="size-9" />, text: 'You are checked in. Enjoy your visit.' },
    CHECKED_OUT: { icon: <LogOut className="size-9" />, text: 'You have checked out. Thank you for visiting.' },
    CANCELLED: { icon: <CircleSlash className="size-9" />, text: 'This visit was cancelled by your host.' },
    REJECTED: { icon: <CircleSlash className="size-9" />, text: 'This visit was declined.' },
    NO_SHOW: { icon: <Hourglass className="size-9" />, text: 'This pass has expired.' },
    PENDING_APPROVAL: { icon: <Hourglass className="size-9" />, text: 'Waiting for your host to approve.' },
  };
  const m = map[status] ?? { icon: <Hourglass className="size-9" />, text: STATUS_LABEL[status] };
  return (
    <div className="flex size-[184px] flex-col items-center justify-center gap-3 rounded-[22px] bg-[#F8F1E8] p-5 text-center text-[#2D211B]">
      <span className="text-[#B9784D]">{m.icon}</span>
      <p className="text-[15px] leading-snug font-medium">{m.text}</p>
    </div>
  );
}

/**
 * The visitor pass: a lanyard badge. It swings in once when it appears and tilts toward the pointer.
 * It is always dark (Coffee Bean) so the QR code keeps the same high contrast in both themes.
 */
export function PassCard({ pass, swing = true, className }: { pass: PassData; swing?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-7, 7]), { stiffness: 180, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [6, -6]), { stiffness: 180, damping: 18 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  const live = pass.status === 'SCHEDULED' || pass.status === 'APPROVED';

  return (
    <div className={clsx('relative mx-auto w-full max-w-[340px]', className)} style={{ perspective: 1100 }}>
      <div className={clsx('origin-top', swing && 'animate-swing')}>
        {/* lanyard */}
        <div className="pointer-events-none mx-auto flex h-14 w-14 flex-col items-center" aria-hidden>
          <div className="h-10 w-[22px] rounded-t-sm bg-gradient-to-b from-[#B9784D] to-[#a56a42]" />
          <div className="-mt-1 h-5 w-9 rounded-md bg-gradient-to-b from-[#E7D7C2] to-[#b9a68c] shadow-md" />
        </div>

        <motion.div
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          style={{ rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY, transformStyle: 'preserve-3d' }}
          className="relative -mt-3 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-b from-[#3b2b23] to-[#2D211B] p-6 pt-8 text-[#F8F1E8] shadow-pop"
        >
          <div className="pass-sheen pointer-events-none absolute inset-0" aria-hidden />
          <div className="absolute top-3 left-1/2 h-2 w-14 -translate-x-1/2 rounded-full bg-[#1c1410] shadow-inner" aria-hidden />

          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold tracking-tight">Foyer</span>
            <span className="rounded-full bg-[#B9784D] px-3 py-1 text-sm font-bold text-[#2D211B]">Visitor</span>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <Avatar name={pass.name} src={pass.photo} size={56} className="ring-2 ring-[#B9784D]/60" />
            <div className="min-w-0">
              <h3 className="font-display text-[26px] leading-[1.05] font-bold break-words">{pass.name}</h3>
              {pass.company && <p className="mt-1 truncate text-[15px] text-[#E7D7C2]/80">{pass.company}</p>}
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            {live && pass.passToken ? (
              <div className="rounded-[22px] bg-[#F8F1E8] p-3.5">
                <QRCodeSVG value={pass.passToken} size={156} level="M" fgColor="#2D211B" bgColor="#F8F1E8" marginSize={0} />
              </div>
            ) : (
              <Stand status={pass.status} />
            )}
          </div>

          {live && pass.passCode && (
            <p className="mt-4 text-center text-sm text-[#E7D7C2]/80">
              No camera? Give the guard this code
              <span className="mt-0.5 block font-display text-3xl font-bold tracking-[0.18em] text-[#F8F1E8]">{spacedCode(pass.passCode)}</span>
            </p>
          )}

          <dl className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[#E7D7C2]/70">Visiting</dt>
              <dd className="text-right font-semibold">{pass.hostName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-[#E7D7C2]/70">When</dt>
              <dd className="text-right font-semibold">{fmtWindow(pass.expectedFrom, pass.expectedTo)}</dd>
            </div>
            {pass.badgeNumber && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#E7D7C2]/70">Badge</dt>
                <dd className="font-semibold">{pass.badgeNumber}</dd>
              </div>
            )}
          </dl>
        </motion.div>
      </div>
    </div>
  );
}
