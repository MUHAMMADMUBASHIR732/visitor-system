import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { AppNotification, HostOption, Paged, RollCall, Summary, Visit } from './types';

export interface VisitFilters {
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  hostId?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export const useVisits = (filters: VisitFilters, enabled = true) =>
  useQuery({
    queryKey: ['visits', filters],
    queryFn: () => api<Paged<Visit>>('/visits', { query: { ...filters } }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useSummary = () => useQuery({ queryKey: ['summary'], queryFn: () => api<Summary>('/visits/summary') });

export const useInside = () => useQuery({ queryKey: ['inside'], queryFn: () => api<Visit[]>('/gate/inside'), refetchInterval: 60_000 });

/** People a visitor can see. Pass "team" to limit it to the signed-in person's own team. */
export const useHosts = (scope?: 'team') =>
  useQuery({ queryKey: ['hosts', scope ?? 'all'], queryFn: () => api<HostOption[]>('/users/hosts', { query: scope ? { scope } : undefined }), staleTime: 5 * 60_000 });

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ items: AppNotification[]; unread: number }>('/notifications'),
    refetchInterval: 120_000,
  });

export const useRollCall = () =>
  useQuery({ queryKey: ['rollcall'], queryFn: () => api<RollCall | null>('/roll-call/active'), refetchInterval: 60_000 });

/** Invalidate everything that shows visits so lists, counts and the inside list stay in step. */
export function useRefreshVisits() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['visits'] });
    void qc.invalidateQueries({ queryKey: ['inside'] });
    void qc.invalidateQueries({ queryKey: ['summary'] });
  };
}

export function useVisitAction<TVars = void>(fn: (vars: TVars) => Promise<unknown>, opts?: { onSuccess?: () => void }) {
  const refresh = useRefreshVisits();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      refresh();
      opts?.onSuccess?.();
    },
  });
}

export const visitActions = {
  cancel: (id: string) => api<Visit>(`/visits/${id}/cancel`, { method: 'PATCH' }),
  approve: (id: string) => api<Visit>(`/visits/${id}/approve`, { method: 'PATCH' }),
  reject: (id: string) => api<Visit>(`/visits/${id}/reject`, { method: 'PATCH' }),
  resend: (id: string) => api<{ sent: boolean }>(`/visits/${id}/resend`, { method: 'POST' }),
  checkOut: (id: string) => api<Visit>(`/gate/check-out/${id}`, { method: 'POST' }),
};
