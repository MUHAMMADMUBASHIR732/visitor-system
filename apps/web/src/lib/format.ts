import type { VisitStatus } from './types';

const dateTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const timeOnly = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' });
const dateOnly = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '');
export const fmtTime = (iso: string | null | undefined) => (iso ? timeOnly.format(new Date(iso)) : '');
export const fmtDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : '');

export function fmtWindow(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  const sameDay = a.toDateString() === b.toDateString();
  return sameDay ? `${fmtDate(from)}, ${fmtTime(from)} to ${fmtTime(to)}` : `${fmtDateTime(from)} to ${fmtDateTime(to)}`;
}

export function fmtDuration(minutes: number) {
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const minutesSince = (iso: string, now = Date.now()) => Math.max(0, (now - new Date(iso).getTime()) / 60_000);

export function relativeTime(iso: string, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 60_000;
  const abs = Math.abs(diff);
  const text = abs < 1 ? 'just now' : abs < 60 ? `${Math.round(abs)} min` : abs < 1440 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} d`;
  if (abs < 1) return text;
  return diff < 0 ? `${text} ago` : `in ${text}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const STATUS_LABEL: Record<VisitStatus, string> = {
  SCHEDULED: 'Expected',
  PENDING_APPROVAL: 'Needs approval',
  APPROVED: 'Approved',
  CHECKED_IN: 'Inside',
  CHECKED_OUT: 'Left',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
  NO_SHOW: 'No show',
};

/** Start of the local day as an ISO string, offset by whole days. */
export function dayBound(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};
