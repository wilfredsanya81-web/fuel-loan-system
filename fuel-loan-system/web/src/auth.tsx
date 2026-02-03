import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TOKEN_KEY = 'fuel_admin_token';
const USER_KEY = 'fuel_admin_user';

interface User {
  user_id: number;
  full_name: string | null;
  phone_number: string | null;
  role: string;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  login: (phone: string, password: string) => Promise<string | null>;
  logout: () => void;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }, []);

  const login = useCallback(async (phone: string, password: string): Promise<string | null> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? 'Login failed';
    const t = data.token;
    const u = data.user;
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      if (u) setUser(u);
      return null;
    }
    return 'Invalid response';
  }, [setUser]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
