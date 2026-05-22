'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

/* ─── paleta ─────────────────────────────────────────────────── */
const C = {
  navy:    '#0a1628',
  navyMid: '#0d1b3e',
  navyLt:  '#162c5a',
  blue:    '#3288e0',
  blueLt:  '#5ba8f0',
  white:   '#ffffff',
  light:   '#f4f7fb',
  mid:     '#f0f4f9',
  text:    '#0d1b3e',
  muted:   '#5a7898',
  border:  '#e0e8f2',
};

/* ─── imagens Unsplash ────────────────────────────────────────── */
const IMG = {
  hero:    'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1400&q=80',
  house1:  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=600&q=80',
  house2:  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
  house3:  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=600&q=80',
  aerial:  'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1200&q=80',
  office:  'https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&w=800&q=80',
  map:     'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80',
  team1:   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80',
  team2:   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
  team3:   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80',
};

const LOGIN_URL = '/?login=1';

/* ─── hooks de animação ───────────────────────────────────────── */
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function useCounter(target, duration, active) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return val;
}

/* ─── keyframes globais ───────────────────────────────────────── */
const GLOBAL_CSS = `
  @keyframes modalIn {
    from { opacity:0; transform:scale(0.96) translateY(8px); }
    to   { opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes pulse-ring {
    0%   { transform:scale(1);   opacity:0.8; }
    100% { transform:scale(1.5); opacity:0; }
  }
  @keyframes floatA {
    0%,100% { transform:translateY(0px) rotate(0.4deg); }
    50%     { transform:translateY(-14px) rotate(-0.4deg); }
  }
  @keyframes floatB {
    0%,100% { transform:translateY(0px) rotate(-0.3deg); }
    50%     { transform:translateY(-10px) rotate(0.3deg); }
  }
  @keyframes floatC {
    0%,100% { transform:translateY(0px); }
    55%     { transform:translateY(-7px); }
  }
  @keyframes heroLeft {
    from { opacity:0; transform:translateX(-36px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes heroRight {
    from { opacity:0; transform:translateX(36px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes heroFadeUp {
    from { opacity:0; transform:translateY(18px); }
    to   { opacity:1; transform:translateY(0); }
  }
`;

/* ─── componentes auxiliares ─────────────────────────────────── */
function Logo({ light }) {
  return (
    <a href="/" aria-label="Norte" style={{ display:'flex', alignItems:'center', textDecoration:'none' }}>
      <img
        src="/logo2.png"
        alt="Norte"
        style={{
          height: 38,
          width: 'auto',
          display: 'block',
          filter: light ? 'none' : 'invert(1)',
          transition: 'filter 0.25s',
        }}
      />
    </a>
  );
}

function Btn({ href, primary, large, light, children }) {
  const [hov, setHov] = useState(false);
  const base = {
    display:'inline-flex', alignItems:'center', gap:7,
    padding: large ? '14px 32px' : '10px 22px',
    borderRadius:10, fontWeight:700,
    fontSize: large ? 16 : 14,
    textDecoration:'none', cursor:'pointer',
    transition:'all 0.2s cubic-bezier(0.16,1,0.3,1)', whiteSpace:'nowrap',
  };
  const style = primary
    ? { ...base,
        background: C.blue, color:'#fff',
        boxShadow: hov ? '0 8px 28px rgba(50,136,224,0.65)' : '0 4px 20px rgba(50,136,224,0.45)',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
      }
    : light
      ? { ...base,
          background: hov ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
          border:'1px solid rgba(255,255,255,0.25)', color:'#fff',
          transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        }
      : { ...base,
          background: hov ? C.light : 'transparent',
          border:`1px solid ${C.border}`, color: C.text,
          transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        };
  return (
    <a href={href} style={style}
       onMouseEnter={() => setHov(true)}
       onMouseLeave={() => setHov(false)}>
      {children}
    </a>
  );
}

function Tag({ children }) {
  return (
    <span style={{
      display:'inline-block',
      background:'rgba(50,136,224,0.1)', border:'1px solid rgba(50,136,224,0.25)',
      borderRadius:999, padding:'4px 14px',
      color: C.blue, fontSize:11, fontWeight:800, letterSpacing:'0.12em',
    }}>
      {children}
    </span>
  );
}

