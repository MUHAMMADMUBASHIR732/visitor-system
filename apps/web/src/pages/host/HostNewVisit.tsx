import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, MessageCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { PassCard } from '@/components/PassCard';
import { useToast } from '@/components/toast';
import { Button, Card, ErrorNote, Input, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtWindow, toLocalInput } from '@/lib/format';
import { useHosts } from '@/lib/queries';
import type { Visit, VisitorLookup } from '@/lib/types';

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the visitor’s full name.'),
    phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number.'),
    email: z.string().trim().email('Enter a valid email address.').or(z.literal('')),
    company: z.string().trim().max(100),
    purpose: z.string().trim().min(3, 'Say briefly why they are visiting.').max(200),
    expectedFrom: z.string().min(1, 'Choose when they arrive.'),
    expectedTo: z.string().min(1, 'Choose when the pass ends.'),
    vehiclePlate: z.string().trim().max(20),
    hostId: z.string().optional(),
  })
  .refine((v) => new Date(v.expectedTo) > new Date(v.expectedFrom), { path: ['expectedTo'], message: 'The pass must end after it starts.' })
  .refine((v) => new Date(v.expectedTo) > new Date(), { path: ['expectedTo'], message: 'That time has already passed.' });

type Values = z.infer<typeof schema>;

function slot(addMinutes: number, lengthMinutes: number) {
  const from = new Date(Date.now() + addMinutes * 60_000);
  from.setSeconds(0, 0);
  return { from: toLocalInput(from), to: toLocalInput(new Date(from.getTime() + lengthMinutes * 60_000)) };
}

function tomorrowAt(hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return { from: toLocalInput(d), to: toLocalInput(new Date(d.getTime() + 2 * 3600_000)) };
}

const PRESETS = [
  { label: 'Within the hour', get: () => slot(10, 120) },
  { label: 'This afternoon', get: () => { const d = new Date(); d.setHours(14, 0, 0, 0); if (d < new Date()) return slot(30, 120); return { from: toLocalInput(d), to: toLocalInput(new Date(d.getTime() + 2 * 3600_000)) }; } },
  { label: 'Tomorrow 10:00', get: () => tomorrowAt(10) },
];

function passLink(token: string) {
  return `${window.location.origin}/pass/${token}`;
}

