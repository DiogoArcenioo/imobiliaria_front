'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { removeToken } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const validateToken = useCallback(async () => {
    try {
      const res = await fetch('/api-proxy/auth/me');
      if (!res.ok) throw new Error('invalid');
      const u = await res.json();
      setUser(u);
    } catch {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { validateToken(); }, [validateToken]);

  async function login(email, password) {
    setLoading(true);
    const res = await fetch('/api-proxy/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setLoading(false);
      throw new Error(err.message ?? 'Erro ao fazer login');
    }
    await res.json();

    const meRes = await fetch('/api-proxy/auth/me');
    if (!meRes.ok) {
      removeToken();
      setUser(null);
      setLoading(false);
      throw new Error('Não foi possível validar a sessão.');
    }

    const fullUser = await meRes.json();
    setUser(fullUser);
    setLoading(false);
    return fullUser;
  }

  function logout() {
    removeToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
