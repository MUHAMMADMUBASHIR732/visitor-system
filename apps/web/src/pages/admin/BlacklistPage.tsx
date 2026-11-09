import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldBan, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Modal, Sheet } from '@/components/overlays';
import { useToast } from '@/components/toast';
import { Button, Card, EmptyState, ErrorNote, Input, PageHeader, Skeleton, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import type { BlacklistEntry } from '@/lib/types';

const schema = z
  .object({
    fullName: z.string().trim().max(100),
    phone: z.string().trim().max(30),
    idNumber: z.string().trim().max(40),
    reason: z.string().trim().min(3, 'Give a short reason so guards understand.').max(300),
  })
  .refine((v) => v.phone || v.idNumber, { path: ['phone'], message: 'Add a phone number or an ID number.' });
type Values = z.infer<typeof schema>;

export default function BlacklistPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['blacklist'], queryFn: () => api<BlacklistEntry[]>('/blacklist') });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<BlacklistEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fullName: '', phone: '', idNumber: '', reason: '' } });

  const add = useMutation({
    mutationFn: (v: Values) => api<BlacklistEntry>('/blacklist', { body: { fullName: v.fullName || undefined, phone: v.phone || undefined, idNumber: v.idNumber || undefined, reason: v.reason } }),
    onSuccess: () => {
      toast.success('Added. This person can no longer be registered or admitted.');
      void qc.invalidateQueries({ queryKey: ['blacklist'] });
      reset();
      setAdding(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/blacklist/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Removed from the blacklist.');
      void qc.invalidateQueries({ queryKey: ['blacklist'] });
      setRemoving(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const e = formState.errors;

  return (
    <>
      <PageHeader title="Blacklist" subtitle="People who must not be admitted. Matched by phone number or ID number at registration and at the front desk." actions={<Button icon={<Plus className="size-5" />} onClick={() => setAdding(true)}>Add entry</Button>} />

      <Card className="overflow-hidden">
        {list.isPending ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !list.data?.length ? (
          <EmptyState icon={<ShieldBan className="size-6" />} title="Nobody is blocked" body="Add someone and Foyer will stop them at registration and at the front desk." />
        ) : (
          <ul>
            {list.data.map((b) => (
              <li key={b.id} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger-wash text-danger">
                  <ShieldBan className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.fullName ?? 'Name not recorded'}</p>
                  <p className="truncate text-sm text-soft">{[b.phone, b.idNumber].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1 text-[15px]">{b.reason}</p>
                  <p className="mt-0.5 text-xs text-soft">Added {fmtDateTime(b.createdAt)}</p>
                </div>
                <Button variant="ghost" size="sm" aria-label={`Remove ${b.fullName ?? 'entry'}`} icon={<Trash2 className="size-4" />} className="text-danger" onClick={() => setRemoving(b)}>
                  <span className="hidden sm:inline">Remove</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add to blacklist" footer={<Button size="lg" className="w-full" loading={add.isPending} onClick={handleSubmit((v) => { setError(null); add.mutate(v); })}>Add to blacklist</Button>}>
        <form noValidate className="space-y-5 pt-2" onSubmit={(ev) => ev.preventDefault()}>
          {error && <ErrorNote message={error} />}
          <Input label="Name" hint="Optional, for your records." {...register('fullName')} />
          <Input label="Phone number" type="tel" error={e.phone?.message} {...register('phone')} />
          <Input label="ID number" hint="Phone or ID is required." {...register('idNumber')} />
          <Textarea label="Reason" placeholder="Why this person must not be admitted" error={e.reason?.message} {...register('reason')} />
        </form>
      </Sheet>

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove from the blacklist?"
        footer={
          <>
            <Button variant="soft" onClick={() => setRemoving(null)}>
              Keep blocked
            </Button>
            <Button variant="primary" loading={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>
              Remove
            </Button>
          </>
        }
      >
        {removing?.fullName ?? 'This person'} will be able to be registered and admitted again.
      </Modal>
    </>
  );
}