function Done({ visit, onAnother, onView }: { visit: Visit; onAnother: () => void; onView: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const link = visit.passToken ? passLink(visit.passToken) : '';
  const whatsappText = `Hi ${visit.visitor.fullName.split(' ')[0]}, here is your visit pass for ${visit.host.name} on ${fmtWindow(visit.expectedFrom, visit.expectedTo)}. Show the QR code at the front desk: ${link}`;
  const phoneDigits = visit.visitor.phone.replace(/\D/g, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Could not copy the link. Select it and copy manually.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid items-start gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="flex size-14 items-center justify-center rounded-2xl bg-success-wash text-success">
          <Check className="size-7" strokeWidth={3} />
        </div>
        <h1 className="mt-5 text-4xl font-bold">{visit.visitor.fullName} is on the list</h1>
        <p className="mt-2 max-w-prose text-[17px] text-soft">
          {visit.visitor.email ? `We emailed the pass to ${visit.visitor.email}. ` : 'No email was added, so share the pass yourself. '}
          The front desk will see them the moment they arrive, and you get a notification when they check in.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-ink shadow-sm transition duration-200 hover:-translate-y-px hover:shadow-md active:scale-[0.98]"
          >
            <MessageCircle className="size-5" aria-hidden />
            Send on WhatsApp
          </a>
          <Button variant="soft" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={copy}>
            {copied ? 'Link copied' : 'Copy pass link'}
          </Button>
        </div>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-6">
          <Button variant="primary" onClick={onAnother}>
            Invite another visitor
          </Button>
          <Button variant="ghost" onClick={onView}>
            See my visits
          </Button>
        </div>
      </div>
      <div className="rounded-[36px] bg-sunken p-5 pt-2">
        <PassCard
          pass={{
            name: visit.visitor.fullName,
            company: visit.visitor.company,
            hostName: visit.host.name,
            expectedFrom: visit.expectedFrom,
            expectedTo: visit.expectedTo,
            status: visit.status,
            passToken: visit.passToken,
            passCode: visit.passCode,
          }}
        />
      </div>
    </motion.div>
  );
}

export default function HostNewVisit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canPick = user?.role === 'ADMIN' || user?.role === 'SENIOR_MANAGER' || user?.role === 'MANAGER';
  const hosts = useHosts(user?.role === 'ADMIN' ? undefined : 'team');
  const [created, setCreated] = useState<Visit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [known, setKnown] = useState<VisitorLookup | null>(null);

  const initial = slot(15, 120);
  const { register, handleSubmit, control, setValue, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', phone: '', email: '', company: '', purpose: '', vehiclePlate: '', expectedFrom: initial.from, expectedTo: initial.to, hostId: user?.id },
  });

  // Returning visitors: typing a known phone number fills the rest of the form.
  const phone = useWatch({ control, name: 'phone' });
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setKnown(null);
      return;
    }
    const handle = window.setTimeout(() => {
      api<VisitorLookup | null>('/visitors/lookup', { query: { phone } })
        .then((found) => {
          setKnown(found);
          if (found) {
            setValue('fullName', found.fullName, { shouldValidate: true });
            if (found.email) setValue('email', found.email);
            if (found.company) setValue('company', found.company);
          }
        })
        .catch(() => setKnown(null));
    }, 450);
    return () => window.clearTimeout(handle);
  }, [phone, setValue]);

  const create = useMutation({
    mutationFn: (v: Values) =>
      api<Visit>('/visits', {
        body: {
          visitor: { fullName: v.fullName, phone: v.phone, email: v.email || undefined, company: v.company || undefined },
          purpose: v.purpose,
          expectedFrom: new Date(v.expectedFrom).toISOString(),
          expectedTo: new Date(v.expectedTo).toISOString(),
          vehiclePlate: v.vehiclePlate || undefined,
          hostId: canPick ? v.hostId : undefined,
        },
      }),
    onSuccess: (visit) => {
      setCreated(visit);
      void qc.invalidateQueries({ queryKey: ['visits'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const onSubmit = handleSubmit((v) => {
    setError(null);
    create.mutate(v);
  });

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    const { from, to } = p.get();
    setValue('expectedFrom', from, { shouldValidate: true });
    setValue('expectedTo', to, { shouldValidate: true });
  };

  if (created) {
    return (
      <Done
        visit={created}
        onView={() => navigate('/host/visits')}
        onAnother={() => {
          setCreated(null);
          setKnown(null);
          const s = slot(15, 120);
          reset({ fullName: '', phone: '', email: '', company: '', purpose: '', vehiclePlate: '', expectedFrom: s.from, expectedTo: s.to, hostId: user?.id });
        }}
      />
    );
  }

  const e = formState.errors;

  return (
    <>
      <PageHeader title="Invite a visitor" subtitle="They get a pass with a QR code. At the front desk, one scan checks them in." />
      <form onSubmit={onSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="space-y-6 p-5 sm:p-7">
          {error && <ErrorNote message={error} />}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Phone number" type="tel" inputMode="tel" autoComplete="off" placeholder="0300 1234567" error={e.phone?.message} {...register('phone')} />
              <AnimatePresence>
                {known && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 flex items-center gap-2 overflow-hidden rounded-xl bg-accent-wash px-3 py-2 text-sm font-medium text-accent-text"
                  >
                    <Sparkles className="size-4 shrink-0" aria-hidden />
                    Welcome back. {known.fullName} has visited {known.visits} {known.visits === 1 ? 'time' : 'times'} before, so we filled in their details.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <Input label="Full name" autoComplete="off" error={e.fullName?.message} {...register('fullName')} />
            <Input label="Company" hint="Optional" autoComplete="off" error={e.company?.message} {...register('company')} />
            <Input label="Email" type="email" inputMode="email" hint="We send the pass here. Optional." autoComplete="off" error={e.email?.message} {...register('email')} />
            <Input label="Vehicle number" hint="Optional" autoComplete="off" error={e.vehiclePlate?.message} {...register('vehiclePlate')} />
          </div>

          <Input label="Why are they visiting?" placeholder="Project review, interview, delivery" error={e.purpose?.message} {...register('purpose')} />

          {canPick && (
            <Select label="Host" {...register('hostId')}>
              {hosts.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.department ? ` (${h.department})` : ''}
                </option>
              ))}
            </Select>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">When</legend>
            <div className="mb-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-full bg-sunken px-4 py-1.5 text-sm font-semibold transition duration-200 hover:-translate-y-px hover:bg-accent hover:text-accent-ink"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Arrives" type="datetime-local" error={e.expectedFrom?.message} {...register('expectedFrom')} />
              <Input label="Pass ends" type="datetime-local" error={e.expectedTo?.message} {...register('expectedTo')} />
            </div>
            <p className="mt-2 text-sm text-soft">The pass starts working 1 hour before the arrival time.</p>
          </fieldset>

          <div className="flex flex-wrap gap-3 border-t border-line pt-6">
            <Button type="submit" size="lg" loading={create.isPending}>
              Create pass
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </Card>

        <aside className="hidden rounded-card bg-sunken p-6 lg:block">
          <h2 className="text-lg font-semibold">What happens next</h2>
          <ol className="mt-4 space-y-4 text-[15px] text-soft">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">1</span>
              The visitor gets a pass with a QR code and a 6-digit backup code.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">2</span>
              At the front desk the guard scans it and takes a photo.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">3</span>
              You are notified the moment they arrive.
            </li>
          </ol>
        </aside>
      </form>
    </>
  );
}
