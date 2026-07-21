'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { forgotPassword } from '../../lib/api';

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Nao foi possivel enviar o link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-modal-wrap" role="dialog" aria-modal="true">
      <button className="login-modal-backdrop" onClick={onClose} aria-label="Fechar" />
      <section className="login-modal">
        <button className="login-icon-btn login-close" onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </button>
        {sent ? (
          <div className="login-modal-body">
            <span className="login-kicker">RECUPERACAO</span>
            <h2>Verifique seu e-mail</h2>
            <p>Se o endereco estiver cadastrado, voce recebera um link para criar uma nova senha.</p>
            <button className="login-btn login-btn-primary" onClick={onClose}>Entendido</button>
          </div>
        ) : (
          <form className="login-modal-body" onSubmit={handleSubmit}>
            <span className="login-kicker">RECUPERACAO</span>
            <h2>Redefinir senha</h2>
            <p>Digite o e-mail vinculado a sua conta para receber um link de redefinicao.</p>
            <label>
              <span>E-mail</span>
              <input ref={inputRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </label>
            {error && <div className="login-error">{error}</div>}
            <div className="login-modal-actions">
              <button type="button" className="login-btn login-btn-light" onClick={onClose}>Cancelar</button>
              <button className="login-btn login-btn-primary" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function LoginContent() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'success';

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
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
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Erro ao criar conta');
        }
        await login(email, password);
      }
      router.replace('/app');
    } catch (err) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <style>{LOGIN_CSS}</style>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      <section className="login-shell">
        <aside className="login-product">
          <a href="/" className="login-logo" aria-label="Norte">
            <img src="/logo2.png" alt="Norte" />
          </a>
          <div>
            <span className="login-kicker">SISTEMA NORTE</span>
            <h1>Gestao imobiliaria com cara de produto SaaS e rotina de operacao.</h1>
            <p>Entre para acessar dashboard, mapas, clientes, vendas, predios, locacoes e relatorios.</p>
          </div>
          <ProductPreview />
        </aside>

        <section className="login-card">
          <div className="login-card-head">
            <span className="login-kicker">{mode === 'login' ? 'ACESSO' : 'NOVA CONTA'}</span>
            <h2>{mode === 'login' ? 'Entrar no sistema' : 'Criar conta'}</h2>
            <p>{mode === 'login' ? 'Use seu e-mail ou login cadastrado.' : 'Crie o primeiro acesso e conclua o cadastro da empresa.'}</p>
          </div>

          {resetSuccess && (
            <div className="login-success">Senha redefinida com sucesso. Faca login com a nova senha.</div>
          )}

          <div className="login-tabs" role="tablist" aria-label="Modo de acesso">
            <button className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
            <button className={mode === 'register' ? 'is-active' : ''} onClick={() => { setMode('register'); setError(''); }}>Criar conta</button>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              <span>E-mail ou login</span>
              <input
                type={mode === 'login' ? 'text' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'username' : 'email'}
                placeholder="seu@email.com"
              />
            </label>
            <label>
              <span>Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 8 : 6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'register' ? 'Minimo 8 caracteres' : 'Sua senha'}
              />
            </label>

            {mode === 'login' && (
              <button type="button" className="login-link-btn" onClick={() => setShowForgot(true)}>
                Esqueceu a senha?
              </button>
            )}

            {error && <div className="login-error">{error}</div>}

            <button className="login-btn login-btn-primary login-btn-full" disabled={loading}>
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <div className="login-card-foot">
            <a href="/">Voltar para a pagina inicial</a>
            <a href="/cadastro">Cadastrar empresa completa</a>
          </div>
        </section>
      </section>
    </main>
  );
}

function ProductPreview() {
  return (
    <div className="login-preview">
      <div className="login-preview-top">
        <strong>Dashboard</strong>
        <span>ao vivo</span>
      </div>
      <div className="login-preview-metrics">
        <Metric label="Vendas" value="R$ 842 mil" />
        <Metric label="Lotes" value="128" />
        <Metric label="Locacoes" value="36" />
      </div>
      <div className="login-preview-map">
        <svg viewBox="0 0 420 150" aria-hidden="true">
          <defs>
            <pattern id="login-map-bg" width="80" height="80" patternUnits="userSpaceOnUse">
              <image href="/textures/fundo.jpg" width="80" height="80" />
            </pattern>
          </defs>
          <rect width="420" height="150" fill="url(#login-map-bg)" />
          <path d="M20 110 C96 86 151 128 222 88 S330 58 398 88" fill="none" stroke="#3f4448" strokeWidth="28" strokeLinecap="round" />
          {[
            ['62,22 134,22 134,67 62,67', '#22c55e'],
            ['144,22 216,22 216,67 144,67', '#ef4444'],
            ['226,22 298,22 298,67 226,67', '#f59e0b'],
            ['308,22 380,22 380,67 308,67', '#22c55e'],
          ].map(([points, color]) => (
            <polygon key={points} points={points} fill={color} fillOpacity=".72" stroke="rgba(0,0,0,.28)" />
          ))}
        </svg>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Carregando...</div>}>
      <LoginContent />
    </Suspense>
  );
}

