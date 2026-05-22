'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        const res = await fetch('/api-proxy/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? 'Erro ao criar conta');
        }
        const data = await res.json();
        // Auto-login após registro
        await login(email, password);
      }
      router.replace('/app');
    } catch (err) {
      setError(err.message ?? 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f4f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        padding: '2.5rem',
        background: '#ffffff',
        borderRadius: 16,
        border: '1px solid #ccd5e0',
        boxShadow: '0 25px 50px rgba(0, 30, 80, 0.14)',
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 48, height: 48,
            background: '#3288e0',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: 24,
            color: '#fff',
          }}>
            T
          </div>
          <h1 style={{ color: '#0d1b3e', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Terreno
          </h1>
          <p style={{ color: '#5a7898', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Loteamentos e lotes
          </p>
        </div>

        {/* Tabs login / registro */}
        <div style={{
          display: 'flex',
          background: '#e8edf4',
          borderRadius: 8,
          padding: 4,
          marginBottom: '1.5rem',
        }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.15s',
                background: mode === m ? '#3288e0' : 'transparent',
                color: mode === m ? '#fff' : '#5a7898',
              }}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#5a7898', fontSize: '0.8125rem', marginBottom: 6 }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="seu@email.com"
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                background: '#f0f4f9',
                border: '1px solid #ccd5e0',
                borderRadius: 8,
                color: '#0d1b3e',
                fontSize: '0.9375rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#5a7898', fontSize: '0.8125rem', marginBottom: 6 }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
              minLength={mode === 'register' ? 8 : 6}
              style={{
                width: '100%',
                padding: '0.625rem 0.875rem',
                background: '#f0f4f9',
                border: '1px solid #ccd5e0',
                borderRadius: 8,
                color: '#0d1b3e',
                fontSize: '0.9375rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fff0f0',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              padding: '0.625rem 0.875rem',
              color: '#dc2626',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading ? '#1a5fa8' : '#3288e0',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1,
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #e8edf4',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: '#5a7898' }}>
            Primeira vez aqui?{' '}
            <a href="/cadastro" style={{ color: '#3288e0', fontWeight: 700, textDecoration: 'none' }}>
              Cadastrar empresa
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
