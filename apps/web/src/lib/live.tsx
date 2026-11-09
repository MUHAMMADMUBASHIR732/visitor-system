import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useToast } from '@/components/toast';
import { API_ORIGIN, tokenStore } from './api';
import { useAuth } from './auth';
import type { AppNotification, RollCall, Visit } from './types';

interface LiveState {
  connected: boolean;
  /** Visit ids that just changed, so rows can flash once. */
  recent: ReadonlySet<string>;
}

const LiveContext = createContext<LiveState>({ connected: false, recent: new Set() });

export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [recent, setRecent] = useState<ReadonlySet<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const lastOverdueToast = useRef(0);

  const role = user?.role;
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const token = tokenStore.get();
    if (!token) return;

    const socket = io(API_ORIGIN, { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
    socketRef.current = socket;

    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ['visits'] });
      void qc.invalidateQueries({ queryKey: ['inside'] });
      void qc.invalidateQueries({ queryKey: ['summary'] });
    };
    const flash = (v: Visit) => {
      setRecent((s) => new Set(s).add(v.id));
      window.setTimeout(
        () =>
          setRecent((s) => {
            const n = new Set(s);
            n.delete(v.id);
            return n;
          }),
        2600,
      );
    };

    socket.on('connect', () => {
      setConnected(true);
      refresh(); // catch up on anything missed while offline
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('walkin.pending', (v: Visit) => {
      flash(v);
      refresh();
      toast.info(`${v.visitor.fullName} is at reception and asked for you.`);
    });
    socket.on('visit.checked_in', (v: Visit) => {
      flash(v);
      refresh();
      
    });
    // Arrivals and departures reach the host, their manager and the senior manager as notifications.
    socket.on('notification', (n: AppNotification) => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.info(n.title);
    });
    socket.on('visit.checked_out', (v: Visit) => {
      flash(v);
      refresh();
    });
    socket.on('visit.scheduled', (v: Visit) => {
      flash(v);
      refresh();
    });
    for (const e of ['visit.cancelled', 'visit.updated', 'visits.expired']) socket.on(e, refresh);
    socket.on('walkin.approved', (v: Visit) => {
      flash(v);
      refresh();
      toast.success(`${v.host.name} approved ${v.visitor.fullName}. Ready to check in.`);
    });
    socket.on('walkin.rejected', (v: Visit) => {
      flash(v);
      refresh();
      toast.error(`${v.host.name} declined ${v.visitor.fullName}.`);
    });

    socket.on('rollcall.started', (c: RollCall) => {
      qc.setQueryData(['rollcall'], c);
      toast.error('Emergency roll call started.');
    });
    socket.on('rollcall.updated', (c: RollCall) => qc.setQueryData(['rollcall'], c));
    socket.on('rollcall.ended', (c: RollCall) => {
      qc.setQueryData(['rollcall'], null);
      void qc.invalidateQueries({ queryKey: ['rollcall'] });
      toast.info(c.missing > 0 ? `Roll call ended with ${c.missing} unaccounted for.` : 'Roll call ended. Everyone is accounted for.');
    });

    socket.on('visits.overdue', (p: { visitors: { name: string }[] }) => {
      if (role === 'HOST' || role === 'EMPLOYEE' || Date.now() - lastOverdueToast.current < 10 * 60_000) return;
      lastOverdueToast.current = Date.now();
      toast.info(`${p.visitors.length} visitor${p.visitors.length === 1 ? ' is' : 's are'} still inside past their pass time.`);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [userId, role, qc, toast]);

  const value = useMemo(() => ({ connected, recent }), [connected, recent]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
