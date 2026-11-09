import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ArrowRight, BadgeCheck, Ban, DoorOpen, Hourglass, KeyRound, LogOut, Printer, ScanLine, UserRoundPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PhotoCapture } from '@/components/PhotoCapture';
import { printBadge } from '@/components/PrintBadge';
import { QrScanner } from '@/components/QrScanner';
import { useToast } from '@/components/toast';
import { Avatar, Button, Card, Input, SectionTitle, Skeleton } from '@/components/ui';
import { VisitRow } from '@/components/VisitRow';
import { VisitSheet } from '@/components/VisitSheet';
import { api, ApiError, photoUrl } from '@/lib/api';
import { dayBound, fmtWindow } from '@/lib/format';
import { useRefreshVisits, useSummary, useVisits } from '@/lib/queries';
import type { ScanResult, Verdict, Visit } from '@/lib/types';

type Stage = { kind: 'idle' } | { kind: 'result'; result: ScanResult } | { kind: 'done'; visit: Visit; action: 'in' | 'out' };

const verdictStyle: Record<Verdict, { box: string; icon: React.ReactNode; title: string }> = {
  ALLOW: { box: 'border-success/40 bg-success-wash text-success', icon: <BadgeCheck className="size-7" />, title: 'Cleared to enter' },
  ALREADY_INSIDE: { box: 'border-accent/40 bg-accent-wash text-accent-text', icon: <DoorOpen className="size-7" />, title: 'Already inside' },
  WAIT: { box: 'border-warning/40 bg-warning-wash text-warning', icon: <Hourglass className="size-7" />, title: 'Hold at the desk' },
  DENY: { box: 'border-danger/40 bg-danger-wash text-danger', icon: <Ban className="size-7" />, title: 'Do not admit' },
};

