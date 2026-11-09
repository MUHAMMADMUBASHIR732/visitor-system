import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, Plus, Search, UserCog } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Sheet } from '@/components/overlays';
import { PasswordInput } from '@/components/PasswordInput';
import { Typewriter } from '@/components/Typewriter';
import { useToast } from '@/components/toast';
import { Avatar, Button, Card, EmptyState, ErrorNote, Input, PageHeader, Pill, Select, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ADDABLE, ROLE_LABEL } from '@/lib/roles';
import type { Department, ManagedUser, Role } from '@/lib/types';

const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(100)
  .regex(/[A-Za-z]/, 'Add a letter.')
  .regex(/\d/, 'Add a number.');

const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().max(30),
  role: z.string().min(1),
  departmentId: z.string(),
  managerId: z.string(),
  password: passwordRule,
});
type CreateValues = z.infer<typeof createSchema>;

function randomPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => chars[b % chars.length]).join('') + '#7';
}

const ROLE_HINT: Record<Role, string> = {
  ADMIN: 'Manages everything.',
  SENIOR_MANAGER: 'Oversees managers and sees everything their teams do.',
  MANAGER: 'Runs a team: adds hosts and employees, and invites visitors for them.',
  HOST: 'Receives visitors and approves walk-ins.',
  EMPLOYEE: 'Invites their own visitors.',
  GUARD: 'Runs the front desk.',
};

const PARENT_LABEL: Partial<Record<Role, string>> = { MANAGER: 'Senior manager', HOST: 'Manager', EMPLOYEE: 'Manager' };