/* ─── Modal de login ──────────────────────────────────────────── */
function LoginModal({ onClose }) {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      router.replace('/app');
    } catch (err) {
      setError(err.message ?? 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  }

  const inp = (focused) => ({
    width:'100%', padding:'11px 14px',
    background: focused ? '#fff' : C.light,
    border: `1.5px solid ${focused ? C.blue : C.border}`,
    borderRadius:10, color: C.text, fontSize:14,
    outline:'none', boxSizing:'border-box',
    fontFamily:'inherit', transition:'all 0.15s',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:500,
        background:'rgba(6,12,26,0.72)',
        backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', maxWidth:420,
          background:'#fff', borderRadius:24,
          boxShadow:'0 40px 80px rgba(0,0,0,0.35)',
          padding:'40px 40px 36px',
          position:'relative',
          animation:'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <button onClick={onClose} style={{
          position:'absolute', top:14, right:14,
          background:'none', border:'none', cursor:'pointer',
          width:32, height:32, borderRadius:8,
          display:'flex', alignItems:'center', justifyContent:'center',
          color: C.muted,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{
            width:48, height:48, background: C.blue, borderRadius:14,
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 14px',
            boxShadow:'0 6px 20px rgba(50,136,224,0.4)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" fill="#fff"/>
            </svg>
          </div>
          <h2 style={{ fontSize:22, fontWeight:800, color: C.navy, margin:'0 0 6px', letterSpacing:'-0.01em' }}>
            Bem-vindo de volta
          </h2>
          <p style={{ color: C.muted, fontSize:14, margin:0 }}>
            Entre com seu e-mail ou login
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color: C.muted, marginBottom:5, letterSpacing:'0.02em' }}>
              E-MAIL OU LOGIN
            </label>
            <FocusInput value={email} onChange={e=>setEmail(e.target.value)} type="text" placeholder="seu@email.com" required autoComplete="username" inp={inp}/>
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color: C.muted, marginBottom:5, letterSpacing:'0.02em' }}>
              SENHA
            </label>
            <FocusInput value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••" required autoComplete="current-password" inp={inp}/>
          </div>

          {error && (
            <div style={{
              background:'#fff0f0', border:'1px solid #fca5a5', borderRadius:9,
              padding:'10px 14px', color:'#dc2626', fontSize:13,
              display:'flex', alignItems:'center', gap:8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#dc2626" strokeWidth="1.8"/>
                <path d="M12 8v4M12 16h.01" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding:'13px', borderRadius:10,
            background: C.blue,
            color:'#fff', border:'none', fontWeight:700, fontSize:15,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop:4,
            boxShadow:'0 4px 16px rgba(50,136,224,0.35)',
            fontFamily:'inherit', transition:'all 0.15s',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            opacity: loading ? 0.75 : 1,
          }}>
            {loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation:'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
                <path d="M12 3a9 9 0 0 1 9 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            )}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:20, paddingTop:18, borderTop:`1px solid ${C.border}` }}>
          <span style={{ fontSize:13, color: C.muted }}>
            Não tem conta?{' '}
            <a href="/cadastro" style={{ color: C.blue, fontWeight:700, textDecoration:'none' }}>
              Cadastrar empresa
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

function FocusInput({ value, onChange, type, placeholder, required, autoComplete, inp }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      value={value} onChange={onChange} type={type}
      placeholder={placeholder} required={required} autoComplete={autoComplete}
      style={inp(focused)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

/* ─── Navbar ──────────────────────────────────────────────────── */
function Navbar({ scrolled, containerRef, onLogin }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el || !containerRef?.current) return;
    containerRef.current.scrollTo({ top: el.offsetTop - 64, behavior: 'smooth' });
  };

  const links = [
    { label: 'Como funciona', id: 'como-funciona' },
    { label: 'Funcionalidades', id: 'funcionalidades' },
    { label: 'Preços',          id: 'precos' },
  ];

  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:200,
      height:64,
      background: scrolled ? 'rgba(255,255,255,0.97)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
      transition:'all 0.3s cubic-bezier(0.16,1,0.3,1)',
      display:'grid',
      gridTemplateColumns:'1fr auto 1fr',
      alignItems:'center',
      padding:'0 max(28px, calc((100vw - 1200px)/2))',
    }}>
      <div style={{ justifySelf:'start' }} />

      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        {links.map(({ label, id }) => (
          <button key={id} onClick={() => scrollTo(id)} style={{
            padding:'8px 16px', borderRadius:8, cursor:'pointer',
            color: scrolled ? C.text : 'rgba(255,255,255,0.8)',
            fontSize:14, fontWeight:500,
            background:'none', border:'none',
            transition:'color 0.18s, background 0.18s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = scrolled ? C.light : 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ justifySelf:'end', display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:1, height:20, background: scrolled ? C.border : 'rgba(255,255,255,0.2)', marginRight:4 }} />
        <button onClick={onLogin} style={{
          padding:'10px 22px', borderRadius:10, cursor:'pointer',
          background: scrolled ? 'transparent' : 'rgba(255,255,255,0.1)',
          border: scrolled ? `1px solid ${C.border}` : '1px solid rgba(255,255,255,0.25)',
          color: scrolled ? C.text : '#fff',
          fontSize:14, fontWeight:700, fontFamily:'inherit',
          transition:'all 0.18s', whiteSpace:'nowrap',
        }}>
          Entrar
        </button>
        <Btn href="/cadastro" primary>Começar grátis</Btn>
      </div>
    </nav>
  );
}

/* ─── Hero ────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section style={{
      minHeight:'100vh', position:'relative',
      display:'flex', flexDirection:'column', justifyContent:'center',
      padding:'120px max(28px, calc((100vw - 1200px)/2)) 80px',
      overflow:'hidden',
    }}>
      {/* fundo */}
      <div style={{
        position:'absolute', inset:0, zIndex:0,
        backgroundImage:`url(${IMG.hero})`,
        backgroundSize:'cover', backgroundPosition:'center top',
      }}/>
      <div style={{
        position:'absolute', inset:0, zIndex:1,
        background:'linear-gradient(135deg, rgba(8,15,30,0.94) 0%, rgba(10,22,46,0.87) 60%, rgba(13,27,62,0.75) 100%)',
      }}/>
      {/* grade */}
      <div style={{
        position:'absolute', inset:0, zIndex:2, pointerEvents:'none',
        backgroundImage:[
          'linear-gradient(rgba(50,136,224,0.08) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(50,136,224,0.08) 1px, transparent 1px)',
        ].join(','),
        backgroundSize:'60px 60px',
        maskImage:'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)',
        WebkitMaskImage:'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)',
      }}/>
      <div style={{
        position:'absolute', inset:0, zIndex:2, pointerEvents:'none',
        backgroundImage:'radial-gradient(rgba(50,136,224,0.25) 1.5px, transparent 1.5px)',
        backgroundSize:'60px 60px',
        maskImage:'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)',
        WebkitMaskImage:'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 100%)',
      }}/>

      {/* conteúdo */}
      <div style={{ position:'relative', zIndex:3, display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' }}>

        {/* coluna esquerda — entra da esquerda */}
        <div style={{ animation:'heroLeft 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
          <div style={{ animation:'heroFadeUp 0.6s ease 0s both' }}>
            <Tag>SISTEMA IMOBILIÁRIO COMPLETO</Tag>
          </div>
          <h1 style={{
            fontSize:'clamp(36px, 4.5vw, 60px)', fontWeight:900,
            color:'#fff', lineHeight:1.05, margin:'20px 0 22px',
            letterSpacing:'-0.03em',
            animation:'heroFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.18s both',
          }}>
            Gerencie seus<br/>
            <span style={{
              background:`linear-gradient(90deg, ${C.blueLt}, #a0d4ff)`,
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>
              loteamentos
            </span><br/>
            com precisão
          </h1>
          <p style={{
            color:'rgba(255,255,255,0.6)', fontSize:17, lineHeight:1.7,
            margin:'0 0 36px', maxWidth:480,
            animation:'heroFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.28s both',
          }}>
            Do cadastro da empresa ao fechamento da venda — controle de lotes,
            editor de mapas interativos e dashboards em tempo real para imobiliárias modernas.
          </p>
          <div style={{
            display:'flex', gap:12, flexWrap:'wrap', marginBottom:48,
            animation:'heroFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.36s both',
          }}>
            <Btn href="/cadastro" primary large>Criar conta gratuita →</Btn>
            <Btn href={LOGIN_URL} light large>Já tenho conta</Btn>
          </div>

          {/* stats */}
          <div style={{
            display:'flex', gap:32, borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:28,
            animation:'heroFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.44s both',
          }}>
            {[['200+','Imobiliárias'],['50 mil','Lotes gerenciados'],['R$2 bi+','em transações']].map(([n,l]) => (
              <div key={l}>
                <div style={{ fontSize:22, fontWeight:800, color:'#fff', lineHeight:1 }}>{n}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:4, fontWeight:500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* coluna direita — entra da direita */}
        <div style={{ position:'relative', height:500, animation:'heroRight 0.9s cubic-bezier(0.16,1,0.3,1) 0.35s both' }}>

          {/* card principal — flutua */}
          <div style={{ position:'absolute', top:0, right:0, animation:'floatA 7s ease-in-out 1s infinite' }}>
            <div style={{
              width:340, borderRadius:20, overflow:'hidden',
              boxShadow:'0 32px 80px rgba(0,0,0,0.55)',
              border:'1px solid rgba(255,255,255,0.12)',
            }}>
              <img src={IMG.house2} alt="Loteamento" style={{ width:'100%', height:220, objectFit:'cover', display:'block' }}/>
              <div style={{ background:'rgba(10,22,46,0.97)', padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:3 }}>LOTEAMENTO JARDIM REAL</div>
                    <div style={{ color:'#fff', fontWeight:800, fontSize:16 }}>248 lotes · R$ 2,4 M</div>
                  </div>
                  <div style={{
                    background:'rgba(50,136,224,0.2)', border:'1px solid rgba(50,136,224,0.4)',
                    borderRadius:8, padding:'5px 10px',
                    color: C.blueLt, fontSize:11, fontWeight:700,
                  }}>
                    142 disp.
                  </div>
                </div>
                <div style={{ marginTop:10, background:'rgba(255,255,255,0.06)', borderRadius:6, height:5, overflow:'hidden' }}>
                  <div style={{ width:'42%', height:'100%', background: C.blue, borderRadius:6 }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>42% vendido</span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>58% disponível</span>
                </div>
              </div>
            </div>
          </div>

          {/* card menor — flutua diferente */}
          <div style={{ position:'absolute', bottom:80, left:0, animation:'floatB 8s ease-in-out 0s infinite' }}>
            <div style={{
              width:230, borderRadius:16, overflow:'hidden',
              boxShadow:'0 24px 60px rgba(0,0,0,0.5)',
              border:'1px solid rgba(255,255,255,0.1)',
            }}>
              <img src={IMG.house1} alt="Casa" style={{ width:'100%', height:130, objectFit:'cover', display:'block' }}/>
              <div style={{ background:'rgba(10,22,46,0.97)', padding:'12px 14px' }}>
                <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:2 }}>LOTE A-14</div>
                <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>R$ 180.000</div>
                <div style={{
                  marginTop:7, display:'inline-block',
                  background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)',
                  borderRadius:6, padding:'3px 9px',
                  color:'#4ade80', fontSize:10, fontWeight:700,
                }}>● DISPONÍVEL</div>
              </div>
            </div>
          </div>

          {/* badge notificação — flutua suave */}
          <div style={{ position:'absolute', bottom:40, right:20, animation:'floatC 5s ease-in-out 2s infinite' }}>
            <div style={{
              background:'rgba(255,255,255,0.95)', backdropFilter:'blur(12px)',
              borderRadius:14, padding:'12px 16px',
              boxShadow:'0 12px 40px rgba(0,0,0,0.3)',
              display:'flex', alignItems:'center', gap:10,
              border:'1px solid rgba(255,255,255,0.5)',
            }}>
              <div style={{
                width:36, height:36, borderRadius:10, background: C.blue,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color: C.navy }}>Venda registrada!</div>
                <div style={{ fontSize:11, color: C.muted }}>Lote B-07 · R$ 220.000</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* wave divider */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:3, lineHeight:0 }}>
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', display:'block' }}>
          <path d="M0 60 C360 20 1080 20 1440 60 L1440 60 L0 60Z" fill={C.light}/>
        </svg>
      </div>
    </section>
  );
}

/* ─── Logos / social proof ────────────────────────────────────── */
function SocialProof() {
  const [ref, visible] = useInView(0.2);
  const orgs = ['Imobiliária Central','UrbaLotes','Construtora Viva','Terras Sul','Grupo Alfa','LoteSmart'];
  return (
    <section ref={ref} style={{ background: C.light, padding:'40px max(28px, calc((100vw - 1200px)/2))' }}>
      <p style={{
        textAlign:'center', color: C.muted, fontSize:13, fontWeight:600, letterSpacing:'0.08em', marginBottom:28,
        opacity: visible ? 1 : 0,
        transition:'opacity 0.6s ease 0.1s',
      }}>
        USADO POR IMOBILIÁRIAS E LOTEADORAS EM TODO O BRASIL
      </p>
      <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'12px 32px' }}>
        {orgs.map((o, i) => (
          <span key={o} style={{
            color:'#b0bece', fontWeight:800, fontSize:14, letterSpacing:'-0.01em',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(10px)',
            transition: `opacity 0.5s ease ${0.05 + i * 0.06}s, transform 0.5s ease ${0.05 + i * 0.06}s`,
          }}>
            {o}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─── Feature showcase ────────────────────────────────────────── */
function Feature({ tag, title, desc, bullets, imgSrc, reverse, sectionId }) {
  const [ref, visible] = useInView();

  const leftStyle = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateX(0)' : 'translateX(-32px)',
    transition: 'opacity 0.7s ease 0.05s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.05s',
  };
  const rightStyle = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateX(0)' : 'translateX(32px)',
    transition: 'opacity 0.7s ease 0.15s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.15s',
  };

  return (
    <div ref={ref} id={sectionId} style={{
      display:'grid',
      gridTemplateColumns:'1fr 1fr',
      gap:80, alignItems:'center',
      padding:'96px max(28px, calc((100vw - 1200px)/2))',
      background: reverse ? C.light : C.white,
    }}>
      {reverse
        ? <>
            <div style={leftStyle}><Img src={imgSrc}/></div>
            <div style={rightStyle}><TextBlock tag={tag} title={title} desc={desc} bullets={bullets}/></div>
          </>
        : <>
            <div style={leftStyle}><TextBlock tag={tag} title={title} desc={desc} bullets={bullets}/></div>
            <div style={rightStyle}><Img src={imgSrc}/></div>
          </>
      }
    </div>
  );
}

function TextBlock({ tag, title, desc, bullets }) {
  return (
    <div>
      <Tag>{tag}</Tag>
      <h2 style={{ fontSize:'clamp(26px, 3vw, 40px)', fontWeight:800, color: C.navy, margin:'16px 0 16px', lineHeight:1.15, letterSpacing:'-0.02em' }}>
        {title}
      </h2>
      <p style={{ color: C.muted, fontSize:16, lineHeight:1.7, margin:'0 0 28px' }}>{desc}</p>
      <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:12 }}>
        {bullets.map(b => (
          <li key={b} style={{ display:'flex', alignItems:'flex-start', gap:10, color: C.text, fontSize:14 }}>
            <span style={{
              width:20, height:20, borderRadius:'50%', background:'rgba(50,136,224,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
            }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Img({ src }) {
  return (
    <div style={{ position:'relative' }}>
      <div style={{
        borderRadius:20, overflow:'hidden',
        boxShadow:'0 24px 64px rgba(0,30,80,0.18)',
        border:`1px solid ${C.border}`,
      }}>
        <img src={src} alt="" style={{ width:'100%', height:380, objectFit:'cover', display:'block' }}/>
      </div>
      <div style={{
        position:'absolute', bottom:-20, right:-20, zIndex:-1,
        width:120, height:120,
        backgroundImage:`radial-gradient(${C.blue}44 1.5px, transparent 1.5px)`,
        backgroundSize:'14px 14px',
      }}/>
    </div>
  );
}

/* ─── Como Funciona ───────────────────────────────────────────── */
const STEPS = [
  {
    num: '01',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M8 12h8M8 8h5M8 16h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Cadastre sua empresa',
    desc: 'Crie sua conta em minutos. Informe os dados da empresa, configure o perfil e convide sua equipe de vendas.',
  },
  {
    num: '02',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M7 10l3 3 7-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Monte seu loteamento',
    desc: 'Use o editor interativo para desenhar ruas, quadras e lotes. Defina áreas, preços e status de cada unidade.',
  },
  {
    num: '03',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Gerencie em tempo real',
    desc: 'Acompanhe disponibilidade, reservas e vendas no dashboard. Atualize o status dos lotes com um único clique.',
  },
  {
    num: '04',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Feche mais vendas',
    desc: 'Relatórios automáticos, histórico de negociações e visão completa do portfólio para vender com mais agilidade.',
  },
];

function StepCard({ step, i, visible }) {
  const [hov, setHov] = useState(false);
  const active = i === 0 || hov;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        textAlign:'center', padding:'0 20px',
        position:'relative', zIndex:1,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.6s ease ${0.12 * i}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${0.12 * i}s`,
        cursor:'default',
      }}
    >
      <div style={{ position:'relative', marginBottom:28 }}>
        {active && (
          <div style={{
            position:'absolute', inset:-8,
            borderRadius:'50%',
            border:`2px solid ${C.blue}33`,
            animation:'pulse-ring 2s ease-out infinite',
          }}/>
        )}
        <div style={{
          width:104, height:104, borderRadius:'50%',
          background: active
            ? `linear-gradient(135deg, ${C.blue}, #1a5fa8)`
            : C.light,
          border: active ? 'none' : `2px solid ${C.border}`,
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          boxShadow: active
            ? '0 16px 40px rgba(50,136,224,0.35)'
            : '0 4px 16px rgba(0,30,80,0.07)',
          transition:'all 0.3s cubic-bezier(0.16,1,0.3,1)',
          color: active ? '#fff' : C.blue,
        }}>
          {step.icon}
          <span style={{
            fontSize:11, fontWeight:800, letterSpacing:'0.05em',
            color: active ? 'rgba(255,255,255,0.7)' : C.muted,
            marginTop:4, transition:'color 0.3s',
          }}>
            PASSO {step.num}
          </span>
        </div>
      </div>

      <h3 style={{ fontSize:17, fontWeight:800, color: C.navy, margin:'0 0 10px', lineHeight:1.3 }}>
        {step.title}
      </h3>
      <p style={{ fontSize:14, color: C.muted, lineHeight:1.65, margin:0 }}>
        {step.desc}
      </p>
    </div>
  );
}

function ComoFunciona() {
  const [ref, visible] = useInView(0.1);

  return (
    <section id="como-funciona" ref={ref} style={{
      padding:'100px max(28px, calc((100vw - 1200px)/2))',
      background: C.white,
      position:'relative', overflow:'hidden',
    }}>
      <div style={{
        position:'absolute', top:-120, right:-120, width:500, height:500,
        borderRadius:'50%',
        background:'radial-gradient(circle, rgba(50,136,224,0.06) 0%, transparent 70%)',
        pointerEvents:'none',
      }}/>

      {/* cabeçalho */}
      <div style={{
        textAlign:'center', marginBottom:72,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition:'opacity 0.7s ease 0s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0s',
      }}>
        <Tag>COMO FUNCIONA</Tag>
        <h2 style={{
          fontSize:'clamp(28px, 3.5vw, 44px)', fontWeight:800,
          color: C.navy, margin:'16px 0 14px', letterSpacing:'-0.02em',
        }}>
          Do cadastro ao fechamento<br/>em 4 passos simples
        </h2>
        <p style={{ color: C.muted, fontSize:16, maxWidth:500, margin:'0 auto', lineHeight:1.65 }}>
          Sem treinamentos complexos. Em menos de uma tarde sua empresa já está operando com o Terreno.
        </p>
      </div>

      {/* steps grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:0, position:'relative' }}>
        <div style={{
          position:'absolute',
          top:52, left:'12.5%', right:'12.5%',
          height:2,
          background:`linear-gradient(90deg, ${C.blue}33, ${C.blue}99, ${C.blue}33)`,
          zIndex:0,
          opacity: visible ? 1 : 0,
          transition:'opacity 0.8s ease 0.3s',
        }}/>

        {STEPS.map((step, i) => (
          <StepCard key={step.num} step={step} i={i} visible={visible} />
        ))}
      </div>

      {/* CTA */}
      <div style={{
        textAlign:'center', marginTop:64,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition:'opacity 0.6s ease 0.55s, transform 0.6s ease 0.55s',
      }}>
        <Btn href="/cadastro" primary large>Começar agora — é grátis →</Btn>
        <p style={{ marginTop:14, fontSize:13, color: C.muted }}>
          Sem cartão de crédito · Cancele quando quiser
        </p>
      </div>
    </section>
  );
}

/* ─── Stats ───────────────────────────────────────────────────── */
const STATS = [
  { num: 200, display: n => `${n}+`,       label: 'Imobiliárias cadastradas' },
  { num: 50,  display: n => `${n}.000+`,   label: 'Lotes gerenciados' },
  { num: 2,   display: n => `R$ ${n} bi+`, label: 'Em vendas processadas' },
  { num: 98,  display: n => `${n}%`,       label: 'Taxa de satisfação' },
];

function StatItem({ num, display, label, visible, delay }) {
  const count = useCounter(num, 1800, visible);
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      <div style={{ fontSize:'clamp(32px, 4vw, 48px)', fontWeight:900, color:'#fff', letterSpacing:'-0.03em', lineHeight:1 }}>
        {display(count)}
      </div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.45)', marginTop:8, fontWeight:500 }}>{label}</div>
    </div>
  );
}

function Stats() {
  const [ref, visible] = useInView(0.2);
  return (
    <section ref={ref} style={{
      background:`linear-gradient(135deg, ${C.navy} 0%, ${C.navyLt} 100%)`,
      padding:'80px max(28px, calc((100vw - 1200px)/2))',
      position:'relative', overflow:'hidden',
    }}>
      <div style={{
        position:'absolute', top:-80, right:-80, width:400, height:400,
        borderRadius:'50%', background:'rgba(50,136,224,0.07)', pointerEvents:'none',
      }}/>
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',
        gap:40, textAlign:'center',
      }}>
        {STATS.map(({ num, display, label }, i) => (
          <StatItem key={label} num={num} display={display} label={label} visible={visible} delay={i * 0.1} />
        ))}
      </div>
    </section>
  );
}

/* ─── Preços ──────────────────────────────────────────────────── */
const PLANS = [
  {
    name: 'Inicial',
    price: '600',
    desc: 'Ideal para loteadoras que estão começando e querem organizar sua operação.',
    features: [
      '1 loteamento ativo',
      'Até 200 lotes cadastrados',
      'Editor de mapas completo',
      'Dashboard de vendas',
      '2 usuários',
      'Suporte por e-mail',
    ],
    cta: 'Começar agora',
    highlight: false,
  },
  {
    name: 'Profissional',
    price: '1.200',
    desc: 'Para empresas em crescimento que gerenciam múltiplos empreendimentos.',
    features: [
      '5 loteamentos ativos',
      'Até 1.000 lotes cadastrados',
      'Editor de mapas avançado',
      'Dashboard + relatórios PDF',
      '10 usuários',
      'Suporte prioritário',
      'Integração com CRM',
    ],
    cta: 'Escolher Profissional',
    highlight: true,
    badge: 'Mais popular',
  },
  {
    name: 'Empresarial',
    price: '2.400',
    desc: 'Solução completa para grandes loteadoras e construtoras com alto volume.',
    features: [
      'Loteamentos ilimitados',
      'Lotes ilimitados',
      'Todas as funcionalidades',
      'Relatórios personalizados',
      'Usuários ilimitados',
      'Gerente de conta dedicado',
      'SLA 99,9% de disponibilidade',
      'API de integração',
    ],
    cta: 'Falar com vendas',
    highlight: false,
  },
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
      <circle cx="8" cy="8" r="8" fill="rgba(50,136,224,0.12)"/>
      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke={C.blue} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PricingCard({ plan, i, visible }) {
  const [hov, setHov] = useState(false);

  const baseTransform = plan.highlight ? 'scale(1.04)' : 'scale(1)';
  const hovTransform  = plan.highlight ? 'scale(1.07)' : 'translateY(-6px) scale(1.02)';
  const entryTransform = 'translateY(28px) scale(0.97)';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: plan.highlight ? C.navy : C.white,
        borderRadius:24,
        padding:'36px 32px',
        border: plan.highlight ? 'none' : `1px solid ${C.border}`,
        position:'relative',
        opacity: visible ? 1 : 0,
        transform: !visible ? entryTransform : hov ? hovTransform : baseTransform,
        transition: `opacity 0.6s ease ${i * 0.12}s, transform ${hov ? '0.25s' : `0.6s ease ${i * 0.12}s`} cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s`,
        boxShadow: hov
          ? (plan.highlight ? '0 44px 100px rgba(10,22,62,0.5)' : '0 20px 60px rgba(0,30,80,0.16)')
          : (plan.highlight ? '0 32px 80px rgba(10,22,62,0.35)' : '0 4px 24px rgba(0,30,80,0.07)'),
        cursor:'default',
      }}
    >
      {plan.badge && (
        <div style={{
          position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)',
          background: C.blue,
          color:'#fff', fontSize:11, fontWeight:800, letterSpacing:'0.08em',
          padding:'5px 18px', borderRadius:999,
          boxShadow:'0 4px 16px rgba(50,136,224,0.5)',
          whiteSpace:'nowrap',
        }}>
          {plan.badge.toUpperCase()}
        </div>
      )}

      <div style={{ marginBottom:24 }}>
        <div style={{
          fontSize:12, fontWeight:800, letterSpacing:'0.1em',
          color: plan.highlight ? 'rgba(255,255,255,0.5)' : C.muted,
          marginBottom:8,
        }}>
          {plan.name.toUpperCase()}
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:4, marginBottom:12 }}>
          <span style={{ fontSize:13, fontWeight:600, color: plan.highlight ? 'rgba(255,255,255,0.6)' : C.muted, marginBottom:6 }}>R$</span>
          <span style={{ fontSize:'clamp(38px, 4vw, 52px)', fontWeight:900, lineHeight:1, letterSpacing:'-0.03em', color: plan.highlight ? '#fff' : C.navy }}>
            {plan.price}
          </span>
          <span style={{ fontSize:14, color: plan.highlight ? 'rgba(255,255,255,0.45)' : C.muted, marginBottom:8 }}>/mês</span>
        </div>
        <p style={{ fontSize:14, color: plan.highlight ? 'rgba(255,255,255,0.55)' : C.muted, lineHeight:1.6, margin:0 }}>
          {plan.desc}
        </p>
      </div>

      <div style={{ height:1, background: plan.highlight ? 'rgba(255,255,255,0.1)' : C.border, marginBottom:24 }}/>

      <ul style={{ listStyle:'none', padding:0, margin:'0 0 32px', display:'flex', flexDirection:'column', gap:12 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
            {plan.highlight
              ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                  <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,0.12)"/>
                  <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )
              : <Check/>
            }
            <span style={{ fontSize:14, color: plan.highlight ? 'rgba(255,255,255,0.8)' : C.text, lineHeight:1.5 }}>{f}</span>
          </li>
        ))}
      </ul>

      <a href="/cadastro" style={{
        display:'block', textAlign:'center',
        padding:'14px 24px', borderRadius:12,
        fontWeight:700, fontSize:15,
        textDecoration:'none',
        transition:'all 0.18s',
        background: plan.highlight ? C.blue : 'transparent',
        color: plan.highlight ? '#fff' : C.blue,
        border: plan.highlight ? 'none' : `2px solid ${C.blue}`,
        boxShadow: plan.highlight ? '0 6px 24px rgba(50,136,224,0.45)' : 'none',
      }}>
        {plan.cta}
      </a>
    </div>
  );
}

