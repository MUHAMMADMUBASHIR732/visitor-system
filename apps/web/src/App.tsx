import { lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { Logo } from '@/components/Logo';
import { homeFor, useAuth } from '@/lib/auth';
import { isHostRole } from '@/lib/roles';
import type { Role } from '@/lib/types';

const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/Login'));
const PublicPass = lazy(() => import('@/pages/PublicPass'));
const HostToday = lazy(() => import('@/pages/host/HostToday'));
const HostNewVisit = lazy(() => import('@/pages/host/HostNewVisit'));
const VisitsPage = lazy(() => import('@/pages/VisitsPage'));
const FrontDesk = lazy(() => import('@/pages/gate/FrontDesk'));
const Inside = lazy(() => import('@/pages/gate/Inside'));
const WalkIn = lazy(() => import('@/pages/gate/WalkIn'));
const RollCallPage = lazy(() => import('@/pages/gate/RollCallPage'));
const Overview = lazy(() => import('@/pages/admin/Overview'));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const BlacklistPage = lazy(() => import('@/pages/admin/BlacklistPage'));
const AuditPage = lazy(() => import('@/pages/admin/AuditPage'));

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="animate-pulse">
        <Logo />
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

function LandingOrHome() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Navigate to={homeFor(user.role)} replace /> : <Landing />;
}

const HOSTS: Role[] = ['ADMIN', 'SENIOR_MANAGER', 'MANAGER', 'HOST', 'EMPLOYEE'];
const MANAGERS: Role[] = ['SENIOR_MANAGER', 'MANAGER'];
void isHostRole;

const only = (roles: Role[], node: ReactNode) => <RequireRole roles={roles}>{node}</RequireRole>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingOrHome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pass/:token" element={<PublicPass />} />

      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/host" element={only(HOSTS, <HostToday />)} />
        <Route path="/host/new" element={only(HOSTS, <HostNewVisit />)} />
        <Route path="/host/visits" element={only(HOSTS, <VisitsPage mode="host" />)} />

        <Route path="/manage" element={only(MANAGERS, <Overview />)} />
        <Route path="/manage/team" element={only(MANAGERS, <UsersPage />)} />
        <Route path="/manage/visits" element={only(MANAGERS, <VisitsPage mode="admin" />)} />

        <Route path="/gate" element={only(['GUARD', 'ADMIN'], <FrontDesk />)} />
        <Route path="/gate/inside" element={only(['GUARD', 'ADMIN'], <Inside />)} />
        <Route path="/gate/walk-in" element={only(['GUARD', 'ADMIN'], <WalkIn />)} />
        <Route path="/gate/roll-call" element={only(['GUARD', 'ADMIN'], <RollCallPage />)} />

        <Route path="/admin" element={only(['ADMIN'], <Overview />)} />
        <Route path="/admin/visits" element={only(['ADMIN'], <VisitsPage mode="admin" />)} />
        <Route path="/admin/users" element={only(['ADMIN'], <UsersPage />)} />
        <Route path="/admin/blacklist" element={only(['ADMIN'], <BlacklistPage />)} />
        <Route path="/admin/audit" element={only(['ADMIN'], <AuditPage />)} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
