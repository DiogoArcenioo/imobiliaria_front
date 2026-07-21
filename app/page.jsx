'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getPlanos } from '../lib/api';
import { fmtBRL } from '../lib/data';
import { Building3DView } from '../components/Building3DView';

const LOGIN_URL = '/?login=1';

const productStats = [
  ['Vendas no mes', 'R$ 842 mil', '+18%'],
  ['Unidades vendidas', '47', '+9'],
  ['Reservas ativas', '23', 'hoje'],
  ['Ocupacao', '81%', 'predios'],
];

const featureRows = [
  {
    eyebrow: 'DASHBOARD REAL',
    title: 'A operacao inteira aparece em uma tela de trabalho.',
    text: 'Vendas, estoque, agenda, locacoes e performance ficam organizados para toda a equipe comercial.',
    points: ['Indicadores por empresa', 'Ultimas vendas', 'Agenda do time', 'Resumo de locacoes'],
    visual: <DashboardShot />,
  },
  {
    eyebrow: 'MAPA DE LOTEAMENTOS',
    title: 'Mapa comercial com lote, status, preco e cliente.',
    text: 'O sistema usa o cadastro real dos lotes para separar disponiveis, reservados e vendidos, sem planilha paralela.',
    points: ['Editor visual', 'Status por cor', 'Historico de negociacao', 'Link publico'],
    visual: <MapShot />,
  },
  {
    eyebrow: 'PREDIOS E LOCACOES',
    title: 'Controle de apartamentos, vendas e alugueis no mesmo painel.',
    text: 'Pronto para construtoras e imobiliarias que precisam gerenciar predios, andares, apartamentos e contratos.',
    points: ['Planta por andar', 'Apartamentos vendidos ou alugados', 'Pagamentos de locacao', 'Relatorios gerenciais'],
    visual: <BuildingShot3D />,
  },
];

const moduleCards = [
  {
    title: 'Gerenciamento de equipe',
    text: 'Controle usuarios por perfil, permissoes por modulo e acesso por empresa.',
    meta: 'Equipe e permissoes',
  },
  {
    title: 'Agenda comercial',
    text: 'Organize visitas, retornos, compromissos e tarefas ligadas a clientes e empreendimentos.',
    meta: 'Rotina do time',
  },
  {
    title: 'Loteamentos',
    text: 'Cadastre empreendimentos, desenhe lotes no mapa e acompanhe reservas, vendas e negociacoes.',
    meta: 'Mapa visual',
  },
  {
    title: 'Casas',
    text: 'Cadastre casas para venda ou aluguel, comodos, valores, cliente vinculado e historico comercial.',
    meta: 'Venda e locacao',
  },
  {
    title: 'Predios',
    text: 'Controle predios, andares, apartamentos, planta baixa, status e contratos de locacao.',
    meta: 'Apartamentos e andares',
  },
  {
    title: 'Relatorios e comercial',
    text: 'Veja funil, reservas abertas, propostas, comissoes, vendas e desempenho da equipe.',
    meta: 'Gestao da operacao',
  },
];

function useInView() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    }, { threshold: 0.18 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, visible];
}

function Logo({ light = false }) {
  return (
    <a href="/" className={`lp-logo ${light ? 'is-light' : ''}`} aria-label="ImobSys">
      <span>ImobSys</span>
    </a>
  );
}

function Navbar({ scrolled, containerRef, onLogin }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el || !containerRef.current) return;
    containerRef.current.scrollTo({ top: el.offsetTop - 70, behavior: 'smooth' });
  };

  return (
    <nav className={`lp-nav ${scrolled ? 'lp-nav-scrolled' : ''}`}>
      <Logo light={scrolled} />
      <div className="lp-nav-links">
        <button onClick={() => scrollTo('produto')}>Produto</button>
        <button onClick={() => scrollTo('funcionalidades')}>Funcionalidades</button>
        <button onClick={() => scrollTo('planos')}>Planos</button>
      </div>
      <div className="lp-nav-actions">
        <button className="lp-btn lp-btn-ghost" onClick={onLogin}>Entrar</button>
        <a className="lp-btn lp-btn-primary" href="/cadastro">Comecar agora</a>
      </div>
    </nav>
  );
}

