export type Role = 'ADMIN' | 'SENIOR_MANAGER' | 'MANAGER' | 'HOST' | 'EMPLOYEE' | 'GUARD';

export type VisitStatus =
  | 'SCHEDULED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'REJECTED'
  | 'NO_SHOW';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  department: string | null;
  managerId: string | null;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  department: string | null;
  managerId: string | null;
  lockedUntil: string | null;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface HostOption {
  id: string;
  name: string;
  role: Role;
  department: string | null;
}

export interface Visit {
  id: string;
  status: VisitStatus;
  purpose: string;
  isWalkIn: boolean;
  expectedFrom: string;
  expectedTo: string;
  passCode: string | null;
  passToken: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  entryPhotoUrl: string | null;
  badgeNumber: string | null;
  vehiclePlate: string | null;
  createdAt: string;
  visitor: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    company: string | null;
    idType: string | null;
    idNumber: string | null;
  };
  host: { id: string; name: string; email: string; phone: string | null };
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Summary {
  expectedToday: number;
  insideNow: number;
  completedToday: number;
  pendingApproval: number;
}

export type Verdict = 'ALLOW' | 'ALREADY_INSIDE' | 'WAIT' | 'DENY';

export interface ScanResult {
  verdict: Verdict;
  reason: string | null;
  visit: Visit;
}

export interface PublicPass {
  status: VisitStatus;
  visitorName: string;
  company: string | null;
  hostName: string;
  purpose: string;
  expectedFrom: string;
  expectedTo: string;
  passCode: string | null;
  passToken: string | null;
}

export interface VisitorLookup {
  fullName: string;
  phone: string;
  email: string | null;
  company: string | null;
  idType: string | null;
  visits: number;
  lastVisitAt: string | null;
}

export interface BlacklistEntry {
  id: string;
  fullName: string | null;
  phone: string | null;
  idNumber: string | null;
  reason: string;
  createdAt: string;
}

export interface RollCallEntry {
  entryId: string;
  visitId: string;
  safeAt: string | null;
  badgeNumber: string | null;
  checkInAt: string | null;
  fullName: string;
  phone: string;
  company: string | null;
  photo: string | null;
  hostName: string;
  hostPhone: string | null;
}

export interface RollCall {
  id: string;
  reason: string | null;
  startedAt: string;
  endedAt: string | null;
  total: number;
  safe: number;
  missing: number;
  entries: RollCallEntry[];
}

export interface ReportSummary {
  from: string;
  to: string;
  totals: {
    total: number;
    arrived: number;
    walkIns: number;
    noShows: number;
    cancelled: number;
    avgMinutes: number;
    insideNow: number;
  };
  byDay: { day: string; visits: number; arrived: number }[];
  byHour: { hour: number; arrivals: number }[];
  topHosts: { id: string; name: string; visits: number }[];
  byStatus: { status: VisitStatus; count: number }[];
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: string | null;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  visitId: string | null;
  readAt: string | null;
  createdAt: string;
}