function Pricing() {
  const [ref, visible] = useInView(0.1);
  return (
    <section id="precos" ref={ref} style={{ padding:'100px max(28px, calc((100vw - 1200px)/2))', background: C.light }}>
      <div style={{
        textAlign:'center', marginBottom:64,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition:'opacity 0.7s ease 0s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0s',
      }}>
        <Tag>PLANOS E PREÇOS</Tag>
        <h2 style={{ fontSize:'clamp(28px, 3.5vw, 44px)', fontWeight:800, color: C.navy, margin:'16px 0 14px', letterSpacing:'-0.02em' }}>
          Invista no crescimento<br/>da sua imobiliária
        </h2>
        <p style={{ color: C.muted, fontSize:16, maxWidth:480, margin:'0 auto', lineHeight:1.6 }}>
          Planos flexíveis para cada tamanho de operação. Sem taxa de setup, cancele quando quiser.
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:24, alignItems:'start' }}>
        {PLANS.map((plan, i) => (
          <PricingCard key={plan.name} plan={plan} i={i} visible={visible} />
        ))}
      </div>

      <p style={{
        textAlign:'center', marginTop:40, color: C.muted, fontSize:13,
        opacity: visible ? 1 : 0,
        transition:'opacity 0.6s ease 0.5s',
      }}>
        Todos os planos incluem 14 dias grátis · Sem cartão de crédito para começar
      </p>
    </section>
  );
}