function LoginModal({ onClose }) {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/app');
    } catch (err) {
      setError(err.message || 'Nao foi possivel entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lp-modal-shell" role="dialog" aria-modal="true">
      <button className="lp-modal-backdrop" aria-label="Fechar" onClick={onClose} />
      <section className="lp-login-modal">
        <button className="lp-icon-btn lp-modal-close" onClick={onClose} aria-label="Fechar">
          <CloseIcon />
        </button>
        <div className="lp-login-side">
          <Logo light />
          <div>
            <span className="lp-kicker">ACESSO AO SISTEMA</span>
            <h2>Entre para acompanhar sua operacao.</h2>
            <p>Dashboard, mapas, clientes, vendas, locacoes e assinatura no mesmo ambiente.</p>
          </div>
          <MiniMetricGrid />
        </div>
        <form className="lp-login-form" onSubmit={handleSubmit}>
          <div>
            <span className="lp-kicker">LOGIN</span>
            <h3>Bem-vindo de volta</h3>
            <p>Use o e-mail ou login cadastrado na sua empresa.</p>
          </div>
          <label>
            <span>E-mail ou login</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            <span>Senha</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
          </label>
          {error && <div className="lp-error">{error}</div>}
          <button className="lp-btn lp-btn-primary lp-btn-full" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <div className="lp-login-foot">
            <a href="/login">Esqueceu a senha?</a>
            <a href="/cadastro">Cadastrar empresa</a>
          </div>
        </form>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <section className="lp-hero" id="produto">
      <div className="lp-hero-copy">
        <span className="lp-kicker">SAAS PARA IMOBILIARIAS, LOTEADORAS E CONSTRUTORAS</span>
        <h1>ImobSys organiza vendas, estoque, mapas e locacoes em um painel unico.</h1>
        <p>
          Um sistema operacional para sua imobiliaria trabalhar com dados reais:
          loteamentos, casas, predios, clientes, equipe, agenda, contratos, relatorios e planos de acesso.
        </p>
        <div className="lp-hero-actions">
          <a className="lp-btn lp-btn-primary lp-btn-lg" href="/cadastro">Criar empresa</a>
          <a className="lp-btn lp-btn-dark lp-btn-lg" href={LOGIN_URL}>Entrar no sistema</a>
        </div>
        <div className="lp-trust-row">
          {['Mapa visual', 'CRM comercial', 'Assinatura por plano', 'Multiempresa'].map((item) => (
            <span key={item}><CheckIcon />{item}</span>
          ))}
        </div>
      </div>
      <div className="lp-hero-media" aria-label="Previa do sistema ImobSys">
        <ProductShell active="Dashboard">
          <DashboardShot large />
        </ProductShell>
      </div>
    </section>
  );
}

function MiniMetricGrid() {
  return (
    <div className="lp-mini-grid">
      {productStats.map(([label, value, sub]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <em>{sub}</em>
        </div>
      ))}
    </div>
  );
}

