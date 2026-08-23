import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type SessionUser } from './api';

interface LinkedClient {
  id: string;
  companyName: string;
  status: string;
  accountManager: string | null;
}

interface AuthState {
  user: SessionUser | null;
  client: LinkedClient | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [client, setClient] = useState<LinkedClient | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ user: SessionUser; client: LinkedClient | null }>('/auth/me');
      setUser(data.user);
      setClient(data.client);
    } catch {
      setUser(null);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await api.post<{ user: SessionUser }>('/auth/login', { email, password });
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
    setClient(null);
  }, []);

  const setSession = useCallback((next: SessionUser) => setUser(next), []);

  const value = useMemo(
    () => ({ user, client, loading, refresh, signIn, signOut, setSession }),
    [user, client, loading, refresh, signIn, signOut, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
