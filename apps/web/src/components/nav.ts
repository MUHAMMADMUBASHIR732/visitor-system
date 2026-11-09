import {
  BarChart3,
  CalendarPlus,
  DoorOpen,
  LayoutDashboard,
  ListChecks,
  Radio,
  ScanLine,
  ScrollText,
  ShieldBan,
  Siren,
  Users,
  UserRoundPlus,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/types';
import { isManagerRole } from '@/lib/roles';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  group?: string;
}

const host: NavItem[] = [
  { to: '/host', label: 'Today', icon: ListChecks, end: true },
  { to: '/host/new', label: 'New visit', icon: CalendarPlus },
  { to: '/host/visits', label: 'My visits', icon: ScrollText },
];

const gate: NavItem[] = [
  { to: '/gate', label: 'Front desk', icon: ScanLine, end: true },
  { to: '/gate/inside', label: 'Inside now', icon: DoorOpen },
  { to: '/gate/walk-in', label: 'Walk-in', icon: UserRoundPlus },
  { to: '/gate/roll-call', label: 'Roll call', icon: Siren },
];

const admin: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true, group: 'Manage' },
  { to: '/admin/visits', label: 'Visit log', icon: ScrollText, group: 'Manage' },
  { to: '/admin/users', label: 'People', icon: Users, group: 'Manage' },
  { to: '/admin/blacklist', label: 'Blacklist', icon: ShieldBan, group: 'Manage' },
  { to: '/admin/audit', label: 'Audit trail', icon: ListChecks, group: 'Manage' },
  ...gate.map((i) => ({ ...i, group: 'Front desk' })),
  { to: '/host/new', label: 'New visit', icon: CalendarPlus, group: 'Hosting' },
];

const manage = (role: Role): NavItem[] => [
  { to: '/manage', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Your team' },
  { to: '/manage/team', label: role === 'SENIOR_MANAGER' ? 'Managers' : 'My team', icon: Users, group: 'Your team' },
  { to: '/manage/visits', label: 'Visit log', icon: ScrollText, group: 'Your team' },
  { to: '/host', label: 'Live board', icon: Radio, end: true, group: 'Visitors' },
  { to: '/host/new', label: 'Invite visitor', icon: CalendarPlus, group: 'Visitors' },
];

export const navFor = (role: Role): NavItem[] =>
  role === 'ADMIN' ? admin : role === 'GUARD' ? gate : isManagerRole(role) ? manage(role) : host;

/** Items shown in the phone tab bar; the rest go under "More". */
export const primaryNavFor = (role: Role): NavItem[] => {
  if (role === 'ADMIN') return [admin[0], gate[0], gate[1], admin[1]];
  return navFor(role).slice(0, 4);
};