function ResultPanel({ result, onCancel, onDone }: { result: ScanResult; onCancel: () => void; onDone: (v: Visit, action: 'in' | 'out') => void }) {
  const toast = useToast();
  const refresh = useRefreshVisits();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [plate, setPlate] = useState(result.visit.vehiclePlate ?? '');
  const { verdict, reason, visit: v } = result;
  const style = verdictStyle[verdict];

  const checkIn = useMutation({
    mutationFn: () => {
      const form = new FormData();
      if (photo) form.append('photo', photo, 'visitor.jpg');
      if (plate.trim()) form.append('vehiclePlate', plate.trim());
      return api<Visit>(`/gate/check-in/${v.id}`, { form });
    },
    onSuccess: (visit) => {
      refresh();
      onDone(visit, 'in');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: () => api<Visit>(`/gate/check-out/${v.id}`, { method: 'POST' }),
    onSuccess: (visit) => {
      refresh();
      onDone(visit, 'out');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}>
      <div className={clsx('flex items-start gap-3 rounded-3xl border p-4', style.box)} role="status">
        <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12, stiffness: 260 }} className="mt-0.5">
          {style.icon}
        </motion.span>
        <div>
          <p className="font-display text-xl font-bold">{style.title}</p>
          {reason && <p className="mt-0.5 text-[15px] font-medium">{reason}</p>}
        </div>
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={v.visitor.fullName} src={photoUrl(v.entryPhotoUrl)} size={64} />
          <div className="min-w-0">
            <h3 className="text-2xl leading-tight font-bold">{v.visitor.fullName}</h3>
            <p className="truncate text-[15px] text-soft">{v.visitor.company ?? 'No company given'}</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-sm text-soft">Visiting</dt>
            <dd className="font-semibold">{v.host.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-soft">Purpose</dt>
            <dd className="font-semibold">{v.purpose}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-soft">Pass window</dt>
            <dd className="font-semibold">{fmtWindow(v.expectedFrom, v.expectedTo)}</dd>
          </div>
          {v.visitor.idNumber && (
            <div>
              <dt className="text-sm text-soft">{v.visitor.idType ?? 'ID'} on file</dt>
              <dd className="font-semibold">{v.visitor.idNumber}</dd>
            </div>
          )}
        </dl>

        {verdict === 'ALLOW' && (
          <div className="mt-6 space-y-4 border-t border-line pt-5">
            <PhotoCapture value={photo} onChange={setPhoto} />
            <Input label="Vehicle number" hint="Optional" value={plate} onChange={(e) => setPlate(e.target.value)} autoComplete="off" />
          </div>
        )}
      </Card>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {verdict === 'ALLOW' && (
          <Button size="lg" variant="accent" className="flex-1" loading={checkIn.isPending} onClick={() => checkIn.mutate()}>
            Check in {v.visitor.fullName.split(' ')[0]}
            <ArrowRight className="size-5" aria-hidden />
          </Button>
        )}
        {verdict === 'ALREADY_INSIDE' && (
          <Button size="lg" variant="primary" className="flex-1" icon={<LogOut className="size-5" />} loading={checkOut.isPending} onClick={() => checkOut.mutate()}>
            Check out {v.visitor.fullName.split(' ')[0]}
          </Button>
        )}
        <Button size="lg" variant="soft" onClick={onCancel}>
          {verdict === 'ALLOW' || verdict === 'ALREADY_INSIDE' ? 'Not this person' : 'Scan next'}
        </Button>
      </div>
    </motion.div>
  );
}

function DonePanel({ visit, action, onNext }: { visit: Visit; action: 'in' | 'out'; onNext: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 22, stiffness: 280 }}>
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 11, stiffness: 220, delay: 0.1 }}
          className="flex size-20 items-center justify-center rounded-full bg-success text-[#F8F1E8]"
        >
          <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.4 }} />
          </svg>
        </motion.div>
        <h2 className="mt-6 text-3xl font-bold">{action === 'in' ? `${visit.visitor.fullName} is in` : `${visit.visitor.fullName} has left`}</h2>
        <p className="mt-2 text-[16px] text-soft">
          {action === 'in' ? `${visit.host.name} has been notified.` : 'They no longer count as inside the building.'}
        </p>
        {action === 'in' && visit.badgeNumber && (
          <div className="mt-6 rounded-2xl bg-sunken px-8 py-4">
            <p className="text-sm text-soft">Badge number</p>
            <p className="font-display text-4xl font-bold tracking-wide">{visit.badgeNumber}</p>
          </div>
        )}
        <div className="mt-8 flex w-full max-w-sm flex-col gap-2 sm:flex-row">
          <Button size="lg" variant="primary" className="flex-1" icon={<ScanLine className="size-5" />} onClick={onNext}>
            Next visitor
          </Button>
          {action === 'in' && (
            <Button size="lg" variant="soft" icon={<Printer className="size-5" />} onClick={() => printBadge(visit)}>
              Print badge
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function FrontDesk() {
  const toast = useToast();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Visit | null>(null);
  const [params] = useSearchParams();

  const summary = useSummary();
  const today = useMemo(() => ({ from: dayBound(0), to: dayBound(1) }), []);
  const expected = useVisits({ status: 'SCHEDULED,APPROVED', ...today, order: 'asc', pageSize: 8 });
  const waiting = useVisits({ status: 'APPROVED', order: 'asc', pageSize: 5 });

  const scan = useCallback(
    async (body: { token?: string; code?: string }) => {
      setBusy(true);
      try {
        const result = await api<ScanResult>('/gate/scan', { body });
        setStage({ kind: 'result', result });
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'That scan could not be read.');
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const reset = () => {
    setStage({ kind: 'idle' });
    setCode('');
    void qc.invalidateQueries({ queryKey: ['summary'] });
  };

  const showScanner = stage.kind === 'idle';
  const approvedWalkIns = waiting.data?.items.filter((v) => v.isWalkIn) ?? [];

  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-3 md:gap-4">
        {[
          { label: 'Inside now', value: summary.data?.insideNow, to: '/gate/inside' },
          { label: 'Expected today', value: summary.data?.expectedToday },
          { label: 'Waiting on hosts', value: summary.data?.pendingApproval },
        ].map((s) => (
          <Card key={s.label} className="p-3.5 sm:p-5">
            <p className="text-[13px] text-soft sm:text-[15px]">{s.label}</p>
            {s.value === undefined ? <Skeleton className="mt-2 h-8 w-10" /> : <p className="mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl">{s.value}</p>}
          </Card>
        ))}
      </div>

      {approvedWalkIns.length > 0 && stage.kind === 'idle' && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-3xl border border-success/40 bg-success-wash p-4">
          <p className="mb-2 font-semibold text-success">Hosts approved these walk-ins. Tap to check them in.</p>
          <div className="flex flex-wrap gap-2">
            {approvedWalkIns.map((v) => (
              <button
                key={v.id}
                disabled={busy}
                onClick={() => v.passCode && scan({ code: v.passCode })}
                className="rounded-full bg-surface px-4 py-2 text-[15px] font-semibold text-ink shadow-sm transition hover:-translate-y-px hover:shadow-md"
              >
                {v.visitor.fullName}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
        <div>
          <AnimatePresence mode="wait" initial={false}>
            {showScanner ? (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <QrScanner autoStart={params.get('scan') === '1'} onScan={(token) => scan({ token })} paused={busy} onError={(m) => toast.error(m)} />
                <form
                  className="mt-4 flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (/^\d{6}$/.test(code)) void scan({ code });
                    else toast.error('The pass code has 6 digits.');
                  }}
                >
                  <Input
                    fieldClassName="flex-1"
                    label="No QR code? Type the 6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="text-center font-display text-xl tracking-[0.3em]"
                    autoComplete="off"
                  />
                  <Button type="submit" size="md" className="h-11" icon={<KeyRound className="size-4" />} loading={busy} disabled={code.length !== 6}>
                    Find
                  </Button>
                </form>
                <Link to="/gate/walk-in" className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-line-strong p-4 text-[15px] font-semibold transition hover:border-accent hover:bg-accent-wash">
                  <UserRoundPlus className="size-5 text-accent-text" aria-hidden />
                  Visitor without an appointment?
                  <ArrowRight className="ml-auto size-4" aria-hidden />
                </Link>
              </motion.div>
            ) : (
              <motion.div key="panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {stage.kind === 'result' && <ResultPanel result={stage.result} onCancel={reset} onDone={(visit, action) => setStage({ kind: 'done', visit, action })} />}
                {stage.kind === 'done' && <DonePanel visit={stage.visit} action={stage.action} onNext={reset} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <section className="min-w-0">
          <SectionTitle title="Expected today" className="mb-3" />
          <Card className="overflow-hidden">
            {expected.isPending ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : expected.data && expected.data.items.length > 0 ? (
              <ul>
                {expected.data.items.map((v) => (
                  <VisitRow
                    key={v.id}
                    visit={v}
                    showHost
                    compact
                    onOpen={setOpen}
                    trailing={
                      v.passCode ? (
                        <Button size="sm" variant="soft" className="mr-1 shrink-0" loading={busy} onClick={() => scan({ code: v.passCode! })}>
                          Check in
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="px-6 py-12 text-center text-[15px] text-soft">No pre-registered visitors are left today.</p>
            )}
          </Card>
        </section>
      </div>

      <VisitSheet visit={open} onClose={() => setOpen(null)} />
    </>
  );
}