/* ─── CTA final ───────────────────────────────────────────────── */
function CtaFinal() {
  const [ref, visible] = useInView();

  const appear = (delay) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.6s ease ${delay}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
  });

  return (
    <section ref={ref} style={{ position:'relative', overflow:'hidden' }}>
      <img src={IMG.aerial} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>
      <div style={{ position:'absolute', inset:0, background:'rgba(8,15,30,0.88)' }}/>
      <div style={{
        position:'relative', zIndex:1,
        padding:'100px max(28px, calc((100vw - 760px)/2))',
        textAlign:'center',
      }}>
        <div style={appear(0)}><Tag>COMECE HOJE</Tag></div>
        <h2 style={{ fontSize:'clamp(30px, 4vw, 52px)', fontWeight:900, color:'#fff', margin:'20px 0 16px', lineHeight:1.1, letterSpacing:'-0.03em', ...appear(0.1) }}>
          Leve sua imobiliária<br/>ao próximo nível
        </h2>
        <p style={{ color:'rgba(255,255,255,0.55)', fontSize:17, lineHeight:1.7, margin:'0 0 40px', maxWidth:520, marginLeft:'auto', marginRight:'auto', ...appear(0.2) }}>
          Crie sua conta em minutos, cadastre sua empresa e comece a gerenciar seus loteamentos com profissionalismo.
        </p>
        <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', ...appear(0.3) }}>
          <Btn href="/cadastro" primary large>Criar conta grátis →</Btn>
          <Btn href={LOGIN_URL} light large>Já tenho uma conta</Btn>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ background:'#060d1a', padding:'64px max(28px, calc((100vw - 1200px)/2)) 32px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:40, marginBottom:48 }}>
        <div>
          <Logo light/>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14, lineHeight:1.7, margin:'16px 0 0', maxWidth:280 }}>
            Sistema completo para gestão de loteamentos, lotes e vendas imobiliárias.
          </p>
        </div>
        {[
          ['Produto', ['Funcionalidades','Preços','Integrações','Novidades']],
          ['Empresa', ['Sobre nós','Blog','Carreiras','Contato']],
          ['Legal', ['Termos de uso','Privacidade','Cookies']],
        ].map(([title, links]) => (
          <div key={title}>
            <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:800, letterSpacing:'0.1em', marginBottom:16 }}>{title.toUpperCase()}</div>
            {links.map(l => (
              <div key={l} style={{ marginBottom:10 }}>
                <span style={{ color:'rgba(255,255,255,0.3)', fontSize:14, cursor:'pointer', fontWeight:500 }}>{l}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:28, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <span style={{ color:'rgba(255,255,255,0.2)', fontSize:13 }}>© {new Date().getFullYear()} Terreno · Todos os direitos reservados</span>
        <div style={{ display:'flex', gap:20 }}>
          {[['Entrar',LOGIN_URL],['Cadastrar','/cadastro']].map(([l,h]) => (
            <a key={l} href={h} style={{ color:'rgba(255,255,255,0.3)', fontSize:13, textDecoration:'none', fontWeight:500 }}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const ref = useRef(null);

  const openLogin = () => {
    setShowLogin(true);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('login', '1');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const closeLogin = () => {
    setShowLogin(false);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('login');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = () => setScrolled(el.scrollTop > 40);
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1' || params.get('login') === 'true') {
      setShowLogin(true);
    }
  }, []);

  return (
    <div ref={ref} style={{
      position:'fixed', inset:0, overflowY:'auto', overflowX:'hidden',
      fontFamily:"'Manrope', system-ui, sans-serif",
      WebkitFontSmoothing:'antialiased',
      color: C.text,
    }}>
      <style>{GLOBAL_CSS}</style>
      {showLogin && <LoginModal onClose={closeLogin}/>}
      <Navbar scrolled={scrolled} containerRef={ref} onLogin={openLogin}/>
      <Hero/>
      <SocialProof/>
      <ComoFunciona/>
      <Feature
        sectionId="funcionalidades"
        tag="EDITOR DE MAPAS"
        title="Visualize e edite seus loteamentos em tempo real"
        desc="Nosso editor SVG interativo permite que você desenhe loteamentos do zero ou importe plantas existentes, defina lotes com precisão e publique mapas prontos para sua equipe de vendas."
        bullets={[
          'Ferramentas de desenho: polígonos, ruas, praças e landmarks',
          'Edição de propriedades de cada lote com clique',
          'Visualização por status: disponível, reservado ou vendido',
          'Exportação e compartilhamento facilitados',
        ]}
        imgSrc={IMG.map}
      />
      <Feature
        tag="GESTÃO COMPLETA"
        title="Controle total do seu portfólio imobiliário"
        desc="Dashboard com métricas em tempo real, histórico de vendas, relatórios de desempenho e tudo que você precisa para tomar decisões com dados — não com intuição."
        bullets={[
          'Métricas de disponibilidade, reservas e receita',
          'Ranking de corretores e performance de vendas',
          'Histórico completo de cada transação',
          'Cadastro multi-empresa com controle de acesso',
        ]}
        imgSrc={IMG.office}
        reverse
      />
      <Stats/>
      <Pricing/>
      <CtaFinal/>
      <Footer/>
    </div>
  );
}
