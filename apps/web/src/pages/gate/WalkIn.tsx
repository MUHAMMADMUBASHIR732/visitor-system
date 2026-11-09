import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban, Hourglass, Sparkles, ThumbsUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Avatar, Button, Card, ErrorNote, Input, LinkButton, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useHosts, useRefreshVisits } from '@/lib/queries';
import type { Visit, VisitorLookup } from '@/lib/types';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter the visitor’s full name.'),
  phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number.'),
  company: z.string().trim().max(100),
  idType: z.string(),
  idNumber: z.string().trim().max(40),
  hostId: z.string().min(1, 'Choose who they are visiting.'),
  purpose: z.string().trim().min(3, 'Say briefly why they are here.').max(200),
  vehiclePlate: z.string().trim().max(20),
});
type Values = z.infer<typeof schema>;

function Waiting({ visit, onNew }: { visit: Visit; onNew: () => void }) {
  // Hosts answer on their phone; poll every few seconds so the guard sees it quickly.
  const { data } = useQuery({
    queryKey: ['visit', visit.id],
    queryFn: () => api<Visit>(`/visits/${visit.id}`),
    refetchInterval: 3000,
    initialData: visit,
  });
  const v = data ?? visit;

  const state =
    v.status === 'APPROVED'
      ? { icon: <ThumbsUp className="size-8" />, tone: 'bg-success-wash text-success', title: `${v.host.name} approved`, body: `${v.visitor.fullName} can be checked in now.` }
      : v.status === 'REJECTED'
        ? { icon: <Ban className="size-8" />, tone: 'bg-danger-wash text-danger', title: `${v.host.name} declined`, body: 'Do not admit this visitor. Let them know politely.' }
        : v.status === 'CANCELLED' || v.status === 'NO_SHOW'
          ? { icon: <Ban className="size-8" />, tone: 'bg-sunken text-soft', title: 'This request ended', body: 'Register the visitor again if they are still here.' }
          : { icon: <Hourglass className="size-8" />, tone: 'bg-warning-wash text-warning', title: `Waiting for ${v.host.name}`, body: 'They have been notified on their phone and by email.' };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg">
      <Card className="flex flex-col items-center px-6 py-12 text-center">
        <motion.div key={v.status} initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12, stiffness: 240 }} className={`flex size-20 items-center justify-center rounded-full ${state.tone}`}>
          {state.icon}
        </motion.div>
        <div className="mt-6 flex items-center gap-3">
          <Avatar name={v.visitor.fullName} size={36} />
          <p className="text-lg font-semibold">{v.visitor.fullName}</p>
        </div>
        <h2 className="mt-3 text-3xl font-bold">{state.title}</h2>
        <p className="mt-2 text-[16px] text-soft">{state.body}</p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
          {v.status === 'APPROVED' && (
            <LinkButton to="/gate" size="lg" variant="accent">
              Go to check-in
            </LinkButton>
          )}
          <Button variant="soft" onClick={onNew}>
            Register someone else
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

export default function WalkIn() {
  const hosts = useHosts();
  const refresh = useRefreshVisits();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Visit | null>(null);
  const [known, setKnown] = useState<VisitorLookup | null>(null);

  const { register, handleSubmit, control, setValue, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', phone: '', company: '', idType: 'CNIC', idNumber: '', hostId: '', purpose: '', vehiclePlate: '' },
  });

  const phone = useWatch({ control, name: 'phone' });
  useEffect(() => {
    if (phone.replace(/\D/g, '').length < 10) {
      setKnown(null);
      return;
    }
    const t = window.setTimeout(() => {
      api<VisitorLookup | null>('/visitors/lookup', { query: { phone } })
        .then((f) => {
          setKnown(f);
          if (f) {
            setValue('fullName', f.fullName, { shouldValidate: true });
            if (f.company) setValue('company', f.company);
            if (f.idType) setValue('idType', f.idType);
          }
        })
        .catch(() => setKnown(null));
    }, 450);
    return () => window.clearTimeout(t);
  }, [phone, setValue]);

  const submit = useMutation({
    mutationFn: (v: Values) =>
      api<Visit>('/gate/walk-in', {
        body: {
          visitor: { fullName: v.fullName, phone: v.phone, company: v.company || undefined, idType: v.idNumber ? v.idType : undefined, idNumber: v.idNumber || undefined },
          hostId: v.hostId,
          purpose: v.purpose,
          vehiclePlate: v.vehiclePlate || undefined,
        },
      }),
    onSuccess: (visit) => {
      setCreated(visit);
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (created) {
    return (
      <Waiting
        visit={created}
        onNew={() => {
          setCreated(null);
          setKnown(null);
          reset();
        }}
      />
    );
  }

  const e = formState.errors;
  return (
    <>
      <PageHeader title="Walk-in visitor" subtitle="For people without an appointment. The host approves from their phone before you let anyone in." />
      <form
        noValidate
        onSubmit={handleSubmit((v) => {
          setError(null);
          submit.mutate(v);
        })}
        className="max-w-3xl"
      >
        <Card className="space-y-6 p-5 sm:p-7">
          {error && <ErrorNote message={error} />}
          <div>
            <Input label="Phone number" type="tel" inputMode="tel" autoComplete="off" placeholder="0300 1234567" error={e.phone?.message} {...register('phone')} />
            <AnimatePresence>
              {known && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex items-center gap-2 overflow-hidden rounded-xl bg-accent-wash px-3 py-2 text-sm font-medium text-accent-text">
                  <Sparkles className="size-4 shrink-0" aria-hidden />
                  Returning visitor: {known.visits} earlier {known.visits === 1 ? 'visit' : 'visits'}. Details filled in.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Full name" autoComplete="off" error={e.fullName?.message} {...register('fullName')} />
            <Input label="Company" hint="Optional" autoComplete="off" error={e.company?.message} {...register('company')} />
            <Select label="ID type" {...register('idType')}>
              <option value="CNIC">CNIC</option>
              <option value="Passport">Passport</option>
              <option value="Driving licence">Driving licence</option>
              <option value="Other">Other</option>
            </Select>
            <Input label="ID number" hint="Checked against the blacklist." autoComplete="off" error={e.idNumber?.message} {...register('idNumber')} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Select label="Visiting" error={e.hostId?.message} {...register('hostId')}>
              <option value="">Choose a person</option>
              {hosts.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.department ? ` (${h.department})` : ''}
                </option>
              ))}
            </Select>
            <Input label="Vehicle number" hint="Optional" autoComplete="off" error={e.vehiclePlate?.message} {...register('vehiclePlate')} />
          </div>
          <Input label="Purpose of visit" placeholder="Parcel delivery, meeting, interview" error={e.purpose?.message} {...register('purpose')} />
          <div className="flex flex-wrap gap-3 border-t border-line pt-6">
            <Button type="submit" size="lg" loading={submit.isPending}>
              Ask host to approve
            </Button>
            <Link to="/gate" className="inline-flex h-14 items-center rounded-full px-7 text-base font-semibold text-ink transition hover:bg-sunken">
              Back to front desk
            </Link>
          </div>
        </Card>
      </form>
    </>
  );
}
