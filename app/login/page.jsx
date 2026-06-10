'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { forgotPassword } from '../../lib/api';

// ── Estilos inline reutilizáveis ──────────────────────────────────────────────

const S = {
  input: {
    width: '100%',
    padding: '0.625rem 0.875rem',
    background: '#f0f4f9',
    border: '1px solid #ccd5e0',
    borderRadius: 8,
    color: '#0d1b3e',
    fontSize: '0.9375rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  label: {
    display: 'block',
    color: '#5a7898',
    fontSize: '0.8125rem',
    marginBottom: 6,
  },
  error: {
    background: '#fff0f0',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    padding: '0.625rem 0.875rem',
    color: '#dc2626',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  success: {
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: 8,
    padding: '0.625rem 0.875rem',
    color: '#15803d',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
};

// ── Modal de esqueceu a senha ─────────────────────────────────────────────────

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Fecha com ESC
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    /* overlay */
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(13, 27, 62, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 400,
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #ccd5e0',
        boxShadow: '0 25px 50px rgba(0,30,80,0.18)',
        padding: '2rem',
      }}>
        {/* cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, color: '#0d1b3e', fontSize: '1.125rem', fontWeight: 700 }}>
            Recuperar senha
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#5a7898', fontSize: 20, lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {sent ? (
          /* estado de sucesso */
          <div>
            <div style={{
              textAlign: 'center',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 12,
              padding: '1.5rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📬</div>
              <p style={{ margin: 0, color: '#15803d', fontWeight: 600, fontSize: '0.9375rem' }}>
                Verifique seu e-mail
              </p>
              <p style={{ margin: '0.5rem 0 0', color: '#166534', fontSize: '0.875rem', lineHeight: 1.5 }}>
                Se este endereço estiver cadastrado, você receberá um link de redefinição válido por <strong>1 hora</strong>.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '0.75rem',
                background: '#3288e0', color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Entendido
            </button>
          </div>
        ) : (
          /* formulário */
          <form onSubmit={handleSubmit}>
            <p style={{ margin: '0 0 1.25rem', color: '#5a7898', fontSize: '0.875rem', lineHeight: 1.55 }}>
              Digite o e-mail vinculado à sua conta. Enviaremos um link para criar uma nova senha.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={S.label}>E-mail</label>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="seu@email.com"
                required
                style={S.input}
              />
            </div>

            {error && <div style={S.error}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: '0.75rem',
                  background: '#f0f4f9', color: '#5a7898',
                  border: '1px solid #ccd5e0', borderRadius: 8,
                  fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2, padding: '0.75rem',
                  background: loading ? '#1a5fa8' : '#3288e0',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: '0.9375rem', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? 'Enviando...' : 'Enviar link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Página de login ───────────────────────────────────────────────────────────

function LoginContent() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Mensagem de sucesso vinda da página de redefinição
  const resetSuccess = searchParams.get('reset') === 'success';

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
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

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

        {/* Mensagem de sucesso pós-redefinição */}
        {resetSuccess && (
          <div style={S.success}>
            <span style={{ fontSize: 16 }}>✓</span>
            Senha redefinida com sucesso! Faça login com a nova senha.
          </div>
        )}

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
            <label style={S.label}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="seu@email.com"
              style={S.input}
            />
          </div>

          <div style={{ marginBottom: mode === 'login' ? '0.5rem' : '1.5rem' }}>
            <label style={S.label}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
              minLength={mode === 'register' ? 8 : 6}
              style={S.input}
            />
          </div>

          {/* Link "Esqueceu a senha?" — só no modo login */}
          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: '#3288e0', fontSize: '0.8125rem', fontWeight: 500,
                  cursor: 'pointer', textDecoration: 'none',
                }}
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          {error && <div style={S.error}>{error}</div>}

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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#f0f4f9', fontFamily: 'system-ui, sans-serif',
        color: '#5a7898',
      }}>
        Carregando...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
