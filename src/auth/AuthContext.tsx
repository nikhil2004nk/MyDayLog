import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponse, Credentials, User } from './authService';
import { guest, login, signup, getMe, apiLogout, updateProfile as apiUpdateProfile, changePin as apiChangePin, deleteAccount as apiDeleteAccount } from './authService';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const HAD_SESSION_KEY = 'had_session';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  initializing: boolean;
  login: (c: Credentials) => Promise<void>;
  signup: (c: Credentials) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (u: { fullName?: string; email?: string }) => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const u = localStorage.getItem(USER_KEY);
    const hadSession = localStorage.getItem(HAD_SESSION_KEY) === '1';
    if (t && u) {
      setToken(t);
      try {
        setUser(JSON.parse(u));
      } catch {
        setUser(null);
      }
    }
    (async () => {
      // Avoid unauthenticated calls on first load (prevents 401 noise on prod)
      if (!t || !hadSession) {
        setInitializing(false);
        return;
      }
      try {
        const me = await getMe();
        setUser(me);
        setToken('cookie');
      } catch {}
      setInitializing(false);
    })();
  }, []);

  useEffect(() => {
    if (token && user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }, [token, user]);

  const handleAuth = (res: AuthResponse) => {
    setToken(res.token);
    setUser(res.user);
    try { localStorage.setItem(HAD_SESSION_KEY, '1'); } catch {}
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    initializing,
    login: async (c: Credentials) => handleAuth(await login(c)),
    signup: async (c: Credentials) => { await signup(c); },
    continueAsGuest: async () => handleAuth(await guest()),
    logout: async () => {
      try { await apiLogout(); } catch {}
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(HAD_SESSION_KEY);
    },
    updateProfile: async (u) => {
      const next = await apiUpdateProfile(u);
      setUser(next);
    },
    changePin: async (currentPin, newPin) => {
      await apiChangePin(currentPin, newPin);
    },
    deleteAccount: async () => {
      await apiDeleteAccount();
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(HAD_SESSION_KEY);
    },
  }), [user, token, initializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
