import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export { homeFor } from './roles';

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => tokenStore.get());

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<User>('/auth/me'),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // A token the server no longer accepts should send the person back to sign in.
  useEffect(() => {
    if (me.isError && token) logout();
  }, [me.isError, token, logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ accessToken: string; user: User }>('/auth/login', {
        body: { email, password },
        auth: false,
      });
      tokenStore.set(res.accessToken);
      setToken(res.accessToken);
      qc.setQueryData(['me'], res.user);
      return res.user;
    },
    [qc],
  );

  const value = useMemo<AuthState>(
    () => ({
      user: token ? (me.data ?? null) : null,
      loading: Boolean(token) && me.isPending,
      login,
      logout,
    }),
    [token, me.data, me.isPending, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
