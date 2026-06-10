'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPassword } from '../../lib/api';

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
};

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(!token);

  // Sem token na URL → estado inválido imediato
  useEffect(() => {
    if (!token) setTokenInvalid(true);
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      // Redireciona para login com mensagem de sucesso
      router.replace('/login?reset=success');
    } catch (err) {
      const msg = err.message || 'Erro ao redefinir senha.';
      // Se o token já foi usado ou expirou, bloqueia o formulário
      if (
        msg.toLowerCase().includes('expirou') ||
        msg.toLowerCase().includes('utilizado') ||
        msg.toLowerCase().includes('inválido')
      ) {
        setTokenInvalid(true);
      }
      setError(msg);
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
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '2.5rem',
        background: '#ffffff',
        borderRadius: 16,
        border: '1px solid #ccd5e0',
        boxShadow: '0 25px 50px rgba(0,30,80,0.14)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 48, height: 48,
            background: '#3288e0',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: 24, color: '#fff',
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

        {tokenInvalid ? (
          /* Link inválido / expirado / já usado */
          <div>
            <div style={{
              textAlign: 'center',
              background: '#fff7ed',
              border: '1px solid #fdba74',
              borderRadius: 12,
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⏰</div>
              <p style={{ margin: 0, color: '#c2410c', fontWeight: 600, fontSize: '0.9375rem' }}>
                Link inválido ou expirado
              </p>
              <p style={{ margin: '0.5rem 0 0', color: '#9a3412', fontSize: '0.875rem', lineHeight: 1.5 }}>
                Este link de redefinição não é mais válido. Solicite um novo na tela de login.
              </p>
            </div>
            {error && <div style={S.error}>{error}</div>}
            <button
              onClick={() => router.push('/login')}
              style={{
                width: '100%', padding: '0.75rem',
                background: '#3288e0', color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Voltar ao login
            </button>
          </div>
        ) : (
          /* Formulário de nova senha */
          <form onSubmit={handleSubmit}>
            <h2 style={{
              margin: '0 0 0.5rem',
              color: '#0d1b3e', fontSize: '1.125rem', fontWeight: 700,
            }}>
              Nova senha
            </h2>
            <p style={{ margin: '0 0 1.5rem', color: '#5a7898', fontSize: '0.875rem', lineHeight: 1.55 }}>
              Escolha uma senha segura com pelo menos 8 caracteres.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={S.label}>Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
                autoComplete="new-password"
                style={S.input}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={S.label}>Confirmar nova senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                placeholder="Repita a senha"
                required
                autoComplete="new-password"
                style={S.input}
              />
            </div>

            {/* Indicador de força visual */}
            {password.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map((n) => {
                    const strength =
                      password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 4
                      : password.length >= 10 && /[A-Z0-9]/.test(password) ? 3
                      : password.length >= 8 ? 2
                      : 1;
                    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
                    return (
                      <div key={n} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: n <= strength ? colors[strength - 1] : '#e5e7eb',
                        transition: 'background 0.2s',
                      }} />
                    );
                  })}
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                  {password.length < 8 ? 'Muito curta' : password.length < 10 ? 'Aceitável' : password.length < 12 ? 'Boa' : 'Forte'}
                </p>
              </div>
            )}

            {error && <div style={S.error}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => router.push('/login')}
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
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// useSearchParams precisa de Suspense no Next.js App Router
export default function RedefinirSenhaPage() {
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
      <ResetForm />
    </Suspense>
  );
}
