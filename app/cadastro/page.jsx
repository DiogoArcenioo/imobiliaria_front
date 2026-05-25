'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const C = {
  navy:   '#0a1628',
  navyMd: '#0d1b3e',
  navyLt: '#162c5a',
  blue:   '#3288e0',
  blueDk: '#1a5fa8',
  white:  '#ffffff',
  light:  '#f4f7fb',
  text:   '#0d1b3e',
  mid:    '#2d4870',
  muted:  '#5a7898',
  dim:    '#8aa0b5',
  border: '#ccd5e0',
  surf:   '#e8edf4',
};

const AERIAL = 'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=900&q=80';
const LOGIN_URL = '/?login=1';

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

/* ─── máscaras ─────────────────────────────────────────────────── */
const mask = {
  cnpj: v => v.replace(/\D/g,'').slice(0,14)
    .replace(/^(\d{2})(\d)/,'$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
    .replace(/\.(\d{3})(\d)/,'.$1/$2')
    .replace(/(\d{4})(\d)/,'$1-$2'),
  phone: v => {
    const n = v.replace(/\D/g,'').slice(0,11);
    return n.length <= 10
      ? n.replace(/^(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').trim()
      : n.replace(/^(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3').trim();
  },
  cep: v => v.replace(/\D/g,'').slice(0,8).replace(/^(\d{5})(\d{0,3})/,'$1-$2'),
};

/* ─── componentes de formulário ─────────────────────────────────── */
function StepBar({ step }) {
  const steps = [
    { label:'Empresa' },
    { label:'Endereço' },
    { label:'Responsável' },
    { label:'Acesso' },
  ];
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:32, gap:0 }}>
      {steps.map((s, i) => {
        const n = i + 1;
        const done = step > n, active = step === n;
        return (
          <div key={n} style={{ display:'flex', alignItems:'center' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:72 }}>
              <div style={{
                width:36, height:36, borderRadius:'50%',
                background: done ? C.blue : active ? C.navyMd : C.surf,
                border: `2px solid ${done || active ? C.blue : C.border}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color: done || active ? '#fff' : C.dim,
                fontWeight:800, fontSize:13,
                transition:'all 0.25s',
                boxShadow: active ? `0 0 0 4px rgba(50,136,224,0.15)` : 'none',
              }}>
                {done
                  ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : n
                }
              </div>
              <span style={{ fontSize:10, fontWeight:700, color: active ? C.navyMd : done ? C.blue : C.dim, letterSpacing:'0.04em', textAlign:'center' }}>
                {s.label.toUpperCase()}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width:48, height:2, marginBottom:22, flexShrink:0,
                background: step > n ? C.blue : C.border,
                transition:'background 0.3s',
              }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, required, hint, error, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <label style={{ fontSize:12, fontWeight:700, color: C.mid, letterSpacing:'0.02em' }}>
          {label}{required && <span style={{ color: C.blue, marginLeft:2 }}>*</span>}
        </label>
        {hint && <span style={{ fontSize:11, color: C.dim }}>{hint}</span>}
      </div>
      {children}
      {error && (
        <span style={{ fontSize:11, color:'#dc2626', display:'flex', alignItems:'center', gap:4 }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#dc2626" strokeWidth="1.5"/>
            <path d="M6 4v2.5M6 8h.01" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}

const inputBase = (err, focused) => ({
  width:'100%', padding:'10px 13px',
  background: focused ? '#fff' : C.light,
  border: `1.5px solid ${err ? '#fca5a5' : focused ? C.blue : C.border}`,
  borderRadius:9, color: C.text, fontSize:14,
  outline:'none', boxSizing:'border-box', fontFamily:'inherit',
  transition:'border-color 0.15s, background 0.15s',
});

function Input({ error, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      style={inputBase(error, focused)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
    />
  );
}

function Select({ value, onChange, error, children }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value} onChange={onChange}
      style={{ ...inputBase(error, focused), cursor:'pointer' }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </select>
  );
}

function BtnPrimary({ onClick, disabled, loading, children }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      flex:1, padding:'13px 20px', borderRadius:10,
      background: loading ? C.blueDk : C.blue,
      color:'#fff', border:'none', fontWeight:700, fontSize:15,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      opacity: disabled ? 0.6 : 1, fontFamily:'inherit',
      boxShadow:'0 4px 16px rgba(50,136,224,0.3)',
      transition:'all 0.15s',
    }}>
      {loading && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation:'spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
          <path d="M12 3a9 9 0 0 1 9 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      )}
      {children}
    </button>
  );
}

function BtnSecondary({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:'13px 20px', borderRadius:10,
      background:'transparent', color: C.muted,
      border:`1.5px solid ${C.border}`, fontWeight:600, fontSize:14,
      cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
      whiteSpace:'nowrap',
    }}>
      {children}
    </button>
  );
}

function PasswordStrength({ senha }) {
  const checks = [
    { ok: senha.length >= 8,          label:'8+ chars' },
    { ok: /[A-Z]/.test(senha),        label:'Maiúscula' },
    { ok: /[0-9]/.test(senha),        label:'Número' },
    { ok: /[^A-Za-z0-9]/.test(senha), label:'Símbolo' },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['#e8edf4','#ef4444','#f59e0b','#3288e0','#22c55e'];
  const labels = ['','Fraca','Regular','Boa','Forte'];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', gap:4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex:1, height:4, borderRadius:3, background: i<=score ? colors[score] : C.surf, transition:'background 0.2s' }}/>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {checks.map(c => (
            <span key={c.label} style={{ fontSize:11, color: c.ok ? '#22c55e' : C.dim, display:'flex', alignItems:'center', gap:3 }}>
              {c.ok ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && <span style={{ fontSize:11, fontWeight:700, color: colors[score] }}>{labels[score]}</span>}
      </div>
    </div>
  );
}

const g2 = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 };

/* ─── Painel esquerdo ───────────────────────────────────────────── */
function LeftPanel({ step }) {
  const stepInfo = [
    { icon:'🏢', title:'Dados da empresa',     sub:'Informações básicas da sua imobiliária' },
    { icon:'📍', title:'Endereço',              sub:'Localização da sua sede' },
    { icon:'👤', title:'Responsável legal',     sub:'Dados do sócio ou administrador' },
    { icon:'🔐', title:'Acesso ao sistema',     sub:'Crie o login do gerente principal' },
  ];
  const current = stepInfo[step - 1] ?? stepInfo[0];

  return (
    <div style={{
      width:'42%', flexShrink:0,
      position:'relative',
      display:'flex', flexDirection:'column',
      overflow:'hidden',
    }}>
      {/* imagem de fundo */}
      <img
        src={AERIAL}
        alt=""
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
      />

      {/* overlay gradiente navy */}
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(160deg, rgba(8,15,30,0.97) 0%, rgba(10,22,46,0.93) 50%, rgba(13,30,70,0.82) 100%)',
      }}/>

      {/* grade decorativa */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:[
          'linear-gradient(rgba(50,136,224,0.06) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(50,136,224,0.06) 1px, transparent 1px)',
        ].join(','),
        backgroundSize:'48px 48px',
      }}/>

      {/* conteúdo */}
      <div style={{
        position:'relative', zIndex:1,
        padding:'40px 44px',
        display:'flex', flexDirection:'column', height:'100%',
      }}>

        {/* logo */}
        <a href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', marginBottom:'auto' }}>
          <div style={{
            width:38, height:38, background: C.blue, borderRadius:10,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 14px rgba(50,136,224,0.4)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" fill="#fff"/>
              <circle cx="12" cy="12" r="1.7" fill="#0a1628"/>
            </svg>
          </div>
          <span style={{ fontWeight:800, fontSize:18, color:'#fff', letterSpacing:'-0.01em' }}>Terreno</span>
        </a>

        {/* bloco central */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'48px 0' }}>
          <div style={{
            display:'inline-block',
            background:'rgba(50,136,224,0.15)', border:'1px solid rgba(50,136,224,0.3)',
            borderRadius:999, padding:'5px 14px',
            color:'rgba(91,168,240,0.9)', fontSize:11, fontWeight:800, letterSpacing:'0.1em',
            marginBottom:20,
          }}>
            CADASTRO GRATUITO
          </div>

          <h1 style={{
            fontSize:'clamp(24px, 2.8vw, 36px)', fontWeight:900,
            color:'#fff', lineHeight:1.15, margin:'0 0 16px',
            letterSpacing:'-0.02em',
          }}>
            Seu sistema imobiliário<br/>
            <span style={{
              background:'linear-gradient(90deg, #5ba8f0, #a0d4ff)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>
              completo e moderno
            </span>
          </h1>

          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, lineHeight:1.7, margin:'0 0 32px' }}>
            Do cadastro da empresa ao fechamento da venda — tudo em uma plataforma.
          </p>

          {/* bullets */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              ['Editor de mapas interativo', 'Desenhe loteamentos com precisão'],
              ['Dashboard em tempo real',    'Acompanhe vendas e disponibilidade'],
              ['Gestão multi-loteamento',    'Controle todo seu portfólio'],
            ].map(([title, sub]) => (
              <div key={title} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{
                  width:24, height:24, borderRadius:'50%', flexShrink:0,
                  background:'rgba(50,136,224,0.2)', border:'1px solid rgba(50,136,224,0.35)',
                  display:'flex', alignItems:'center', justifyContent:'center', marginTop:1,
                }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.9)', lineHeight:1.3 }}>{title}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* etapa ativa */}
        {step <= 4 && (
          <div style={{
            background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:14, padding:'16px 18px',
            display:'flex', alignItems:'center', gap:14,
          }}>
            <div style={{
              width:40, height:40, borderRadius:10, flexShrink:0,
              background:'rgba(50,136,224,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:18,
            }}>
              {current.icon}
            </div>
            <div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:600, marginBottom:2 }}>
                ETAPA {step} DE 4
              </div>
              <div style={{ fontSize:14, color:'#fff', fontWeight:700 }}>{current.title}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{current.sub}</div>
            </div>
          </div>
        )}

        {/* stats rodapé */}
        <div style={{
          display:'flex', gap:28, marginTop:24,
          paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.08)',
        }}>
          {[['200+','Empresas'],['50k','Lotes'],['R$2bi+','Em vendas']].map(([n, l]) => (
            <div key={l}>
              <div style={{ fontSize:16, fontWeight:800, color:'#fff', lineHeight:1 }}>{n}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errs, setErrs] = useState({});

  const [emp, setEmpRaw] = useState({ nome:'', cnpj:'', telefone:'', email:'', site:'', segmento:'' });
  const [end, setEndRaw] = useState({ cep:'', endereco:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'' });
  const [resp, setRespRaw] = useState({ nome:'', cpf:'', cargo:'', telefone:'' });
  const [acc, setAccRaw] = useState({ nome:'', login:'', email:'', telefone:'', senha:'', confirmar:'' });

  function setEmp(k, v)  { setEmpRaw(p => ({...p,[k]:v}));  setErrs(p => ({...p,[k]:''})); }
  function setEnd(k, v)  { setEndRaw(p => ({...p,[k]:v}));  setErrs(p => ({...p,[k]:''})); }
  function setResp(k, v) { setRespRaw(p => ({...p,[k]:v})); setErrs(p => ({...p,[k]:''})); }
  function setAcc(k, v)  { setAccRaw(p => ({...p,[k]:v}));  setErrs(p => ({...p,[k]:''})); }

  async function buscarCEP(raw) {
    const n = raw.replace(/\D/g,'');
    if (n.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${n}/json/`);
      const d = await r.json();
      if (!d.erro) setEndRaw(p => ({
        ...p,
        endereco: d.logradouro || p.endereco,
        bairro:   d.bairro     || p.bairro,
        cidade:   d.localidade || p.cidade,
        estado:   d.uf         || p.estado,
      }));
    } catch {} finally { setCepLoading(false); }
  }

  function validate(s) {
    const e = {};
    if (s === 1) {
      if (!emp.nome.trim()) e.nome = 'Nome da empresa é obrigatório';
      if (emp.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emp.email)) e.email = 'E-mail inválido';
    }
    if (s === 2) {
      if (!end.cep.trim())    e.cep    = 'CEP é obrigatório';
      if (!end.cidade.trim()) e.cidade = 'Cidade é obrigatória';
      if (!end.estado)        e.estado = 'Estado é obrigatório';
    }
    if (s === 3) {
      if (!resp.nome.trim())  e.rNome  = 'Nome do responsável é obrigatório';
      if (!resp.cargo.trim()) e.rCargo = 'Cargo é obrigatório';
    }
    if (s === 4) {
      if (!acc.nome.trim())  e.aNome = 'Nome completo é obrigatório';
      if (!acc.login.trim()) e.aLogin = 'Login é obrigatório';
      else if (!/^[a-zA-Z0-9._-]+$/.test(acc.login)) e.aLogin = 'Use apenas letras, números, . _ -';
      if (!acc.email.trim()) e.aEmail = 'E-mail é obrigatório';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc.email)) e.aEmail = 'E-mail inválido';
      if (!acc.senha)             e.aSenha = 'Senha é obrigatória';
      else if (acc.senha.length < 8) e.aSenha = 'Mínimo 8 caracteres';
      if (acc.senha !== acc.confirmar) e.aConfirmar = 'Senhas não conferem';
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function next()  { if (validate(step)) setStep(s => s + 1); }
  function back()  { setStep(s => s - 1); setApiError(''); }

  async function submit() {
    if (!validate(4)) return;
    setLoading(true); setApiError('');
    try {
      const r = await fetch('/api-proxy/empresas/onboarding', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          empresa: {
            nome:        emp.nome,
            cnpj:        emp.cnpj.replace(/\D/g,'') || undefined,
            telefone:    emp.telefone.replace(/\D/g,'') || undefined,
            email:       emp.email || undefined,
            cep:         end.cep.replace(/\D/g,'') || undefined,
            endereco:    end.endereco || undefined,
            numero:      end.numero || undefined,
            complemento: end.complemento || undefined,
            bairro:      end.bairro || undefined,
            cidade:      end.cidade || undefined,
            estado:      end.estado || undefined,
          },
          usuario: {
            nome:     acc.nome,
            login:    acc.login,
            email:    acc.email,
            telefone: acc.telefone.replace(/\D/g,'') || undefined,
            senha:    acc.senha,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        const msg = data?.message;
        setApiError(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : 'Erro ao cadastrar.');
        return;
      }
      setStep(5);
    } catch { setApiError('Erro de conexão. Verifique sua internet.'); }
    finally  { setLoading(false); }
  }

  /* ── tela de sucesso ── */
  if (step === 5) {
    return (
      <div style={{
        position:'fixed', inset:0, display:'flex',
        fontFamily:"'Manrope', system-ui, sans-serif", WebkitFontSmoothing:'antialiased',
      }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <LeftPanel step={step}/>
        <div style={{
          flex:1, background: C.light, display:'flex',
          alignItems:'center', justifyContent:'center', padding:32,
        }}>
          <div style={{
            background:'#fff', borderRadius:24, border:`1px solid ${C.border}`,
            boxShadow:'0 24px 60px rgba(0,30,80,0.1)',
            padding:'56px 48px', textAlign:'center', maxWidth:440, width:'100%',
          }}>
            <div style={{
              width:72, height:72, borderRadius:'50%',
              background:'rgba(50,136,224,0.1)', border:`2px solid rgba(50,136,224,0.25)`,
              display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px',
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M7 16l5 5 13-13" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize:26, fontWeight:800, color: C.navy, margin:'0 0 12px' }}>
              Conta criada com sucesso!
            </h2>
            <p style={{ color: C.muted, fontSize:15, lineHeight:1.65, margin:'0 0 8px' }}>
              A empresa <strong style={{ color: C.navy }}>{emp.nome}</strong> foi cadastrada.
            </p>
            <p style={{ color: C.muted, fontSize:14, margin:'0 0 36px' }}>
              Acesse com o login <strong style={{ color: C.blue }}>{acc.login}</strong> ou seu e-mail.
            </p>
            <button onClick={() => router.push(LOGIN_URL)} style={{
              width:'100%', padding:'14px', borderRadius:10,
              background: C.blue, color:'#fff', border:'none',
              fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'inherit',
              boxShadow:'0 4px 16px rgba(50,136,224,0.35)',
            }}>
              Ir para o login →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── layout principal split ── */
  return (
    <div style={{
      position:'fixed', inset:0, display:'flex',
      fontFamily:"'Manrope', system-ui, sans-serif", WebkitFontSmoothing:'antialiased',
      overflow:'hidden',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* painel esquerdo */}
      <LeftPanel step={step}/>

      {/* painel direito — scrollável */}
      <div style={{
        flex:1, background:'#fff',
        overflowY:'auto', overflowX:'hidden',
        display:'flex', flexDirection:'column',
      }}>
        {/* topo com link de login */}
        <div style={{
          padding:'18px 48px',
          display:'flex', justifyContent:'flex-end', alignItems:'center',
          borderBottom:`1px solid ${C.border}`,
          flexShrink:0,
        }}>
          <span style={{ fontSize:13, color: C.muted }}>
            Já tem conta?{' '}
            <a href={LOGIN_URL} style={{ color: C.blue, fontWeight:700, textDecoration:'none' }}>Entrar</a>
          </span>
        </div>

        {/* formulário */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column', justifyContent:'center',
          padding:'40px 56px 60px',
          maxWidth:600, width:'100%', margin:'0 auto',
          boxSizing:'border-box',
        }}>
          <StepBar step={step}/>

          {/* ── ETAPA 1: Empresa ── */}
          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ marginBottom:4 }}>
                <h2 style={{ fontSize:24, fontWeight:800, color: C.navy, margin:'0 0 6px' }}>Dados da empresa</h2>
                <p style={{ color: C.muted, fontSize:14, margin:0, lineHeight:1.6 }}>Informações básicas da sua imobiliária ou loteadora.</p>
              </div>

              <Field label="Razão social / Nome da empresa" required error={errs.nome}>
                <Input value={emp.nome} onChange={e=>setEmp('nome',e.target.value)} placeholder="Ex: Imobiliária Silva Ltda" maxLength={200} error={errs.nome}/>
              </Field>

              <div style={g2}>
                <Field label="CNPJ" hint="opcional" error={errs.cnpj}>
                  <Input value={emp.cnpj} onChange={e=>setEmp('cnpj',mask.cnpj(e.target.value))} placeholder="00.000.000/0000-00" error={errs.cnpj}/>
                </Field>
                <Field label="Segmento" hint="opcional">
                  <Select value={emp.segmento} onChange={e=>setEmp('segmento',e.target.value)}>
                    <option value="">Selecione...</option>
                    {['Loteadora','Imobiliária','Construtora','Incorporadora','Outro'].map(s=>(
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div style={g2}>
                <Field label="Telefone" hint="opcional">
                  <Input value={emp.telefone} onChange={e=>setEmp('telefone',mask.phone(e.target.value))} placeholder="(00) 00000-0000"/>
                </Field>
                <Field label="E-mail corporativo" hint="opcional" error={errs.email}>
                  <Input type="email" value={emp.email} onChange={e=>setEmp('email',e.target.value)} placeholder="contato@empresa.com.br" error={errs.email}/>
                </Field>
              </div>

              <Field label="Site" hint="opcional">
                <Input value={emp.site} onChange={e=>setEmp('site',e.target.value)} placeholder="https://www.empresa.com.br"/>
              </Field>
            </div>
          )}

          {/* ── ETAPA 2: Endereço ── */}
          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ marginBottom:4 }}>
                <h2 style={{ fontSize:24, fontWeight:800, color: C.navy, margin:'0 0 6px' }}>Endereço da empresa</h2>
                <p style={{ color: C.muted, fontSize:14, margin:0, lineHeight:1.6 }}>Localização da sua sede ou filial principal.</p>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:14, alignItems:'end' }}>
                <Field label="CEP" required error={errs.cep}>
                  <div style={{ position:'relative' }}>
                    <Input
                      value={end.cep}
                      onChange={e=>{
                        const v = mask.cep(e.target.value);
                        setEnd('cep',v);
                        if (v.replace(/\D/g,'').length===8) buscarCEP(v);
                      }}
                      placeholder="00000-000"
                      error={errs.cep}
                    />
                    {cepLoading && (
                      <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color: C.muted }}>
                        buscando...
                      </span>
                    )}
                  </div>
                </Field>
                <Field label="Endereço (rua / avenida)">
                  <Input value={end.endereco} onChange={e=>setEnd('endereco',e.target.value)} placeholder="Rua das Flores" maxLength={255}/>
                </Field>
              </div>

              <div style={g2}>
                <Field label="Número">
                  <Input value={end.numero} onChange={e=>setEnd('numero',e.target.value)} placeholder="123" maxLength={20}/>
                </Field>
                <Field label="Complemento" hint="opcional">
                  <Input value={end.complemento} onChange={e=>setEnd('complemento',e.target.value)} placeholder="Sala 10, Andar 2..." maxLength={100}/>
                </Field>
              </div>

              <Field label="Bairro">
                <Input value={end.bairro} onChange={e=>setEnd('bairro',e.target.value)} placeholder="Centro" maxLength={200}/>
              </Field>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:14 }}>
                <Field label="Cidade" required error={errs.cidade}>
                  <Input value={end.cidade} onChange={e=>setEnd('cidade',e.target.value)} placeholder="São Paulo" maxLength={200} error={errs.cidade}/>
                </Field>
                <Field label="Estado" required error={errs.estado}>
                  <Select value={end.estado} onChange={e=>setEnd('estado',e.target.value)} error={errs.estado}>
                    <option value="">UF</option>
                    {ESTADOS.map(uf=><option key={uf} value={uf}>{uf}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: Responsável ── */}
          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ marginBottom:4 }}>
                <h2 style={{ fontSize:24, fontWeight:800, color: C.navy, margin:'0 0 6px' }}>Responsável legal</h2>
                <p style={{ color: C.muted, fontSize:14, margin:0, lineHeight:1.6 }}>Dados do responsável ou sócio administrador da empresa.</p>
              </div>

              <Field label="Nome completo do responsável" required error={errs.rNome}>
                <Input value={resp.nome} onChange={e=>setResp('nome',e.target.value)} placeholder="João da Silva" maxLength={200} error={errs.rNome}/>
              </Field>

              <div style={g2}>
                <Field label="CPF" hint="opcional">
                  <Input
                    value={resp.cpf}
                    onChange={e=>{
                      const n = e.target.value.replace(/\D/g,'').slice(0,11);
                      setResp('cpf', n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2'));
                    }}
                    placeholder="000.000.000-00"
                  />
                </Field>
                <Field label="Cargo / Função" required error={errs.rCargo}>
                  <Select value={resp.cargo} onChange={e=>setResp('cargo',e.target.value)} error={errs.rCargo}>
                    <option value="">Selecione...</option>
                    {['Sócio-proprietário','Diretor','Gerente','Administrador','Outro'].map(c=>(
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Telefone do responsável" hint="opcional">
                <Input value={resp.telefone} onChange={e=>setResp('telefone',mask.phone(e.target.value))} placeholder="(00) 00000-0000"/>
              </Field>

              <div style={{
                background:'rgba(50,136,224,0.06)', border:'1px solid rgba(50,136,224,0.2)',
                borderRadius:10, padding:'14px 16px',
                display:'flex', gap:12, alignItems:'flex-start',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                  <circle cx="12" cy="12" r="9" stroke={C.blue} strokeWidth="1.8"/>
                  <path d="M12 8v4M12 16h.01" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <p style={{ margin:0, fontSize:13, color: C.muted, lineHeight:1.55 }}>
                  Essas informações são utilizadas apenas para fins de cadastro e não são compartilhadas com terceiros.
                </p>
              </div>
            </div>
          )}

          {/* ── ETAPA 4: Acesso ── */}
          {step === 4 && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ marginBottom:4 }}>
                <h2 style={{ fontSize:24, fontWeight:800, color: C.navy, margin:'0 0 6px' }}>Acesso ao sistema</h2>
                <p style={{ color: C.muted, fontSize:14, margin:0, lineHeight:1.6 }}>Crie o login do gerente principal da empresa. A partir dele você pode cadastrar vendedores e outros gerentes.</p>
              </div>

              <Field label="Nome completo" required error={errs.aNome}>
                <Input value={acc.nome} onChange={e=>setAcc('nome',e.target.value)} placeholder="João da Silva" maxLength={200} error={errs.aNome}/>
              </Field>

              <div style={g2}>
                <Field label="Login de acesso" required hint="Sem espaços" error={errs.aLogin}>
                  <Input
                    value={acc.login}
                    onChange={e=>setAcc('login',e.target.value.replace(/\s/g,'').toLowerCase())}
                    placeholder="joaosilva"
                    maxLength={100}
                    error={errs.aLogin}
                  />
                </Field>
                <Field label="Telefone" hint="opcional">
                  <Input value={acc.telefone} onChange={e=>setAcc('telefone',mask.phone(e.target.value))} placeholder="(00) 00000-0000"/>
                </Field>
              </div>

              <Field label="E-mail" required error={errs.aEmail}>
                <Input type="email" value={acc.email} onChange={e=>setAcc('email',e.target.value)} placeholder="joao@empresa.com.br" error={errs.aEmail}/>
              </Field>

              <div style={g2}>
                <Field label="Senha" required hint="Mín. 8 caracteres" error={errs.aSenha}>
                  <Input type="password" value={acc.senha} onChange={e=>setAcc('senha',e.target.value)} placeholder="••••••••" maxLength={72} error={errs.aSenha}/>
                </Field>
                <Field label="Confirmar senha" required error={errs.aConfirmar}>
                  <Input type="password" value={acc.confirmar} onChange={e=>setAcc('confirmar',e.target.value)} placeholder="••••••••" maxLength={72} error={errs.aConfirmar}/>
                </Field>
              </div>

              {acc.senha && <PasswordStrength senha={acc.senha}/>}

              {apiError && (
                <div style={{
                  background:'#fff0f0', border:'1px solid #fca5a5',
                  borderRadius:9, padding:'12px 16px',
                  color:'#dc2626', fontSize:13, display:'flex', gap:8, alignItems:'flex-start',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                    <circle cx="12" cy="12" r="9" stroke="#dc2626" strokeWidth="1.8"/>
                    <path d="M12 8v4M12 16h.01" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  {apiError}
                </div>
              )}
            </div>
          )}

          {/* botões de navegação */}
          <div style={{ display:'flex', gap:10, marginTop:32 }}>
            {step > 1
              ? <BtnSecondary onClick={back}>← Voltar</BtnSecondary>
              : <BtnSecondary onClick={()=>router.push(LOGIN_URL)}>Já tenho conta</BtnSecondary>
            }
            {step < 4
              ? <BtnPrimary onClick={next}>Continuar →</BtnPrimary>
              : <BtnPrimary onClick={submit} loading={loading}>
                  {loading ? 'Criando conta...' : 'Criar conta →'}
                </BtnPrimary>
            }
          </div>

          <p style={{ textAlign:'center', marginTop:16, fontSize:12, color: C.dim }}>
            Etapa {step} de 4 · Seus dados estão protegidos com criptografia
          </p>
        </div>
      </div>
    </div>
  );
}