const LOGIN_CSS = `
  .login-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 28px;
    background:
      linear-gradient(115deg, rgba(9,17,32,.92), rgba(9,17,32,.48)),
      url('/textures/terreno.jpeg') center/cover;
    color: #101828;
    font-family: 'Manrope', system-ui, sans-serif;
    overflow: auto;
  }
  .login-page * { box-sizing: border-box; }
  .login-shell {
    width: min(1080px, 100%);
    min-height: 660px;
    display: grid;
    grid-template-columns: 1.06fr .94fr;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 34px 90px rgba(0,0,0,.34);
  }
  .login-product {
    padding: 34px;
    background:
      linear-gradient(160deg, rgba(9,17,32,.96), rgba(16,24,40,.82)),
      url('/textures/fundo.jpg') center/cover;
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 34px;
  }
  .login-logo { display: inline-flex; width: fit-content; }
  .login-logo img { height: 40px; width: auto; display: block; }
  .login-kicker {
    display: inline-flex;
    color: #3288e0;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .login-product h1 {
    max-width: 560px;
    margin: 14px 0 14px;
    font-size: clamp(34px, 4vw, 52px);
    line-height: 1.02;
    letter-spacing: 0;
  }
  .login-product p, .login-card-head p, .login-modal p {
    margin: 0;
    color: #667085;
    line-height: 1.65;
  }
  .login-product p { color: rgba(255,255,255,.68); max-width: 520px; }
  .login-preview {
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(255,255,255,.22);
    border-radius: 8px;
    padding: 16px;
    color: #101828;
  }
  .login-preview-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .login-preview-top span {
    background: #ecfdf3;
    color: #15803d;
    border: 1px solid #bbf7d0;
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 11px;
    font-weight: 900;
  }
  .login-preview-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .login-preview-metrics div {
    background: #f9fafb;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    padding: 11px;
  }
  .login-preview-metrics span { color: #667085; font-size: 11px; font-weight: 800; display: block; }
  .login-preview-metrics strong { display: block; margin-top: 5px; font-size: 16px; }
  .login-preview-map svg {
    width: 100%;
    display: block;
    border-radius: 7px;
    border: 1px solid #e4e7ec;
  }
  .login-card {
    padding: 54px 48px 36px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 18px;
  }
  .login-card-head h2, .login-modal h2 {
    margin: 10px 0 8px;
    font-size: 32px;
    line-height: 1.08;
    letter-spacing: 0;
  }
  .login-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    background: #f2f4f7;
    border: 1px solid #e4e7ec;
    padding: 4px;
    border-radius: 8px;
  }
  .login-tabs button {
    height: 38px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #667085;
    font-weight: 900;
    cursor: pointer;
    font-family: inherit;
  }
  .login-tabs .is-active {
    background: #fff;
    color: #101828;
    box-shadow: 0 1px 2px rgba(16,24,40,.08);
  }
  .login-form { display: flex; flex-direction: column; gap: 14px; }
  .login-form label, .login-modal label {
    display: grid;
    gap: 7px;
    color: #344054;
    font-size: 13px;
    font-weight: 900;
  }
  .login-form input, .login-modal input {
    height: 44px;
    width: 100%;
    border: 1px solid #d0d5dd;
    border-radius: 8px;
    padding: 0 12px;
    outline: none;
    font: inherit;
  }
  .login-form input:focus, .login-modal input:focus {
    border-color: #3288e0;
    box-shadow: 0 0 0 3px rgba(50,136,224,.14);
  }
  .login-link-btn {
    align-self: flex-end;
    border: 0;
    background: transparent;
    color: #3288e0;
    padding: 0;
    cursor: pointer;
    font-weight: 900;
    font-family: inherit;
  }
  .login-btn {
    min-height: 44px;
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 10px 16px;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
    text-decoration: none;
  }
  .login-btn:disabled { cursor: wait; opacity: .7; }
  .login-btn-primary { background: #3288e0; color: #fff; box-shadow: 0 12px 28px rgba(50,136,224,.22); }
  .login-btn-primary:hover { background: #2579ce; }
  .login-btn-light { background: #fff; color: #344054; border-color: #d0d5dd; }
  .login-btn-full { width: 100%; }
  .login-error, .login-success {
    border-radius: 8px;
    padding: 11px 12px;
    font-size: 13px;
    font-weight: 800;
  }
  .login-error { color: #b42318; background: #fff8f6; border: 1px solid #fecdca; }
  .login-success { color: #067647; background: #ecfdf3; border: 1px solid #abefc6; }
  .login-card-foot {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid #e4e7ec;
  }
  .login-card-foot a {
    color: #3288e0;
    text-decoration: none;
    font-size: 13px;
    font-weight: 900;
  }
  .login-modal-wrap {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 20px;
  }
  .login-modal-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(9,17,32,.72);
    backdrop-filter: blur(14px);
    cursor: pointer;
  }
  .login-modal {
    position: relative;
    z-index: 1;
    width: min(440px, 100%);
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 34px 90px rgba(0,0,0,.34);
  }
  .login-modal-body { padding: 36px; display: grid; gap: 16px; }
  .login-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
  .login-icon-btn {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 1px solid #e4e7ec;
    background: #fff;
    color: #475467;
    border-radius: 8px;
    cursor: pointer;
  }
  .login-close { position: absolute; right: 12px; top: 12px; }
  @media (max-width: 900px) {
    .login-page { padding: 0; place-items: stretch; }
    .login-shell { min-height: 100vh; width: 100%; border-radius: 0; grid-template-columns: 1fr; }
    .login-product { display: none; }
    .login-card { padding: 42px 24px; }
  }
  @media (max-width: 520px) {
    .login-card-foot, .login-modal-actions { flex-direction: column; }
    .login-preview-metrics { grid-template-columns: 1fr; }
  }
`;
