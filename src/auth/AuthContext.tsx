import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponse, Credentials, User } from './authService';
import { guest, login, signup } from './authService';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  initializing: boolean;
  login: (c: Credentials) => Promise<void>;
  signup: (c: Credentials) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const u = localStorage.getItem(USER_KEY);
    if (t && u) {
      setToken(t);
      try {
        setUser(JSON.parse(u));
      } catch {
        setUser(null);
      }
    }
    setInitializing(false);
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
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    initializing,
    login: async (c: Credentials) => handleAuth(await login(c)),
    signup: async (c: Credentials) => handleAuth(await signup(c)),
    continueAsGuest: async () => handleAuth(await guest()),
    logout: () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  }), [user, token, initializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