function CreateSheet({ open, onClose, departments }: { open: boolean; onClose: () => void; departments: Department[] }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const roles = me ? ADDABLE[me.role] : [];
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    values: { name: '', email: '', phone: '', role: roles[0] ?? 'HOST', departmentId: '', managerId: '', password: '' },
    resetOptions: { keepDirtyValues: true },
  });
  const role = watch('role') as Role;
  const password = watch('password');
  const isAdmin = me?.role === 'ADMIN';
  const parents = useQuery({
    queryKey: ['parents', role],
    queryFn: () => api<{ id: string; name: string }[]>('/users/parents', { query: { role } }),
    enabled: open && isAdmin && Boolean(PARENT_LABEL[role]),
  });

  const create = useMutation({
    mutationFn: (v: CreateValues) =>
      api<ManagedUser>('/users', { body: { ...v, phone: v.phone || undefined, departmentId: v.departmentId || undefined, managerId: v.managerId || undefined } }),
    onSuccess: (u) => {
      toast.success(`${u.name} was added. Share their password with them securely.`);
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['hosts'] });
      reset();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const e = formState.errors;
  return (
    <Sheet open={open} onClose={onClose} title="Add a person" footer={<Button size="lg" className="w-full" loading={create.isPending} onClick={handleSubmit((v) => { setError(null); create.mutate(v); })}>Add {ROLE_LABEL[role]?.toLowerCase() ?? 'person'}</Button>}>
      <form noValidate className="space-y-5 pt-2" onSubmit={(ev) => ev.preventDefault()}>
        {error && <ErrorNote message={error} />}
        {roles.length > 1 ? (
          <Select label="Role" hint={ROLE_HINT[role]} {...register('role')}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        ) : (
          <div className="rounded-2xl bg-accent-wash px-4 py-3 text-[15px]">
            <p className="font-semibold">Adding a {ROLE_LABEL[roles[0]]?.toLowerCase()}</p>
            <p className="text-soft">{ROLE_HINT[roles[0]]} They will report to you.</p>
          </div>
        )}
        <Input label="Full name" error={e.name?.message} {...register('name')} />
        <Input label="Work email" type="email" error={e.email?.message} {...register('email')} />
        <Input label="Phone" hint="Optional" type="tel" error={e.phone?.message} {...register('phone')} />
        {isAdmin && PARENT_LABEL[role] && (
          <Select label={`Reports to (${PARENT_LABEL[role]!.toLowerCase()})`} hint="Optional. Their dashboard shows this person's visitors." {...register('managerId')}>
            <option value="">No one yet</option>
            {parents.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Department" {...register('departmentId')}>
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <div>
          <PasswordInput label="Starting password" meter autoComplete="new-password" error={e.password?.message} value={password} {...register('password')} />
          <button type="button" onClick={() => setValue('password', randomPassword(), { shouldValidate: true })} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:underline">
            <KeyRound className="size-4" aria-hidden />
            Generate a strong password {password ? '(replaces current)' : ''}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function EditSheet({ user, onClose, departments }: { user: ManagedUser | null; onClose: () => void; departments: Department[] }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [dept, setDept] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api<ManagedUser>(`/users/${user!.id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => {
      toast.success('Saved.');
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['hosts'] });
      setPassword('');
      setRole(null);
      setDept(null);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const self = user?.id === me?.id;
  const isAdmin = me?.role === 'ADMIN';
  const patch: Record<string, unknown> = {};
  if (role && role !== user?.role) patch.role = role;
  if (dept !== null && dept !== (user?.departmentId ?? '')) patch.departmentId = dept || undefined;
  if (password) patch.password = password;
  const passwordOk = !password || (password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password));
  const dirty = Object.keys(patch).length > 0;
  const locked = user?.lockedUntil && new Date(user.lockedUntil) > new Date();

  return (
    <Sheet open={Boolean(user)} onClose={onClose} title="Edit person" footer={<Button size="lg" className="w-full" disabled={!dirty || !passwordOk} loading={save.isPending} onClick={() => save.mutate(patch)}>Save changes</Button>}>
      {user && (
        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={52} />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{user.name}</p>
              <p className="truncate text-sm text-soft">
                {user.email} · {ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>
          {locked && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-warning-wash px-4 py-3 text-[15px] text-warning">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              Locked after too many wrong passwords. Setting a new password below unlocks it now.
            </div>
          )}
          {isAdmin && (
            <Select label="Role" disabled={self} hint={self ? 'You cannot change your own role.' : undefined} value={role ?? user.role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          )}
          <Select label="Department" value={dept ?? user.departmentId ?? ''} onChange={(e) => setDept(e.target.value)}>
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <PasswordInput label="New password" meter={Boolean(password)} hint="Leave empty to keep the current password." autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="border-t border-line pt-5">
            <Button variant={user.isActive ? 'danger' : 'soft'} disabled={self} loading={save.isPending && !dirty} onClick={() => save.mutate({ isActive: !user.isActive })}>
              {user.isActive ? 'Deactivate this person' : 'Reactivate this person'}
            </Button>
            <p className="mt-2 text-sm text-soft">{self ? 'You cannot deactivate yourself.' : user.isActive ? 'They can no longer sign in. Their past visits stay on record.' : 'They can sign in again.'}</p>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function PersonRow({ u, nameOf, onOpen, indent }: { u: ManagedUser; nameOf: (id: string | null) => string | null; onOpen: (u: ManagedUser) => void; indent?: boolean }) {
  const boss = nameOf(u.managerId);
  return (
    <li className="border-b border-line last:border-b-0">
      <button onClick={() => onOpen(u)} className={`group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition duration-200 hover:bg-sunken/70 hover:shadow-[inset_3px_0_0_var(--accent)] sm:px-5 ${indent ? 'sm:pl-10' : ''}`}>
        <Avatar name={u.name} size={44} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-base font-semibold ${u.isActive ? '' : 'text-soft line-through'}`}>{u.name}</span>
          <span className="block truncate text-sm text-soft">
            {u.email}
            {boss ? ` · reports to ${boss}` : ''}
          </span>
        </span>
        {!u.isActive && <Pill tone="neutral">Inactive</Pill>}
        <Pill tone={u.role === 'ADMIN' || u.role === 'SENIOR_MANAGER' ? 'accent' : u.role === 'MANAGER' || u.role === 'GUARD' ? 'success' : 'neutral'}>{ROLE_LABEL[u.role]}</Pill>
      </button>
    </li>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<ManagedUser[]>('/users') });
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => api<Department[]>('/departments'), staleTime: 5 * 60_000 });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [filter, setFilter] = useState<Role | 'ALL'>('ALL');
  const [q, setQ] = useState('');

  const all = users.data ?? [];
  const nameOf = (id: string | null) => (id ? all.find((u) => u.id === id)?.name ?? null : null);
  const others = all.filter((u) => u.id !== me?.id);
  const isAdmin = me?.role === 'ADMIN';
  const isSenior = me?.role === 'SENIOR_MANAGER';

  const filtered = useMemo(
    () => others.filter((u) => (filter === 'ALL' || u.role === filter) && (!q.trim() || `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()))),
    [others, filter, q],
  );
  const present = useMemo(() => [...new Set(others.map((u) => u.role))], [others]);

  const title = isAdmin ? 'People' : isSenior ? 'Managers & teams' : 'My team';
  const subtitle = isAdmin
    ? 'Everyone who can sign in to Foyer.'
    : isSenior
      ? 'Add managers. Each manager adds their own hosts and employees, and you see them all.'
      : 'Add hosts and employees, and invite visitors for them from your dashboard.';
  const addLabel = isSenior ? 'Add manager' : isAdmin ? 'Add person' : 'Add to team';

  return (
    <>
      <PageHeader title={<Typewriter text={title} />} subtitle={subtitle} actions={<Button icon={<Plus className="size-5" />} onClick={() => setAdding(true)}>{addLabel}</Button>} />

      {others.length > 6 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-soft" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-10 text-[15px] transition hover:border-soft focus:border-accent focus:ring-4 focus:ring-accent/20 focus:outline-none" />
          </div>
          {['ALL', ...present].map((r) => (
            <button key={r} onClick={() => setFilter(r as Role | 'ALL')} className={`h-11 rounded-full px-4 text-[15px] font-semibold transition duration-200 hover:-translate-y-px hover:shadow-card ${filter === r ? 'bg-primary text-primary-ink' : 'bg-sunken text-soft hover:text-ink'}`}>
              {r === 'ALL' ? 'Everyone' : ROLE_LABEL[r as Role]}
            </button>
          ))}
        </div>
      )}

      {users.isPending ? (
        <Card className="space-y-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </Card>
      ) : isSenior && filter === 'ALL' && !q ? (
        <div className="space-y-5">
          {others.filter((u) => u.role === 'MANAGER').length === 0 ? (
            <Card>
              <EmptyState icon={<UserCog className="size-6" />} title="No managers yet" body="Add your first manager. They will get their own dashboard and add their team." action={<Button icon={<Plus className="size-5" />} onClick={() => setAdding(true)}>Add manager</Button>} />
            </Card>
          ) : (
            others
              .filter((u) => u.role === 'MANAGER')
              .map((m, i) => {
                const team = others.filter((u) => u.managerId === m.id);
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="grad-border overflow-hidden">
                      <ul>
                        <PersonRow u={m} nameOf={nameOf} onOpen={setEditing} />
                        {team.map((t) => (
                          <PersonRow key={t.id} u={t} nameOf={nameOf} onOpen={setEditing} indent />
                        ))}
                      </ul>
                      {team.length === 0 && <p className="border-t border-line px-5 py-3 text-sm text-soft">No hosts or employees yet.</p>}
                    </Card>
                  </motion.div>
                );
              })
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<UserCog className="size-6" />}
              title={others.length === 0 ? 'Nobody on your team yet' : 'No one matches'}
              body={others.length === 0 ? 'Add a host or employee. They can sign in straight away.' : 'Try a different search or filter.'}
              action={others.length === 0 ? <Button icon={<Plus className="size-5" />} onClick={() => setAdding(true)}>{addLabel}</Button> : undefined}
            />
          ) : (
            <ul>
              {filtered.map((u) => (
                <PersonRow key={u.id} u={u} nameOf={nameOf} onOpen={setEditing} />
              ))}
            </ul>
          )}
        </Card>
      )}
      <CreateSheet open={adding} onClose={() => setAdding(false)} departments={departments.data ?? []} />
      <EditSheet user={editing} onClose={() => setEditing(null)} departments={departments.data ?? []} />
    </>
  );
}
