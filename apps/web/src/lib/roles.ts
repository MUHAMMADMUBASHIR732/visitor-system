import type { Role } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  SENIOR_MANAGER: 'Senior manager',
  MANAGER: 'Manager',
  HOST: 'Host',
  EMPLOYEE: 'Employee',
  GUARD: 'Security',
};

/** Can be visited, invites visitors and approves walk-ins. */
export const isHostRole = (r?: Role) => r === 'ADMIN' || r === 'SENIOR_MANAGER' || r === 'MANAGER' || r === 'HOST' || r === 'EMPLOYEE';
/** Runs a team and sees what the team does. */
export const isManagerRole = (r?: Role) => r === 'SENIOR_MANAGER' || r === 'MANAGER';
/** Works the front desk. */
export const isGateRole = (r?: Role) => r === 'ADMIN' || r === 'GUARD';
/** Adds people to the system. */
export const canManagePeople = (r?: Role) => r === 'ADMIN' || isManagerRole(r);

/** Roles the signed-in person is allowed to add. */
export const ADDABLE: Record<Role, Role[]> = {
  ADMIN: ['SENIOR_MANAGER', 'MANAGER', 'HOST', 'EMPLOYEE', 'GUARD', 'ADMIN'],
  SENIOR_MANAGER: ['MANAGER'],
  MANAGER: ['HOST', 'EMPLOYEE'],
  HOST: [],
  EMPLOYEE: [],
  GUARD: [],
};

export const homeFor = (role: Role) =>
  role === 'ADMIN' ? '/admin' : role === 'GUARD' ? '/gate' : isManagerRole(role) ? '/manage' : '/host';
