import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../../../shared/authTypes';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authError: string | null;
  // Google
  loginWithGoogle: (credential: string) => Promise<boolean>;
  logout: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API = '/api/auth';

async function apiFetch(path: string, body: object): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('watchparty_token');
    if (storedToken) {
      fetch(`${API}/me`, { headers: { Authorization: `Bearer ${storedToken}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.user) {
            setToken(storedToken);
            setUser(data.user);
          } else {
            localStorage.removeItem('watchparty_token');
          }
        })
        .catch(() => localStorage.removeItem('watchparty_token'))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const persist = (t: string, u: User) => {
    setToken(t);
    setUser(u);
    localStorage.setItem('watchparty_token', t);
    localStorage.setItem('watchparty_username', u.displayName);
    localStorage.setItem('watchparty_userId', u.id);
  };

  const loginWithGoogle = async (credential: string): Promise<boolean> => {
    setAuthError(null);
    setIsLoading(true);
    const data = await apiFetch('/google', { credential }).catch(() => null);
    setIsLoading(false);
    if (!data || !data.success) { setAuthError(data?.message || 'Google sign-in failed.'); return false; }
    persist(data.token, data.user);
    return true;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('watchparty_token');
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, authError,
      loginWithGoogle, logout, clearAuthError,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
