'use client';

import { useState } from 'react';
import { fmtBRL, fmtBRLShort, statusLabel } from '../lib/data';
import { computeMetrics, flattenLots } from '../lib/api';
import { STATUS_COLORS } from './MapView';

export const Dashboard = ({
  loteamentos = [],
  predios = [],
  locacoesResumo = {},
  loading = false,
  onOpenLoteamento,
  onOpenEditor,
  onRefresh,
  onOpenPredios,
  canCreateLoteamento = false,
  canEditLoteamento = false,
  user = null,
  empresas = [],
  selectedEmpresa = null,
  onSelectEmpresa,
}) => {
  const isGerente = user?.role === 'gerente';
  const [showInativos, setShowInativos] = useState(false);

  const activeLoteamentos = loteamentos.filter((lt) => lt.ativo !== false);
  const displayedLoteamentos = (isGerente && showInativos) ? loteamentos : activeLoteamentos;
  const metrics = computeMetrics(loteamentos);
  const lots = flattenLots(loteamentos);
  const allSoldLots = lots.filter((lot) => lot.status === 'vendido');

  const isVendedor = user?.role === 'vendedor';
  const soldLots = isVendedor
    ? allSoldLots.filter((lot) => lot.cliente_vinculado_por === user?.id)
    : allSoldLots;
  const myVen = soldLots.length;
  const myVgvVendido = soldLots.reduce((sum, lot) => sum + (Number(lot.preco) || 0), 0);
  const displayMetrics = isVendedor ? { ...metrics, ven: myVen, vgvVendido: myVgvVendido } : metrics;

  const allAps = predios.flatMap((p) => (p.andares || []).flatMap((a) => a.apartamentos || []));
  const soldAps = isVendedor
    ? allAps.filter((ap) => ap.status === 'vendido' && ap.cliente_vinculado_por === user?.id)
    : allAps.filter((ap) => ap.status === 'vendido');
  const soldApsVgv = soldAps.reduce((s, ap) => s + (Number(ap.preco_venda) || 0), 0);
  const totalVendidos = (isVendedor ? myVen : metrics.ven) + soldAps.length;
  const totalVgvVendido = (isVendedor ? myVgvVendido : metrics.vgvVendido) + soldApsVgv;

  // Admin sem empresa selecionada: tela de seleção
  if (user?.role === 'admin' && !selectedEmpresa) {
    return (
      <div className="dash">
        <header className="dash-header">
          <div>
            <div className="dash-eyebrow">ADMINISTRADOR DO SISTEMA</div>
            <h1 className="dash-title">Selecione uma empresa para continuar.</h1>
            <p className="dash-sub">
              Você está logado como administrador do sistema. Escolha uma empresa na barra lateral ou abaixo para acessar os dados.
            </p>
          </div>
        </header>

        {empresas.length === 0 ? (
          <div className="lot-cards-empty">
            <p>Nenhuma empresa cadastrada no sistema.</p>
          </div>
        ) : (
          <div className="admin-empresa-grid">
            {empresas.map((emp) => (
              <button
                key={emp.id}
                className="admin-empresa-card"
                onClick={() => onSelectEmpresa?.(emp)}
              >
                <div className="aec-nome">{emp.nome}</div>
                <div className="aec-meta">
                  {[emp.cidade, emp.estado].filter(Boolean).join(' / ') || 'Local não informado'}
                </div>
                {emp.cnpj && <div className="aec-cnpj">{emp.cnpj}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <div className="dash-eyebrow">
            {user?.role === 'admin' && selectedEmpresa
              ? `EMPRESA: ${selectedEmpresa.nome}`
              : `PAINEL · ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </div>
          <h1 className="dash-title">{isVendedor ? 'Minhas vendas e desempenho.' : 'Cadastro e vendas de loteamentos.'}</h1>
          <p className="dash-sub">
            {loading
              ? 'Carregando loteamentos...'
              : loteamentos.length === 0
              ? canCreateLoteamento
                ? 'Nenhum loteamento cadastrado. Crie o primeiro para começar.'
                : 'Nenhum loteamento cadastrado para esta empresa.'
              : isVendedor
            ? <>Você vendeu <b>{totalVendidos} unidades</b> — {fmtBRLShort(totalVgvVendido)} em VGV realizado.</>
            : <>Você tem <b>{metrics.total} lotes cadastrados</b> e {totalVendidos} unidades vendidas (lotes + apartamentos).</>}
          </p>
        </div>
        {canCreateLoteamento && (
          <div className="dash-quick">
            <button className="qa-btn qa-btn-primary" onClick={() => onOpenEditor?.(null)}>
              <span className="qa-ic" style={{ color: '#ffffff' }}>✎</span>
              Novo loteamento
            </button>
          </div>
        )}
      </header>

      <section className="metric-grid">
        {isVendedor ? (
          <>
            <MetricCard
              label="Minhas vendas"
              value={totalVendidos}
              delta={totalVendidos > 0 ? fmtBRLShort(totalVgvVendido) : '—'}
              sub={soldAps.length > 0 ? `${myVen} lotes · ${soldAps.length} aptos` : 'VGV realizado por você'}
              big
            />
            <MetricCard
              label="Loteamentos"
              value={loteamentos.length}
              delta={metrics.total > 0 ? `${metrics.total} lotes` : '—'}
              sub="empreendimentos no cadastro"
              color="blue"
            />
            <MetricCard
              label="Disponíveis"
              value={metrics.disp}
              delta={metrics.total > 0 ? `${Math.round((metrics.disp / metrics.total) * 100)}%` : '—'}
              sub="lotes em estoque"
              color="emerald"
            />
            <MetricCard
              label="Meu VGV"
              value={fmtBRLShort(totalVgvVendido)}
              delta={totalVendidos > 0 ? `${totalVendidos} unid.` : '—'}
              sub="total vendido por você"
              color="red"
            />
          </>
        ) : (
          <>
            <MetricCard
              label="VGV cadastrado"
              value={fmtBRLShort(metrics.vgvTotal)}
              delta={loteamentos.length > 0 ? `${loteamentos.length} loteamentos` : '—'}
              sub={`${metrics.total} lotes cadastrados`}
              big
            />
            <MetricCard
              label="Loteamentos"
              value={loteamentos.length}
              delta={metrics.total > 0 ? `${metrics.total} lotes` : '—'}
              sub="empreendimentos no cadastro"
              color="blue"
            />
            <MetricCard
              label="Disponíveis"
              value={metrics.disp}
              delta={metrics.total > 0 ? `${Math.round((metrics.disp / metrics.total) * 100)}%` : '—'}
              sub="lotes em estoque"
              color="emerald"
            />
            <MetricCard
              label="Vendidos"
              value={totalVendidos}
              delta={totalVendidos > 0 ? fmtBRLShort(totalVgvVendido) : '—'}
              sub={soldAps.length > 0 ? `${metrics.ven} lotes · ${soldAps.length} aptos` : 'VGV realizado'}
              color="red"
            />
            {predios.length > 0 && (
              <MetricCard
                label="Prédios"
                value={predios.length}
                delta={predios.reduce((s, p) => s + (p.stats?.total || 0), 0) + ' aptos'}
                sub="cadastrados no sistema"
                color="blue"
              />
            )}
            <MetricCard
              label="Receita de aluguéis"
              value={fmtBRLShort(locacoesResumo.receita_mensal || 0)}
              delta={`${locacoesResumo.total_ativas || 0} contratos`}
              sub="receita mensal contratada"
              color="emerald"
            />
            <MetricCard
              label="Ocupação de locações"
              value={`${locacoesResumo.ocupacao_percentual || 0}%`}
              delta={`${locacoesResumo.unidades_vagas || 0} vagas`}
              sub="apartamentos disponíveis para locação"
              color="blue"
            />
          </>
        )}
      </section>

      {predios.length > 0 && (
        <section className="dash-predios-summary">
          <header className="sec-header">
            <h2 className="sec-title">Prédios</h2>
            <button className="sec-tool-btn" onClick={onOpenPredios}>
              Ver todos
            </button>
          </header>
          <div className="predios-mini-list">
            {predios.slice(0, 3).map((p) => {
              const stats = p.stats || {};
              const total = stats.total || 0;
              const ocupPct = total > 0 ? Math.round(((total - (stats.disponivel || 0)) / total) * 100) : 0;
              return (
                <button key={p.id} className="predio-mini-card" onClick={onOpenPredios}>
                  <div className="pmc-name">{p.nome}</div>
                  <div className="pmc-info">{p.num_andares} andares · {total} aptos</div>
                  <div className="pmc-bar">
                    <div className="pmc-bar-fill" style={{ width: `${ocupPct}%`, background: p.cor || '#3288e0' }} />
                  </div>
                  <div className="pmc-pct">{ocupPct}% ocupado</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="dash-split">
        <section className="dash-loteamentos">
          <header className="sec-header">
            <h2 className="sec-title">Loteamentos</h2>
            <div className="sec-tools">
              {isGerente && loteamentos.some((lt) => lt.ativo === false) && (
                <button
                  className="sec-tool-btn"
                  onClick={() => setShowInativos((v) => !v)}
                  style={{ color: showInativos ? 'var(--accent)' : undefined }}
                  title={showInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
                >
                  {showInativos ? 'Ocultar inativos' : 'Ver inativos'}
                </button>
              )}
              <button className="sec-tool-btn" onClick={onRefresh} title="Atualizar">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76L14 2v4h-4l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Atualizar
              </button>
            </div>
          </header>

          {loading ? (
            <div className="lot-cards-loading">
              <div className="loading-card" />
              <div className="loading-card" />
            </div>
          ) : displayedLoteamentos.length === 0 ? (
            <div className="lot-cards-empty">
              <p>Nenhum loteamento encontrado.</p>
              {canCreateLoteamento && (
                <button className="qa-btn qa-btn-primary" style={{ marginTop: 12 }} onClick={() => onOpenEditor?.(null)}>
                  Criar primeiro loteamento
                </button>
              )}
            </div>
          ) : (
            <div className="lot-cards">
              {displayedLoteamentos.map((loteamento) => (
                <LoteamentoCard
                  key={loteamento.id}
                  loteamento={loteamento}
                  onClick={() => onOpenLoteamento(loteamento.id)}
                  onEdit={canEditLoteamento ? () => onOpenEditor?.(loteamento) : null}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="dash-side">
          <SoldLotsPanel soldLots={soldLots} onOpenLoteamento={onOpenLoteamento} isVendedor={isVendedor} />
        </aside>
      </div>
    </div>
  );
};

function MetricCard({ label, value, delta, sub, color, big }) {
  const colorMap = {
    emerald: 'var(--accent)',
    amber: 'var(--amber)',
    red: 'var(--red)',
    blue: 'var(--blue)',
  };
  const accent = colorMap[color] || 'var(--accent)';
  return (
    <div className={'metric-card' + (big ? ' metric-card-big' : '')}>
      <div className="mc-top">
        <span className="mc-label">{label}</span>
        <span className="mc-delta" style={{ color: accent }}>{delta}</span>
      </div>
      <div className="mc-value">{value}</div>
      <div className="mc-sub">{sub}</div>
      <div className="mc-rail" style={{ background: accent }} />
    </div>
  );
}

export function LoteamentoCard({ loteamento, onClick, onEdit, onToggleAtivo, toggling, canShare }) {
  const lots = loteamento.lots || [];
  const counts = { disponivel: 0, reservado: 0, vendido: 0 };
  for (const lot of lots) counts[lot.status] = (counts[lot.status] || 0) + 1;
  const pctSold = lots.length > 0 ? Math.round((counts.vendido / lots.length) * 100) : 0;
  const location = [loteamento.bairro, loteamento.cidade, loteamento.estado].filter(Boolean).join(' · ');
  const inativo = loteamento.ativo === false;

  return (
    <div className="lot-card-row" onClick={onClick} style={inativo ? { opacity: 0.65 } : undefined}>
      <div className="lcr-map">
        <MiniMap loteamento={loteamento} />
      </div>
      <div className="lcr-body">
        <div className="lcr-head">
          <div>
            <div className="lcr-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {loteamento.fase || 'Loteamento'}
              {inativo && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                  padding: '1px 7px', borderRadius: 20,
                  background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5',
                }}>INATIVO</span>
              )}
            </div>
            <div className="lcr-title">{loteamento.nome}</div>
            <div className="lcr-loc">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M8 14s5-4.5 5-8.5a5 5 0 0 0-10 0c0 4 5 8.5 5 8.5z" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              {location || 'Local não informado'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onToggleAtivo && (
              <button
                className="lcr-edit"
                onClick={(e) => { e.stopPropagation(); onToggleAtivo(); }}
                disabled={toggling}
                title={inativo ? 'Reativar loteamento' : 'Arquivar loteamento'}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                  border: inativo ? '1px solid #86efac' : '1px solid #fca5a5',
                  color: inativo ? '#15803d' : '#dc2626',
                  background: 'transparent', width: 'auto', height: 'auto',
                }}
              >
                {toggling ? '...' : inativo ? 'Reativar' : 'Arquivar'}
              </button>
            )}
            {onEdit && (
              <button className="lcr-edit" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Editar cadastro e mapa">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            )}
            {canShare && (
              <button
                className="lcr-edit"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = `${window.location.origin}/loteamento/${loteamento.id}`;
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).then(() => alert('Link copiado: ' + url));
                  } else {
                    window.open(url, '_blank');
                  }
                }}
                title="Copiar link público do loteamento"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M7 9a3 3 0 0 0 4.5.4l2-2A3 3 0 0 0 9 3L7.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M9 7a3 3 0 0 0-4.5-.4l-2 2A3 3 0 0 0 7 13l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            )}
            <button className="lcr-open">
              Abrir mapa
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="lcr-stats">
          <div className="lcr-stat">
            <span className="lcr-stat-k">Lotes</span>
            <span className="lcr-stat-v">{lots.length}</span>
          </div>
          <div className="lcr-stat">
            <span className="lcr-stat-k">Área total</span>
            <span className="lcr-stat-v">{loteamento.area_total || '—'}</span>
          </div>
          <div className="lcr-stat">
            <span className="lcr-stat-k">Disponíveis</span>
            <span className="lcr-stat-v">{counts.disponivel}</span>
          </div>
          <div className="lcr-stat">
            <span className="lcr-stat-k">Vendidos</span>
            <span className="lcr-stat-v">{counts.vendido}</span>
          </div>
        </div>

        {lots.length > 0 && (
          <div className="lcr-progress">
            <div className="lcr-prog-head">
              <span>Vendido</span>
              <b>{pctSold}%</b>
            </div>
            <div className="lcr-prog-bar">
              <div className="lcr-prog-seg lcr-prog-vendido" style={{ flex: counts.vendido || 0 }} title={`${counts.vendido} vendidos`} />
              {counts.reservado > 0 && (
                <div className="lcr-prog-seg lcr-prog-reservado" style={{ flex: counts.reservado }} title={`${counts.reservado} reservados`} />
              )}
              <div className="lcr-prog-seg lcr-prog-disponivel" style={{ flex: counts.disponivel || 0 }} title={`${counts.disponivel} disponíveis`} />
            </div>
            <div className="lcr-prog-legend">
              <span><i style={{ background: '#ef4444' }} /> {counts.vendido || 0} vendidos</span>
              {counts.reservado > 0 && <span><i style={{ background: '#f59e0b' }} /> {counts.reservado} reservados</span>}
              <span><i style={{ background: '#3288e0' }} /> {counts.disponivel || 0} disponíveis</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MiniMap({ loteamento }) {
  const lots = loteamento.lots || [];
  const viewBox = loteamento.viewBox || '0 0 1400 900';
  const [, , width = 1400, height = 900] = viewBox.split(' ').map(Number);
  const uid = loteamento.id || 'mm';

  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="mini-svg">
      <defs>
        <pattern id={`mm-fundo-${uid}`} patternUnits="userSpaceOnUse" width="512" height="512">
          <image href="/textures/fundo.jpg" x="0" y="0" width="512" height="512" />
        </pattern>
        <pattern id={`mm-praca-${uid}`} patternUnits="userSpaceOnUse" width="512" height="512">
          <image href="/textures/praca.jpg" x="0" y="0" width="512" height="512" />
        </pattern>
        <pattern id={`mm-lago-${uid}`} patternUnits="userSpaceOnUse" width="512" height="512">
          <image href="/textures/lago.jpg" x="0" y="0" width="512" height="512" />
        </pattern>
      </defs>

      {/* Background */}
      <rect width={width} height={height} fill={`url(#mm-fundo-${uid})`} />

      {/* Roads — sidewalk outer + asphalt inner */}
      {(loteamento.roads || []).map((road, i) => (
        road.kind === 'rect' && (
          <g key={i}>
            <rect x={road.x} y={road.y} width={road.w} height={road.h} fill="#ccc8b8" />
            <rect x={road.x + road.w * 0.14} y={road.y + road.h * 0.14}
              width={road.w * 0.72} height={road.h * 0.72} fill="#4a4d4f" />
          </g>
        )
      ))}
      {(loteamento.curvedRoads || []).map((road, i) => {
        const w = road.width || 60;
        return (
          <g key={i}>
            <path d={road.d} fill="none" stroke="#ccc8b8" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
            <path d={road.d} fill="none" stroke="#4a4d4f" strokeWidth={Math.round(w * 0.72)} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}

      {/* Landmarks */}
      {(loteamento.landmarks || []).map((lm, i) => {
        if (lm.kind === 'lake') {
          const lf = `url(#mm-lago-${uid})`;
          const E = 10;
          if (lm.lakeShape === 'rect') return (
            <g key={i}>
              <rect x={lm.x - E} y={lm.y - E} width={lm.w + E*2} height={lm.h + E*2} fill="#9c7840" rx="8" />
              <rect x={lm.x} y={lm.y} width={lm.w} height={lm.h} fill={lf} rx="5" />
            </g>
          );
          if (lm.lakeShape === 'poly') {
            const d = lm.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
            return (
              <g key={i}>
                <path d={d} fill="#9c7840" stroke="#9c7840" strokeWidth={E * 2} strokeLinejoin="round" paintOrder="stroke fill" />
                <path d={d} fill={lf} />
              </g>
            );
          }
          return (
            <g key={i}>
              <ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx + E} ry={lm.ry + E} fill="#9c7840" />
              <ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx} ry={lm.ry} fill={lf} />
            </g>
          );
        }
        if (lm.kind === 'praca') {
          const fill = `url(#mm-praca-${uid})`;
          if (lm.pracaShape === 'ellipse') return <ellipse key={i} cx={lm.cx} cy={lm.cy} rx={lm.rx} ry={lm.ry} fill={fill} />;
          if (lm.pracaShape === 'poly') {
            const d = lm.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
            return <path key={i} d={d} fill={fill} />;
          }
          return <rect key={i} x={lm.x + 8} y={lm.y + 8} width={(lm.w || 0) - 16} height={(lm.h || 0) - 16} fill={fill} />;
        }
        return null;
      })}

      {/* Trees */}
      {(loteamento.trees || []).map((tree, i) => {
        const [x, y, treeType = 1] = tree;
        const TREE_CFG = {
          1: { href: '/textures/trees/tree_01.png', s: 60 },
          2: { href: '/textures/trees/tree_02.png', s: 90 },
          3: { href: '/textures/trees/tree_03.png', s: 65 },
          4: { href: '/textures/trees/tree_04.png', s: 85 },
          5: { href: '/textures/trees/tree_05.png', s: 75 },
        };
        const cfg = TREE_CFG[treeType] || TREE_CFG[1];
        const half = cfg.s / 2;
        return <image key={`t-${i}`} href={cfg.href} x={x - half} y={y - half} width={cfg.s} height={cfg.s} />;
      })}

      {/* Lots */}
      {lots.map((lot) => {
        const status = STATUS_COLORS[lot.status] || STATUS_COLORS.disponivel;
        return <polygon key={lot.db_id || lot.id} points={lot.polygon} fill={status.fill} fillOpacity="0.65" stroke={status.stroke} strokeWidth="2" />;
      })}
    </svg>
  );
}

function SoldLotsPanel({ soldLots, onOpenLoteamento, isVendedor }) {
  const total = soldLots.reduce((sum, lot) => sum + (Number(lot.preco) || 0), 0);

  return (
    <div className="side-card">
      <div className="side-head">
        <h3 className="side-title">{isVendedor ? 'Minhas vendas' : 'Vendas registradas'}</h3>
        <span className="side-link">{soldLots.length} lotes</span>
      </div>
      <div className="sale-total">
        <span>VGV vendido</span>
        <b>{fmtBRLShort(total)}</b>
      </div>
      {soldLots.length === 0 ? (
        <p className="side-empty">{isVendedor ? 'Você ainda não registrou nenhuma venda.' : 'Nenhuma venda registrada nos loteamentos carregados.'}</p>
      ) : (
        <ul className="sale-list">
          {soldLots.slice(0, 6).map((lot) => (
            <li key={lot.db_id || `${lot.loteamentoId}-${lot.id}`}>
              <button className="sale-item" onClick={() => onOpenLoteamento?.(lot.loteamentoId)}>
                <div className="sale-row-top">
                  <span className="sale-lot">{lot.id}</span>
                  <StatusPill status={lot.status} />
                </div>
                <div className="sale-name">{lot.loteamentoNome}</div>
                <div className="sale-meta">{fmtBRL(lot.preco)} · Quadra {lot.quadra || '—'}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.disponivel;
  return (
    <span className="status-pill" style={{ color: colors.label, background: colors.glow }}>
      <span style={{ background: colors.fill }} />
      {statusLabel(status)}
    </span>
  );
}