function ProductShell({ children, active }) {
  return (
    <div className="lp-product-shell">
      <aside>
        <div className="lp-shell-logo">I</div>
        {['Dashboard', 'Loteamentos', 'Casas', 'Predios', 'Agenda', 'Equipe'].map((item) => (
          <span key={item} className={item === active ? 'is-active' : ''}>{item}</span>
        ))}
      </aside>
      <main>
        <div className="lp-shell-top">
          <span>{active}</span>
          <div>
            <i />
            <i />
            <i />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function DashboardShot({ large = false }) {
  return (
    <div className={`lp-dashboard-shot ${large ? 'is-large' : ''}`}>
      <div className="lp-shot-header">
        <div>
          <span>HOJE</span>
          <strong>Boa tarde, equipe.</strong>
        </div>
        <button>Atualizar</button>
      </div>
      <MiniMetricGrid />
      <div className="lp-sales-panel">
        <div className="lp-panel-head">
          <strong>Ultimas vendas</strong>
          <span>R$ 842 mil</span>
        </div>
        {[
          ['Lote 12', 'Jardim Norte', 'R$ 180 mil'],
          ['Apto 204', 'Residencial Lago', 'R$ 420 mil'],
          ['Lote 08', 'Nova Praca', 'R$ 242 mil'],
        ].map(([code, name, value]) => (
          <div className="lp-sale-row" key={code}>
            <b>{code}</b>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapShot() {
  const lots = [
    ['A01', 18, 20, 74, 48, 'sold'],
    ['A02', 92, 20, 74, 48, 'reserved'],
    ['A03', 166, 20, 74, 48, 'available'],
    ['A04', 240, 20, 74, 48, 'available'],
    ['A05', 314, 20, 74, 48, 'reserved'],
    ['A06', 388, 20, 74, 48, 'available'],
    ['A07', 18, 116, 74, 48, 'available'],
    ['A08', 92, 116, 74, 48, 'available'],
    ['A09', 166, 116, 74, 48, 'sold'],
    ['A10', 240, 116, 74, 48, 'available'],
    ['A11', 314, 116, 74, 48, 'available'],
    ['A12', 388, 116, 74, 48, 'reserved'],
    ['A13', 388, 178, 74, 60, 'available'],
    ['A14', 388, 248, 74, 60, 'sold'],
  ];
  const trees = [
    [48, 194, 8], [104, 218, 11], [157, 194, 9], [242, 222, 12],
    [294, 194, 8], [337, 222, 10], [350, 188, 7], [202, 246, 8],
  ];
  return (
    <div className="lp-map-shot">
      <svg viewBox="0 0 520 330" role="img" aria-label="Mapa real de loteamento do sistema">
        <defs>
          <pattern id="lp-map-bg-real" width="90" height="90" patternUnits="userSpaceOnUse">
            <image href="/textures/fundo.jpg" width="90" height="90" preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <filter id="lp-map-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity=".18" />
          </filter>
          <linearGradient id="lp-park-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7fba4b" stopOpacity=".78" />
            <stop offset="1" stopColor="#5c9b37" stopOpacity=".82" />
          </linearGradient>
        </defs>
        <rect width="520" height="330" fill="url(#lp-map-bg-real)" />
        <g opacity=".16" stroke="#fff" strokeWidth="1">
          {Array.from({ length: 9 }).map((_, i) => <line key={`v-${i}`} x1={i * 65} y1="0" x2={i * 65} y2="330" />)}
          {Array.from({ length: 6 }).map((_, i) => <line key={`h-${i}`} x1="0" y1={i * 65} x2="520" y2={i * 65} />)}
        </g>
        <path d="M18 92 H487 V292" fill="none" stroke="#d9d6bd" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" filter="url(#lp-map-shadow)" />
        <path d="M18 92 H487 V292" fill="none" stroke="#41474b" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
        <g stroke="#d7d0a8" strokeWidth="1.2" strokeDasharray="10 9" opacity=".9">
          <path d="M20 92 H487 V292" fill="none" />
        </g>
        <rect x="18" y="178" width="352" height="130" rx="5" fill="url(#lp-park-fill)" stroke="rgba(50,86,37,.45)" />
        <path d="M33 289 C91 267 135 296 190 276 S287 269 355 284" fill="none" stroke="#d8cda7" strokeWidth="7" strokeLinecap="round" opacity=".72" />
        <rect x="34" y="216" width="61" height="70" rx="8" fill="#4b9eae" stroke="#76583c" strokeWidth="3" />
        <path d="M39 230 C52 222 75 224 90 232" fill="none" stroke="#79c6d2" strokeWidth="2" opacity=".8" />
        <text x="64.5" y="255" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800" fontStyle="italic">Lago</text>
        <g transform="translate(256 252)">
          <circle r="23" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.45)" strokeDasharray="3 3" />
          <circle r="7" fill="#d9c694" />
          <path d="M-13 0 H13 M0 -13 V13" stroke="#f5ead0" strokeWidth="3" strokeLinecap="round" />
        </g>
        <text x="256" y="286" textAnchor="middle" fill="#315d27" fontSize="9" fontWeight="800">PRACA CENTRAL</text>
        {trees.map(([cx, cy, r]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={r} fill="#4c7f2e" />
            <circle cx={cx - r * .35} cy={cy + r * .18} r={r * .62} fill="#6ba53a" opacity=".8" />
            <circle cx={cx + r * .36} cy={cy - r * .18} r={r * .58} fill="#356b24" opacity=".8" />
          </g>
        ))}
        {lots.map(([label, x, y, w, h, status]) => (
          <g key={label}>
            <rect x={x} y={y} width={w} height={h} className={`lp-lot-${status}`} />
            <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" fill="#1a1f24" fontSize="8.5" fontFamily="JetBrains Mono" fontWeight="600">{label}</text>
          </g>
        ))}
      </svg>
      <div className="lp-map-legend">
        <span><i className="available" />Disponivel</span>
        <span><i className="reserved" />Reservado</span>
        <span><i className="sold" />Vendido</span>
      </div>
    </div>
  );
}

function BuildingShot() {
  return (
    <div className="lp-building-shot">
      <div className="lp-building-visual">
        <img src="/textures/predio/exterior-glass.jpg" alt="" />
        <div className="lp-building-card">
          <strong>Residencial Lago</strong>
          <span>12 andares · 72 apartamentos</span>
        </div>
      </div>
      <div className="lp-floor-grid">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} className={index % 5 === 0 ? 'sold' : index % 4 === 0 ? 'rented' : index % 3 === 0 ? 'reserved' : ''}>
            {String(index + 1).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}

function BuildingShot3D() {
  const previewPredio = {
    nome: 'Residencial Lago',
    cor: '#3288e0',
    footprint_cols: 8,
    footprint_rows: 5,
    num_andares: 6,
    andares: [
      { numero: 1, stats: { total: 8, disponivel: 3 } },
      { numero: 2, stats: { total: 8, disponivel: 4 } },
      { numero: 3, stats: { total: 8, disponivel: 4 } },
      { numero: 4, stats: { total: 8, disponivel: 4 } },
      { numero: 5, stats: { total: 8, disponivel: 4 } },
      { numero: 6, stats: { total: 8, disponivel: 2 } },
    ],
  };

  return (
    <div className="lp-building-shot lp-building-shot-3d">
      <Building3DView predio={previewPredio} />
    </div>
  );
}

function ModulesSection() {
  const [ref, visible] = useInView();
  return (
    <section id="funcionalidades" ref={ref} className={`lp-modules ${visible ? 'is-visible' : ''}`}>
      <div className="lp-section-head">
        <span className="lp-kicker">FUNCIONALIDADES REAIS</span>
        <h2>Um sistema para operar estoque, equipe e atendimento sem espalhar informacao.</h2>
        <p>Os modulos trabalham juntos: cadastro do empreendimento, equipe responsavel, agenda, negociacao e fechamento.</p>
      </div>
      <div className="lp-module-layout">
        <div className="lp-module-grid">
          {moduleCards.map((item) => (
            <article className="lp-module-card" key={item.title}>
              <span>{item.meta}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <div className="lp-module-panel" aria-hidden="true">
          <div className="lp-module-panel-head">
            <strong>Agenda da equipe</strong>
            <span>Hoje</span>
          </div>
          {[
            ['09:00', 'Visita Casa Jardim', 'Ronaldo'],
            ['11:30', 'Proposta lote Q12', 'Marina'],
            ['14:00', 'Contrato apto 204', 'Equipe'],
          ].map(([time, task, owner]) => (
            <div className="lp-agenda-row" key={task}>
              <b>{time}</b>
              <span>{task}</span>
              <em>{owner}</em>
            </div>
          ))}
          <div className="lp-module-stock">
            <div><span>Loteamentos</span><strong>12</strong></div>
            <div><span>Casas</span><strong>36</strong></div>
            <div><span>Predios</span><strong>8</strong></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ item, index }) {
  const [ref, visible] = useInView();
  return (
    <section ref={ref} className={`lp-feature ${index % 2 ? 'is-reverse' : ''} ${visible ? 'is-visible' : ''}`}>
      <div className="lp-feature-copy">
        <span className="lp-kicker">{item.eyebrow}</span>
        <h2>{item.title}</h2>
        <p>{item.text}</p>
        <div className="lp-point-grid">
          {item.points.map((point) => (
            <span key={point}><CheckIcon />{point}</span>
          ))}
        </div>
      </div>
      <div className="lp-feature-media">
        {item.visual}
      </div>
    </section>
  );
}

function Pricing() {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ref, visible] = useInView();

  useEffect(() => {
    let alive = true;
    getPlanos()
      .then((data) => {
        if (!alive) return;
        setPlanos(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || 'Nao foi possivel carregar os planos.');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <section id="planos" ref={ref} className={`lp-pricing ${visible ? 'is-visible' : ''}`}>
      <div className="lp-section-head">
        <span className="lp-kicker">PLANOS DO BANCO</span>
        <h2>Planos flexiveis para acompanhar cada momento da sua empresa.</h2>
        <p>Escolha o plano que melhor acompanha o momento e o crescimento da sua empresa.</p>
      </div>

      {loading && <div className="lp-plan-state">Carregando planos cadastrados...</div>}
      {!loading && error && <div className="lp-plan-state is-error">{error}</div>}
      {!loading && !error && planos.length === 0 && (
        <div className="lp-plan-state">Nenhum plano ativo cadastrado no momento.</div>
      )}
      {!loading && !error && planos.length > 0 && (
        <div className="lp-plan-grid">
          {planos.map((plano) => (
            <article key={plano.id} className={`lp-plan ${plano.destaque ? 'is-featured' : ''}`} style={{ '--plan-color': plano.cor || '#3288e0' }}>
              {plano.destaque && <span className="lp-plan-badge">Recomendado</span>}
              <div>
                <span className="lp-plan-name">{plano.nome}</span>
                <div className="lp-plan-price">
                  <strong>{fmtBRL(plano.preco_mensal)}</strong>
                  <span>/mes</span>
                </div>
                {Number(plano.preco_anual) > 0 && <p className="lp-plan-annual">ou {fmtBRL(plano.preco_anual)}/ano</p>}
                {plano.descricao && <p className="lp-plan-desc">{plano.descricao}</p>}
              </div>
              <div className="lp-plan-limits">
                <span>{plano.max_usuarios != null ? `${plano.max_usuarios} usuarios` : 'Usuarios ilimitados'}</span>
                <span>{plano.max_loteamentos != null ? `${plano.max_loteamentos} loteamentos` : 'Loteamentos ilimitados'}</span>
                <span>{plano.max_predios != null ? `${plano.max_predios} predios` : 'Predios ilimitados'}</span>
              </div>
              {Array.isArray(plano.recursos) && plano.recursos.length > 0 && (
                <ul>
                  {plano.recursos.map((recurso, index) => (
                    <li key={`${recurso}-${index}`}><CheckIcon />{recurso}</li>
                  ))}
                </ul>
              )}
              <a className="lp-btn lp-btn-primary lp-btn-full" href="/cadastro">Escolher plano</a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CTA() {
  return (
    <section className="lp-cta">
      <div>
        <span className="lp-kicker">PRONTO PARA OPERAR</span>
        <h2>Troque planilhas soltas por um sistema onde o comercial trabalha no dado certo.</h2>
      </div>
      <div className="lp-cta-actions">
        <a className="lp-btn lp-btn-primary lp-btn-lg" href="/cadastro">Criar empresa</a>
        <a className="lp-btn lp-btn-dark lp-btn-lg" href={LOGIN_URL}>Ja tenho conta</a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <Logo light />
      <span>© {new Date().getFullYear()} ImobSys. Sistema imobiliario.</span>
      <div>
        <a href={LOGIN_URL}>Entrar</a>
        <a href="/cadastro">Cadastrar</a>
      </div>
    </footer>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);

  const openLogin = () => {
    setShowLogin(true);
    const url = new URL(window.location.href);
    url.searchParams.set('login', '1');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const closeLogin = () => {
    setShowLogin(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('login');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1' || params.get('login') === 'true') setShowLogin(true);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 24);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={scrollRef} className="lp-page">
      <style>{LANDING_CSS}</style>
      {showLogin && <LoginModal onClose={closeLogin} />}
      <Navbar scrolled={scrolled} containerRef={scrollRef} onLogin={openLogin} />
      <Hero />
      <section className="lp-proof">
        <span>Fluxos reais do sistema</span>
        <strong>Loteamentos</strong>
        <strong>Casas</strong>
        <strong>Predios</strong>
        <strong>Clientes</strong>
        <strong>Equipe</strong>
        <strong>Agenda</strong>
        <strong>Vendas</strong>
        <strong>Locacoes</strong>
        <strong>Assinaturas</strong>
      </section>
      <ModulesSection />
      {featureRows.map((item, index) => <FeatureRow key={item.eyebrow} item={item} index={index} />)}
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

const LANDING_CSS = `
  .lp-page {
    position: fixed;
    inset: 0;
    overflow: auto;
    background: #f6f8fb;
    color: #101828;
    font-family: 'Manrope', system-ui, sans-serif;
  }
  .lp-page * { box-sizing: border-box; }
  .lp-page a { color: inherit; }
  .lp-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    min-height: 70px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 18px;
    padding: 14px max(22px, calc((100vw - 1180px) / 2));
    color: #ffffff;
    transition: background .2s, border-color .2s, color .2s;
    border-bottom: 1px solid transparent;
  }
  .lp-nav-scrolled {
    background: rgba(255,255,255,.94);
    color: #101828;
    border-color: #e4e7ec;
    backdrop-filter: blur(16px);
  }
  .lp-logo {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    text-decoration: none;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0;
    color: inherit;
  }
  .lp-logo span {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
  }
  .lp-nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; }
  .lp-nav-links button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    padding: 9px 12px;
    border-radius: 7px;
  }
  .lp-nav-links button:hover { background: rgba(255,255,255,.14); }
  .lp-nav-scrolled .lp-nav-links button:hover { background: #f2f4f7; }
  .lp-nav-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .lp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 9px 16px;
    border-radius: 8px;
    border: 1px solid transparent;
    text-decoration: none;
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    transition: transform .16s, box-shadow .16s, background .16s, border-color .16s;
  }
  .lp-btn:hover { transform: translateY(-1px); }
  .lp-btn:disabled { cursor: wait; opacity: .7; transform: none; }
  .lp-btn-lg { min-height: 48px; padding: 12px 20px; font-size: 14px; }
  .lp-btn-full { width: 100%; }
  .lp-page .lp-btn-primary { background: #3288e0; color: #fff; box-shadow: 0 12px 28px rgba(50,136,224,.24); }
  .lp-page .lp-btn-primary:hover { background: #2579ce; color: #fff; }
  .lp-page .lp-btn-dark { background: #101828; color: #fff; border-color: #101828; }
  .lp-page .lp-btn-dark:hover { background: #1d2939; border-color: #1d2939; color: #fff; }
  .lp-btn-ghost { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.22); color: inherit; }
  .lp-nav-scrolled .lp-btn-ghost { background: #fff; border-color: #d0d5dd; color: #344054; }
  .lp-hero {
    min-height: 92vh;
    padding: 118px max(22px, calc((100vw - 1180px) / 2)) 70px;
    margin-top: -70px;
    display: grid;
    grid-template-columns: minmax(0, .88fr) minmax(0, 1.12fr);
    gap: 46px;
    align-items: center;
    background:
      linear-gradient(110deg, rgba(9, 17, 32, .92) 0%, rgba(12, 22, 41, .84) 46%, rgba(12, 22, 41, .35) 100%),
      url('/textures/terreno.jpeg') center/cover;
    color: #fff;
  }
  .lp-kicker {
    display: inline-flex;
    color: #3288e0;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .lp-hero h1 {
    margin: 16px 0 18px;
    font-size: clamp(40px, 5.4vw, 72px);
    line-height: .97;
    letter-spacing: 0;
    font-weight: 900;
    max-width: 780px;
  }
  .lp-hero p {
    max-width: 620px;
    margin: 0;
    color: rgba(255,255,255,.74);
    font-size: 17px;
    line-height: 1.72;
  }
  .lp-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
  .lp-trust-row { display: flex; flex-wrap: wrap; gap: 12px 18px; margin-top: 26px; }
  .lp-trust-row span, .lp-point-grid span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: inherit;
    font-size: 13px;
    font-weight: 800;
  }
  .lp-trust-row svg, .lp-point-grid svg { color: #22c55e; }
  .lp-hero-media { min-width: 0; }
  .lp-product-shell {
    display: grid;
    grid-template-columns: 156px minmax(0, 1fr);
    min-height: 500px;
    background: #fff;
    color: #101828;
    border: 1px solid rgba(255,255,255,.24);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 34px 90px rgba(0,0,0,.34);
  }
  .lp-product-shell aside {
    background: #091120;
    color: rgba(255,255,255,.72);
    padding: 18px 12px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .lp-shell-logo {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: #3288e0;
    color: #fff;
    font-weight: 900;
    margin-bottom: 12px;
  }
  .lp-product-shell aside span {
    padding: 9px 10px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 800;
  }
  .lp-product-shell aside .is-active { background: rgba(255,255,255,.12); color: #fff; }
  .lp-product-shell main { min-width: 0; background: #f4f7fb; display: flex; flex-direction: column; }
  .lp-shell-top {
    height: 52px;
    border-bottom: 1px solid #e4e7ec;
    background: rgba(255,255,255,.9);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
    font-weight: 900;
  }
  .lp-shell-top div { display: flex; gap: 6px; }
  .lp-shell-top i { width: 8px; height: 8px; border-radius: 50%; background: #98a2b3; display: block; }
  .lp-dashboard-shot { padding: 18px; display: grid; gap: 14px; }
  .lp-dashboard-shot.is-large { padding: 22px; gap: 16px; }
  .lp-shot-header, .lp-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .lp-shot-header span, .lp-mini-grid span, .lp-sale-row span, .lp-plan-annual {
    color: #667085;
    font-size: 12px;
    font-weight: 700;
  }
  .lp-shot-header strong { display: block; font-size: 24px; letter-spacing: 0; }
  .lp-shot-header button {
    border: 1px solid #d0d5dd;
    background: #fff;
    color: #344054;
    border-radius: 7px;
    padding: 7px 12px;
    font-weight: 800;
  }
  .lp-mini-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .lp-mini-grid div, .lp-sales-panel, .lp-plan, .lp-plan-state {
    background: #fff;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
  }
  .lp-mini-grid div { padding: 14px; min-width: 0; }
  .lp-mini-grid strong { display: block; font-size: 20px; line-height: 1.1; margin-top: 5px; }
  .lp-mini-grid em { display: block; color: #3288e0; font-size: 11px; font-style: normal; font-weight: 900; margin-top: 8px; }
  .lp-sales-panel { padding: 16px; }
  .lp-panel-head { margin-bottom: 10px; }
  .lp-panel-head span { color: #3288e0; font-weight: 900; }
  .lp-sale-row {
    display: grid;
    grid-template-columns: 90px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-top: 1px solid #eef2f6;
    font-size: 13px;
  }
  .lp-sale-row strong { font-size: 13px; }
  .lp-proof {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px 30px;
    padding: 28px 22px;
    background: #fff;
    border-bottom: 1px solid #e4e7ec;
  }
  .lp-proof span { color: #667085; font-weight: 800; }
  .lp-proof strong { color: #101828; }
  .lp-modules {
    padding: 86px max(22px, calc((100vw - 1180px) / 2));
    background: #f6f8fb;
    border-bottom: 1px solid #e4e7ec;
    opacity: 0;
    transform: translateY(18px);
    transition: opacity .45s, transform .45s;
  }
  .lp-modules.is-visible { opacity: 1; transform: none; }
  .lp-module-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr);
    gap: 22px;
    align-items: stretch;
  }
  .lp-module-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .lp-module-card {
    min-width: 0;
    background: #fff;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    padding: 18px;
    box-shadow: 0 14px 36px rgba(16,24,40,.05);
  }
  .lp-module-card span {
    color: #3288e0;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .lp-module-card h3 {
    margin: 10px 0 8px;
    color: #101828;
    font-size: 18px;
    line-height: 1.18;
    letter-spacing: 0;
  }
  .lp-module-card p {
    margin: 0;
    color: #667085;
    line-height: 1.58;
    font-size: 13.5px;
  }
  .lp-module-panel {
    background: #091120;
    color: #fff;
    border-radius: 8px;
    padding: 20px;
    display: grid;
    align-content: start;
    gap: 12px;
    box-shadow: 0 22px 60px rgba(9,17,32,.18);
  }
  .lp-module-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 6px;
  }
  .lp-module-panel-head strong { font-size: 20px; }
  .lp-module-panel-head span {
    color: #9ecbff;
    font-size: 12px;
    font-weight: 900;
  }
  .lp-agenda-row {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    background: rgba(255,255,255,.06);
  }
  .lp-agenda-row b { color: #9ecbff; font-size: 13px; }
  .lp-agenda-row span { min-width: 0; font-size: 13px; font-weight: 800; }
  .lp-agenda-row em {
    color: rgba(255,255,255,.68);
    font-size: 12px;
    font-style: normal;
    font-weight: 800;
  }
  .lp-module-stock {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 8px;
  }
  .lp-module-stock div {
    background: #fff;
    color: #101828;
    border-radius: 8px;
    padding: 13px;
  }
  .lp-module-stock span {
    display: block;
    color: #667085;
    font-size: 11px;
    font-weight: 800;
    margin-bottom: 5px;
  }
  .lp-module-stock strong { font-size: 24px; line-height: 1; }
  .lp-feature {
    display: grid;
    grid-template-columns: minmax(0, .88fr) minmax(0, 1.12fr);
    gap: 48px;
    align-items: center;
    padding: 92px max(22px, calc((100vw - 1180px) / 2));
    opacity: 0;
    transform: translateY(18px);
    transition: opacity .45s, transform .45s;
  }
  .lp-feature.is-visible { opacity: 1; transform: none; }
  .lp-feature.is-reverse .lp-feature-copy { order: 2; }
  .lp-feature h2, .lp-section-head h2, .lp-cta h2 {
    margin: 12px 0 14px;
    color: #101828;
    font-size: clamp(28px, 3.5vw, 46px);
    line-height: 1.05;
    letter-spacing: 0;
    font-weight: 900;
  }
  .lp-feature p, .lp-section-head p {
    margin: 0;
    color: #667085;
    font-size: 16px;
    line-height: 1.72;
  }
  .lp-point-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 24px;
  }
  .lp-feature-media {
    min-width: 0;
    background: #fff;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    padding: 14px;
    box-shadow: 0 20px 60px rgba(16,24,40,.08);
  }
  .lp-map-shot svg {
    width: 100%;
    display: block;
    border-radius: 7px;
    overflow: hidden;
    background: #78ad3c;
  }
  .lp-lot-available { fill: #b0b8c1; fill-opacity: .62; stroke: #999; stroke-width: 1.2; }
  .lp-lot-reserved { fill: #ffbb00; fill-opacity: .62; stroke: #999; stroke-width: 1.2; }
  .lp-lot-sold { fill: #e84040; fill-opacity: .62; stroke: #999; stroke-width: 1.2; }
  .lp-map-legend { display: flex; flex-wrap: wrap; gap: 14px; padding: 14px 4px 2px; color: #475467; font-size: 12px; font-weight: 800; }
  .lp-map-legend span { display: inline-flex; align-items: center; gap: 7px; }
  .lp-map-legend i { width: 10px; height: 10px; border-radius: 3px; display: block; }
  .lp-map-legend .available { background: #b0b8c1; }
  .lp-map-legend .reserved { background: #ffbb00; }
  .lp-map-legend .sold { background: #e84040; }
  .lp-building-shot { display: grid; grid-template-columns: 1.1fr .9fr; gap: 14px; }
  .lp-building-shot-3d {
    display: block;
    padding: 4px 0 0;
  }
  .lp-building-shot-3d .building-3d-wrap {
    width: 100%;
  }
  .lp-building-shot-3d .building-3d-svg {
    width: 100%;
    height: auto;
    margin: 0 auto;
  }
  .lp-building-shot-3d .b3d-legend {
    justify-content: center;
  }
  .lp-building-visual { position: relative; min-height: 280px; border-radius: 7px; overflow: hidden; background: #101828; }
  .lp-building-visual img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .86; }
  .lp-building-card {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 14px;
    background: rgba(255,255,255,.93);
    border-radius: 8px;
    padding: 12px;
    display: grid;
    gap: 3px;
  }
  .lp-building-card span { color: #667085; font-size: 12px; font-weight: 800; }
  .lp-floor-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .lp-floor-grid span {
    min-height: 44px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    background: #ecfdf3;
    color: #15803d;
    font-weight: 900;
    font-size: 12px;
    border: 1px solid #bbf7d0;
  }
  .lp-floor-grid .sold { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  .lp-floor-grid .reserved { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .lp-floor-grid .rented { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
  .lp-pricing {
    padding: 96px max(22px, calc((100vw - 1180px) / 2));
    background: #fff;
    border-top: 1px solid #e4e7ec;
    opacity: 0;
    transform: translateY(18px);
    transition: opacity .45s, transform .45s;
  }
  .lp-pricing.is-visible { opacity: 1; transform: none; }
  .lp-section-head { max-width: 720px; margin-bottom: 34px; }
  .lp-section-head code { color: #344054; background: #f2f4f7; border: 1px solid #e4e7ec; padding: 2px 6px; border-radius: 5px; }
  .lp-plan-state { padding: 18px; color: #667085; font-weight: 800; }
  .lp-plan-state.is-error { color: #b42318; background: #fff8f6; border-color: #fecdca; }
  .lp-plan-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
    gap: 18px;
    align-items: stretch;
  }
  .lp-plan {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 28px 24px 24px;
    min-height: 100%;
    border-top: 4px solid var(--plan-color);
  }
  .lp-plan.is-featured { box-shadow: 0 18px 50px rgba(16,24,40,.12); transform: translateY(-5px); }
  .lp-plan-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    background: var(--plan-color);
    color: #fff;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
    padding: 5px 9px;
    border-radius: 999px;
  }
  .lp-plan-name { color: var(--plan-color); font-weight: 900; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
  .lp-plan-price { display: flex; align-items: baseline; gap: 6px; margin-top: 14px; }
  .lp-plan-price strong { font-size: 34px; line-height: 1; letter-spacing: 0; }
  .lp-plan-price span, .lp-plan-desc { color: #667085; }
  .lp-plan-desc { line-height: 1.58; margin: 12px 0 0; }
  .lp-plan-limits { display: grid; gap: 8px; padding: 14px; border-radius: 8px; background: #f9fafb; color: #475467; font-size: 13px; font-weight: 800; }
  .lp-plan ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  .lp-plan li { display: flex; gap: 8px; align-items: flex-start; color: #344054; font-size: 13px; font-weight: 700; }
  .lp-plan li svg { color: #22c55e; margin-top: 2px; flex: 0 0 auto; }
  .lp-plan .lp-btn { margin-top: auto; }
  .lp-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
    padding: 64px max(22px, calc((100vw - 1180px) / 2));
    background: #eef6ff;
    border-top: 1px solid #bfdbfe;
  }
  .lp-cta h2 { max-width: 760px; margin-bottom: 0; }
  .lp-cta-actions { display: flex; gap: 10px; flex-wrap: wrap; flex: 0 0 auto; }
  .lp-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 28px max(22px, calc((100vw - 1180px) / 2));
    background: #091120;
    color: rgba(255,255,255,.62);
  }
  .lp-footer div { display: flex; gap: 18px; }
  .lp-footer a { text-decoration: none; font-weight: 800; color: rgba(255,255,255,.8); }
  .lp-modal-shell { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 20px; }
  .lp-modal-backdrop { position: absolute; inset: 0; border: 0; background: rgba(9,17,32,.72); backdrop-filter: blur(14px); cursor: pointer; }
  .lp-login-modal {
    position: relative;
    z-index: 1;
    width: min(920px, 100%);
    display: grid;
    grid-template-columns: .95fr 1.05fr;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 34px 90px rgba(0,0,0,.36);
  }
  .lp-modal-close { position: absolute; right: 12px; top: 12px; z-index: 2; }
  .lp-icon-btn {
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
  .lp-login-side {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 28px;
    min-height: 520px;
    padding: 34px;
    background:
      linear-gradient(160deg, rgba(9,17,32,.95), rgba(16,24,40,.82)),
      url('/textures/fundo.jpg') center/cover;
    color: #fff;
  }
  .lp-login-side h2 { font-size: 36px; line-height: 1.04; margin: 12px 0; letter-spacing: 0; }
  .lp-login-side p { color: rgba(255,255,255,.7); line-height: 1.7; margin: 0; }
  .lp-login-side .lp-mini-grid { grid-template-columns: repeat(2, 1fr); }
  .lp-login-form { padding: 54px 44px 40px; display: flex; flex-direction: column; justify-content: center; gap: 16px; }
  .lp-login-form h3 { margin: 8px 0 5px; font-size: 28px; letter-spacing: 0; }
  .lp-login-form p { margin: 0; color: #667085; line-height: 1.6; }
  .lp-login-form label { display: grid; gap: 7px; font-weight: 800; color: #344054; font-size: 13px; }
  .lp-login-form input {
    width: 100%;
    height: 44px;
    border: 1px solid #d0d5dd;
    border-radius: 8px;
    padding: 0 12px;
    color: #101828;
    outline: none;
    font: inherit;
    background: #fff;
  }
  .lp-login-form input:focus { border-color: #3288e0; box-shadow: 0 0 0 3px rgba(50,136,224,.14); }
  .lp-error { background: #fff8f6; border: 1px solid #fecdca; color: #b42318; border-radius: 8px; padding: 11px 12px; font-weight: 700; font-size: 13px; }
  .lp-login-foot { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #e4e7ec; padding-top: 16px; }
  .lp-login-foot a { color: #3288e0; font-weight: 800; text-decoration: none; font-size: 13px; }
  @media (max-width: 980px) {
    .lp-nav { grid-template-columns: 1fr auto; }
    .lp-nav-links { display: none; }
    .lp-hero, .lp-feature, .lp-feature.is-reverse, .lp-cta { grid-template-columns: 1fr; }
    .lp-feature.is-reverse .lp-feature-copy { order: 0; }
    .lp-hero { padding-top: 112px; }
    .lp-product-shell { grid-template-columns: 1fr; min-height: 0; }
    .lp-product-shell aside { display: none; }
    .lp-module-layout { grid-template-columns: 1fr; }
    .lp-cta { display: grid; }
  }
  @media (max-width: 720px) {
    .lp-nav-actions .lp-btn-primary { display: none; }
    .lp-hero h1 { font-size: 42px; }
    .lp-mini-grid, .lp-point-grid, .lp-building-shot, .lp-login-modal, .lp-module-grid, .lp-module-stock { grid-template-columns: 1fr; }
    .lp-agenda-row { grid-template-columns: 1fr; }
    .lp-sale-row { grid-template-columns: 1fr auto; }
    .lp-sale-row span { grid-column: 1 / -1; }
    .lp-login-side { display: none; }
    .lp-login-form { padding: 44px 24px 28px; }
    .lp-footer { flex-direction: column; align-items: flex-start; }
  }
`;
