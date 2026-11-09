import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Logo } from '@/components/Logo';
import { PassCard } from '@/components/PassCard';
import { PasswordInput } from '@/components/PasswordInput';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Typewriter } from '@/components/Typewriter';
import { Button, ErrorNote, Input } from '@/components/ui';
import { samplePass } from '@/lib/sample';
import { useTheme } from '@/lib/theme';
import { homeFor, useAuth } from '@/lib/auth';

const schema = z.object({
  email: z.string().min(1, 'Enter your email.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
type Values = z.infer<typeof schema>;

const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true';
const DEMO = [
  { label: 'Admin', email: 'admin@foyer.demo' },
  { label: 'Senior manager', email: 'senior@foyer.demo' },
  { label: 'Manager', email: 'manager@foyer.demo' },
  { label: 'Host', email: 'sana@foyer.demo' },
  { label: 'Employee', email: 'employee@foyer.demo' },
  { label: 'Guard', email: 'guard@foyer.demo' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  useTheme(); // keeps the saved theme applied on this page

  const { register, handleSubmit, setValue, watch, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const password = watch('password') ?? '';

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homeFor(user.role)} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const u = await login(values.email, values.password);
      navigate(homeFor(u.role), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    }
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="grad-drift relative hidden overflow-hidden bg-[linear-gradient(135deg,#2D211B_0%,#4a3326_45%,#6b4a37_70%,#2D211B_100%)] text-[#F8F1E8] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo className="relative [&_span:last-child]:text-[#F8F1E8]" />

        <div className="relative my-4 flex flex-1 items-center justify-center">
          <PassCard pass={samplePass} />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold"><Typewriter text="Every visitor, accounted for." speed={45} delay={500} /></h2>
          <p className="mt-3 text-[17px] text-[#E7D7C2]/80">Pre-register guests, check them in with one scan, and see who is inside at any moment.</p>
        </div>
      </section>

      <section className="relative flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-20">
        <div className="absolute top-4 right-4 left-4 flex items-center justify-between sm:right-8 sm:left-8">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-soft transition duration-200 hover:bg-sunken hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            Back to home
          </Link>
          <ThemeToggle />
        </div>
        <Logo className="mb-10 lg:hidden" />
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-4xl font-bold"><Typewriter text="Sign in" speed={70} /></h1>
          <p className="mt-2 text-[15px] text-soft">Use the email and password your office gave you.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            {error && <ErrorNote message={error} />}
            <Input label="Email" type="email" autoComplete="username" inputMode="email" placeholder="you@company.com" error={formState.errors.email?.message} {...register('email')} />
            <PasswordInput label="Password" autoComplete="current-password" value={password} error={formState.errors.password?.message} {...register('password')} />
            <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
              Sign in
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Button>
          </form>

          {SHOW_DEMO && (
            <div className="mt-10 rounded-2xl border border-dashed border-line-strong p-4">
              <p className="text-sm font-semibold">Try a demo account</p>
              <p className="mt-0.5 text-sm text-soft">Fills in the form. The password is Foyer@2026.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => {
                      setValue('email', d.email, { shouldValidate: true });
                      setValue('password', 'Foyer@2026', { shouldValidate: true });
                    }}
                    className="rounded-full bg-sunken px-4 py-1.5 text-sm font-semibold transition duration-200 hover:-translate-y-px hover:bg-accent hover:text-accent-ink hover:shadow-glow"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
