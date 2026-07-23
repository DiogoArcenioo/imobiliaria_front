'use client';

import { useEffect, useState } from 'react';
import { fmtBRL, fmtBRLShort, statusLabel } from '../lib/data';
import { computeMetrics, flattenLots, getAgendaItems } from '../lib/api';
import { userHasModule } from '../lib/modules';
import { STATUS_COLORS } from './MapView';
import { copyTemporaryPropertyLink } from '../lib/public-share';

export const Dashboard = ({
  loteamentos = [],
  predios = [],
  locacoesResumo = {},
  loading = false,
  onOpenLoteamento,
  onOpenEditor,
  onRefresh,
  onOpenPredios,
  onOpenLoteamentos,
  canCreateLoteamento = false,
  canEditLoteamento = false,
  user = null,
  empresas = [],
  selectedEmpresa = null,
  onSelectEmpresa,
}) => {
  const isGerente = user?.role === 'gerente';
  const isVendedor = user?.role === 'vendedor';
  const canSeeLoteamentos = !isVendedor || userHasModule(user, 'loteamentos');
  const canSeeLotes = !isVendedor || userHasModule(user, 'lotes') || canSeeLoteamentos;
  const canSeePredios = !isVendedor || userHasModule(user, 'predios');
  const canSeeLocacoes = !isVendedor || userHasModule(user, 'locacoes');
  const canSeeAgenda = !isVendedor || userHasModule(user, 'agenda');
  const [showInativos, setShowInativos] = useState(false);
  const [agendaItems, setAgendaItems] = useState([]);
  const [agendaLoading, setAgendaLoading] = useState(false);

  useEffect(() => {
    if (!user || !canSeeAgenda || (user.role === 'admin' && !selectedEmpresa)) {
      setAgendaItems([]);
      return;
    }

    let alive = true;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const future = new Date(now);
    future.setDate(future.getDate() + 90);

    setAgendaLoading(true);
    getAgendaItems({
      inicio: todayStart.toISOString(),
      fim: future.toISOString(),
      escopo: 'minha',
    })
      .then((items) => {
        if (!alive) return;
        const next = (Array.isArray(items) ? items : [])
          .filter((item) => {
            const end = item.data_fim ? new Date(item.data_fim) : new Date(item.data_inicio);
            return end >= now && item.status !== 'cancelado';
          })
          .sort((a, b) => new Date(a.data_inicio || 0) - new Date(b.data_inicio || 0))
          .slice(0, 7);
        setAgendaItems(next);
      })
      .catch(() => {
        if (alive) setAgendaItems([]);
      })
      .finally(() => {
        if (alive) setAgendaLoading(false);
      });

    return () => { alive = false; };
  }, [user, canSeeAgenda, selectedEmpresa]);

  const activeLoteamentos = loteamentos.filter((lt) => lt.ativo !== false);
  const displayedLoteamentos = (isGerente && showInativos) ? loteamentos : activeLoteamentos;
  const metrics = computeMetrics(loteamentos);
  const lots = flattenLots(loteamentos);
  const allSoldLots = lots.filter((lot) => lot.status === 'vendido');

  const soldLots = (isVendedor
    ? allSoldLots.filter((lot) => lot.cliente_vinculado_por === user?.id)
    : allSoldLots
  ).sort((a, b) => new Date(b.vendido_em || b.atualizado_em || 0) - new Date(a.vendido_em || a.atualizado_em || 0));

  const myVen = soldLots.length;
  const myVgvVendido = soldLots.reduce((sum, lot) => sum + (Number(lot.preco) || 0), 0);

  const allAps = predios.flatMap((p) => (p.andares || []).flatMap((a) => a.apartamentos || []));
  const soldAps = (isVendedor
    ? allAps.filter((ap) => ap.status === 'vendido' && ap.cliente_vinculado_por === user?.id)
    : allAps.filter((ap) => ap.status === 'vendido')
  ).sort((a, b) => new Date(b.vendido_em || b.atualizado_em || 0) - new Date(a.vendido_em || a.atualizado_em || 0));

  const soldApsVgv = soldAps.reduce((s, ap) => s + (Number(ap.preco_venda) || 0), 0);
  const totalVendidos = (isVendedor ? myVen : metrics.ven) + soldAps.length;
  const totalVgvVendido = (isVendedor ? myVgvVendido : metrics.vgvVendido) + soldApsVgv;

  // Merge and sort all sales by date
  const allSales = [
    ...soldLots.map((l) => ({
      key: `lote-${l.db_id}`,
      tipo: 'Lote',
      codigo: l.id,
      projeto: l.loteamentoNome || '—',
      cliente: l.cliente?.nome || null,
      valor: Number(l.preco) || 0,
      data: l.vendido_em || l.atualizado_em,
      empreendimentoId: l.loteamentoId,
    })),
    ...soldAps.map((a) => ({
      key: `apto-${a.id}`,
      tipo: 'Apto',
      codigo: a.ap_id,
      projeto: predios.find((p) => p.id === a.predio_id)?.nome || '—',
      cliente: a.cliente?.nome || null,
      valor: Number(a.preco_venda) || 0,
      data: a.vendido_em || a.criado_em,
      empreendimentoId: null,
    })),
  ].sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

  const firstName = (user?.nome || user?.login || 'você').split(' ')[0];
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return `Bom dia, ${firstName}.`;
    if (h < 18) return `Boa tarde, ${firstName}.`;
    return `Boa noite, ${firstName}.`;
  };

  // Admin sem empresa: tela de seleção
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
          <div className="lot-cards-empty"><p>Nenhuma empresa cadastrada no sistema.</p></div>
        ) : (
          <div className="admin-empresa-grid">
            {empresas.map((emp) => (
              <button key={emp.id} className="admin-empresa-card" onClick={() => onSelectEmpresa?.(emp)}>
                <div className="aec-nome">{emp.nome}</div>
                <div className="aec-meta">{[emp.cidade, emp.estado].filter(Boolean).join(' / ') || 'Local não informado'}</div>
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

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="dash-header">
        <div>
          <div className="dash-eyebrow">
            {user?.role === 'admin' && selectedEmpresa
              ? `EMPRESA: ${selectedEmpresa.nome}`
              : new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </div>
          <h1 className="dash-title">{greeting()}</h1>
          <p className="dash-sub">
            {loading ? 'Carregando dados...' : isVendedor
              ? <>{totalVendidos > 0 ? <><b>{totalVendidos} unidades vendidas</b> · {fmtBRLShort(totalVgvVendido)} em vendas</> : 'Nenhuma venda registrada ainda.'}</>
              : <><b>{totalVendidos} unidades vendidas</b> · {fmtBRLShort(totalVgvVendido)} em valor realizado</>
            }
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

      {canSeeAgenda && (
        <AgendaPreviewCard items={agendaItems} loading={agendaLoading} />
      )}

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div className="db-stats-strip">
        <StatChip
          label="Total vendido"
          value={fmtBRLShort(totalVgvVendido)}
          sub={`${totalVendidos} unidades`}
          accent
        />
        {canSeeLotes && (
          <>
            <div className="db-stat-div" />
            <StatChip
              label="Lotes disponíveis"
              value={metrics.disp}
              sub={`de ${metrics.total} cadastrados`}
            />
          </>
        )}
        {canSeeLocacoes && (
          <>
            <div className="db-stat-div" />
            <StatChip
              label="Receita de aluguéis"
              value={fmtBRLShort(locacoesResumo.receita_mensal || 0)}
              sub={`${locacoesResumo.total_ativas || 0} contratos ativos`}
            />
            <div className="db-stat-div" />
            <StatChip
              label="Ocupação locações"
              value={`${locacoesResumo.ocupacao_percentual || 0}%`}
              sub={`${locacoesResumo.unidades_vagas || 0} vagas disponíveis`}
            />
          </>
        )}
        <div style={{ flex: 1 }} />
        <button className="db-refresh-btn" onClick={onRefresh} title="Atualizar">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76L14 2v4h-4l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* ── Main layout ─────────────────────────────────────────── */}
      <div className="db-main-grid">

        {/* Sales feed — protagonista */}
        <section className="db-sales-card">
          <div className="db-sales-head">
            <div>
              <div className="dash-eyebrow" style={{ marginBottom: 2 }}>ATIVIDADE</div>
              <h2 className="sec-title">{isVendedor ? 'Minhas vendas' : 'Últimas vendas'}</h2>
            </div>
            <div className="db-sales-vgv">
              <span>Total</span>
              <strong>{fmtBRLShort(totalVgvVendido)}</strong>
            </div>
          </div>

          {allSales.length === 0 ? (
            <div className="db-sales-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
              </svg>
              <p>Nenhuma venda registrada ainda.</p>
            </div>
          ) : (
            <div className="db-sales-list">
              {allSales.slice(0, 12).map((sale) => (
                <button
                  key={sale.key}
                  className="db-sale-row"
                  onClick={() => sale.empreendimentoId && onOpenLoteamento?.(sale.empreendimentoId)}
                  style={{ cursor: sale.empreendimentoId ? 'pointer' : 'default' }}
                >
                  <div className="db-sale-badge" data-tipo={sale.tipo}>
                    {sale.tipo === 'Lote' ? 'L' : 'A'}
                  </div>
                  <div className="db-sale-body">
                    <div className="db-sale-top">
                      <span className="db-sale-codigo">{sale.tipo} {sale.codigo}</span>
                      <span className="db-sale-projeto">{sale.projeto}</span>
                    </div>
                    {sale.cliente && (
                      <div className="db-sale-cliente">{sale.cliente}</div>
                    )}
                  </div>
                  <div className="db-sale-right">
                    <div className="db-sale-valor">{fmtBRL(sale.valor)}</div>
                    <div className="db-sale-data">
                      {sale.data
                        ? new Date(sale.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                        : '—'}
                    </div>
                  </div>
                </button>
              ))}
              {allSales.length > 12 && (
                <div className="db-sales-more">
                  +{allSales.length - 12} vendas — <span onClick={() => {}}>ver em Vendas</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Sidebar compacta */}
        <aside className="db-sidebar">

          {/* Prédios */}
          {canSeePredios && predios.length > 0 && (
            <div className="db-sidebar-card">
              <div className="sec-header" style={{ marginBottom: 12 }}>
                <h3 className="sec-title" style={{ fontSize: 15 }}>Prédios</h3>
                <button className="sec-tool-btn" onClick={onOpenPredios}>Ver todos</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {predios.slice(0, 4).map((p) => {
                  const stats = p.stats || {};
                  const total = stats.total || 0;
                  const ocupPct = total > 0 ? Math.round(((total - (stats.disponivel || 0)) / total) * 100) : 0;
                  return (
                    <button key={p.id} className="db-lt-row" onClick={onOpenPredios}>
                      <div className="db-lt-info">
                        <div className="db-lt-nome">{p.nome}</div>
                        <div className="db-lt-meta">{total} aptos · {p.num_andares || 0} andares</div>
                      </div>
                      <div className="db-lt-right">
                        <div className="db-lt-pct" style={{ color: ocupPct > 0 ? '#3288e0' : 'var(--text-muted)' }}>{ocupPct}%</div>
                        <div className="db-lt-sub">ocupado</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loteamentos */}
          {canSeeLoteamentos && (
          <div className="db-sidebar-card">
            <div className="sec-header" style={{ marginBottom: 12 }}>
              <h3 className="sec-title" style={{ fontSize: 15 }}>Loteamentos</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {isGerente && loteamentos.some((lt) => lt.ativo === false) && (
                  <button className="sec-tool-btn" onClick={() => setShowInativos((v) => !v)} style={{ color: showInativos ? 'var(--accent)' : undefined }}>
                    {showInativos ? 'Ocultar inativos' : 'Ver inativos'}
                  </button>
                )}
                <button className="sec-tool-btn" onClick={onOpenLoteamentos}>Ver todos</button>
              </div>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="loading-card" style={{ height: 52 }} />
                <div className="loading-card" style={{ height: 52 }} />
              </div>
            ) : displayedLoteamentos.length === 0 ? (
              <div className="lot-cards-empty" style={{ padding: '16px 0' }}>
                <p>Nenhum loteamento encontrado.</p>
                {canCreateLoteamento && (
                  <button className="qa-btn qa-btn-primary" style={{ marginTop: 10 }} onClick={() => onOpenEditor?.(null)}>
                    Criar primeiro loteamento
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {displayedLoteamentos.map((lt) => {
                  const ltLots = lt.lots || [];
                  const cnt = { disponivel: 0, reservado: 0, vendido: 0 };
                  for (const l of ltLots) cnt[l.status] = (cnt[l.status] || 0) + 1;
                  const pct = ltLots.length > 0 ? Math.round((cnt.vendido / ltLots.length) * 100) : 0;
                  const inativo = lt.ativo === false;
                  return (
                    <button key={lt.id} className="db-lt-row" onClick={() => onOpenLoteamento(lt.id)} style={inativo ? { opacity: 0.6 } : undefined}>
                      <div className="db-lt-info">
                        <div className="db-lt-nome">
                          {lt.nome}
                          {inativo && <span className="db-lt-inativo">INATIVO</span>}
                        </div>
                        <div className="db-lt-meta">
                          {[lt.cidade, lt.estado].filter(Boolean).join(' · ') || 'Local não informado'}
                          {' · '}{ltLots.length} lotes
                        </div>
                      </div>
                      <div className="db-lt-right">
                        <div className="db-lt-pct" style={{ color: pct > 0 ? '#ef4444' : 'var(--text-muted)' }}>{pct}%</div>
                        <div className="db-lt-sub">vendido</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </aside>
      </div>
    </div>
  );
};

// ── Componentes internos ─────────────────────────────────────────────────────

function StatChip({ label, value, sub, accent }) {
  return (
    <div className="db-stat-chip">
      <div className="db-stat-label">{label}</div>
      <div className="db-stat-value" style={accent ? { color: 'var(--accent)' } : undefined}>{value}</div>
      <div className="db-stat-sub">{sub}</div>
    </div>
  );
}

function AgendaPreviewCard({ items, loading }) {
  const [openItem, setOpenItem] = useState(null);
  const next = items[0] || null;
  const rest = items.slice(1);

  const typeColor = {
    tarefa: '#3288e0',
    visita: '#16a34a',
    atendimento: '#8b5cf6',
  };

  const typeLabel = {
    tarefa: 'Tarefa',
    visita: 'Visita',
    atendimento: 'Atendimento',
  };

  const whenLabel = (value) => {
    if (!value) return 'Sem horario';
    const date = new Date(value);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    const day = sameDay(date, today)
      ? 'Hoje'
      : sameDay(date, tomorrow)
      ? 'Amanha'
      : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${day}, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <section
      className="db-sales-card"
      style={{
        marginBottom: 18,
        background: 'linear-gradient(90deg, #eef7ff 0%, #f7fbff 68%, #ffffff 100%)',
        borderColor: '#bfdbfe',
        overflow: 'hidden',
      }}
    >
      <div
        className="db-sales-head"
        style={{
          padding: '14px 26px 12px',
          minHeight: 0,
          borderBottom: '1px solid #dbeafe',
          background: 'rgba(255,255,255,.42)',
        }}
      >
        <div>
          <div className="dash-eyebrow" style={{ marginBottom: 2 }}>AGENDA</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {items.length} próximo{items.length === 1 ? '' : 's'} evento{items.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="db-sales-vgv">
          <span>Próximos</span>
          <strong>{items.length}</strong>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '18px 26px', color: 'var(--text-muted)' }}>
          Carregando agenda...
        </div>
      ) : !next ? (
        <div style={{ padding: '18px 26px', color: 'var(--text-muted)' }}>
          Nenhum compromisso futuro cadastrado.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: rest.length > 0 ? 'minmax(0, 1.4fr) minmax(260px, .9fr)' : '1fr',
            alignItems: 'stretch',
          }}
        >
          <div style={{ padding: '16px 26px', minWidth: 0 }}>
            <div className="dash-eyebrow" style={{ marginBottom: 8 }}>PRÓXIMO EVENTO</div>
            <button
              type="button"
              onClick={() => setOpenItem(next)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                width: '100%',
                border: 0,
                background: 'transparent',
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                className="status-pill"
                style={{ color: typeColor[next.tipo] || '#3288e0', background: `${typeColor[next.tipo] || '#3288e0'}18`, flexShrink: 0, padding: '3px 8px' }}
              >
                {(typeLabel[next.tipo] || next.tipo).slice(0, 4)}
              </span>
              <strong style={{ color: 'var(--accent)', flexShrink: 0 }}>{whenLabel(next.data_inicio)}</strong>
              <strong style={{ color: 'var(--text)', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.titulo}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[next.local, next.descricao].filter(Boolean).join(' · ')}
              </span>
            </button>
          </div>
          {rest.length > 0 && (
            <div style={{ padding: '16px 22px', borderLeft: '1px solid #dbeafe', minWidth: 0 }}>
              <div className="dash-eyebrow" style={{ marginBottom: 8 }}>DEPOIS</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {rest.slice(0, 2).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOpenItem(item)}
                    style={{
                      display: 'flex',
                      gap: 8,
                      minWidth: 0,
                      fontSize: 13,
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ color: 'var(--accent)', flexShrink: 0 }}>{whenLabel(item.data_inicio)}</strong>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titulo}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {openItem && (
        <AgendaEventModal
          item={openItem}
          typeLabel={typeLabel}
          typeColor={typeColor}
          onClose={() => setOpenItem(null)}
        />
      )}
    </section>
  );
}

function AgendaEventModal({ item, typeLabel, typeColor, onClose }) {
  const dateFull = (value) => value
    ? new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Não informado';

  return (
    <div className="sale-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="sale-modal" style={{ maxWidth: 520 }}>
        <header className="sale-modal-head">
          <div>
            <div className="dash-eyebrow">DETALHES DA AGENDA</div>
            <h2>{item.titulo}</h2>
            <p>{typeLabel[item.tipo] || item.tipo}</p>
          </div>
          <button className="sale-modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div style={{ padding: 24, display: 'grid', gap: 14 }}>
          <span
            className="status-pill"
            style={{ justifySelf: 'start', color: typeColor[item.tipo] || '#3288e0', background: `${typeColor[item.tipo] || '#3288e0'}18` }}
          >
            {typeLabel[item.tipo] || item.tipo}
          </span>
          <div>
            <div className="db-stat-label">Início</div>
            <strong>{dateFull(item.data_inicio)}</strong>
          </div>
          <div>
            <div className="db-stat-label">Fim</div>
            <strong>{dateFull(item.data_fim)}</strong>
          </div>
          <div>
            <div className="db-stat-label">Local</div>
            <p style={{ margin: 0 }}>{item.local || 'Não informado'}</p>
          </div>
          <div>
            <div className="db-stat-label">Descrição</div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.descricao || 'Sem observações.'}</p>
          </div>
          {item.usuario && (
            <div>
              <div className="db-stat-label">Responsável</div>
              <p style={{ margin: 0 }}>{item.usuario.nome || item.usuario.login || item.usuario.email}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Exportados (usados em outros módulos) ────────────────────────────────────

export function LoteamentoCard({ loteamento, onClick, onEdit, onToggleAtivo, toggling, canShare }) {
  const [sharing, setSharing] = useState(false);
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
            {canShare && !inativo && (
              <button
                className="lcr-edit"
                disabled={sharing}
                onClick={async (e) => {
                  e.stopPropagation();
                  setSharing(true);
                  try {
                    await copyTemporaryPropertyLink('loteamento', loteamento.id, loteamento.nome);
                  } catch (error) {
                    alert(error.message || 'Nao foi possivel criar o link publico.');
                  } finally {
                    setSharing(false);
                  }
                }}
                title="Copiar link publico valido por 7 dias"
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
          <div className="lcr-stat"><span className="lcr-stat-k">Lotes</span><span className="lcr-stat-v">{lots.length}</span></div>
          <div className="lcr-stat"><span className="lcr-stat-k">Área total</span><span className="lcr-stat-v">{loteamento.area_total || '—'}</span></div>
          <div className="lcr-stat"><span className="lcr-stat-k">Disponíveis</span><span className="lcr-stat-v">{counts.disponivel}</span></div>
          <div className="lcr-stat"><span className="lcr-stat-k">Vendidos</span><span className="lcr-stat-v">{counts.vendido}</span></div>
        </div>

        {lots.length > 0 && (
          <div className="lcr-progress">
            <div className="lcr-prog-head"><span>Vendido</span><b>{pctSold}%</b></div>
            <div className="lcr-prog-bar">
              <div className="lcr-prog-seg lcr-prog-vendido" style={{ flex: counts.vendido || 0 }} />
              {counts.reservado > 0 && <div className="lcr-prog-seg lcr-prog-reservado" style={{ flex: counts.reservado }} />}
              <div className="lcr-prog-seg lcr-prog-disponivel" style={{ flex: counts.disponivel || 0 }} />
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
      <rect width={width} height={height} fill={`url(#mm-fundo-${uid})`} />
      {(loteamento.roads || []).map((road, i) => (
        road.kind === 'rect' && (
          <g key={i}>
            <rect x={road.x} y={road.y} width={road.w} height={road.h} fill="#ccc8b8" />
            <rect x={road.x + road.w * 0.14} y={road.y + road.h * 0.14} width={road.w * 0.72} height={road.h * 0.72} fill="#4a4d4f" />
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
      {(loteamento.landmarks || []).map((lm, i) => {
        if (lm.kind === 'lake') {
          const lf = `url(#mm-lago-${uid})`;
          const E = 10;
          if (lm.lakeShape === 'rect') return (<g key={i}><rect x={lm.x - E} y={lm.y - E} width={lm.w + E*2} height={lm.h + E*2} fill="#9c7840" rx="8" /><rect x={lm.x} y={lm.y} width={lm.w} height={lm.h} fill={lf} rx="5" /></g>);
          if (lm.lakeShape === 'poly') { const d = lm.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z'; return (<g key={i}><path d={d} fill="#9c7840" stroke="#9c7840" strokeWidth={E * 2} strokeLinejoin="round" paintOrder="stroke fill" /><path d={d} fill={lf} /></g>); }
          return (<g key={i}><ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx + E} ry={lm.ry + E} fill="#9c7840" /><ellipse cx={lm.cx} cy={lm.cy} rx={lm.rx} ry={lm.ry} fill={lf} /></g>);
        }
        if (lm.kind === 'praca') {
          const fill = `url(#mm-praca-${uid})`;
          if (lm.pracaShape === 'ellipse') return <ellipse key={i} cx={lm.cx} cy={lm.cy} rx={lm.rx} ry={lm.ry} fill={fill} />;
          if (lm.pracaShape === 'poly') { const d = lm.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z'; return <path key={i} d={d} fill={fill} />; }
          return <rect key={i} x={lm.x + 8} y={lm.y + 8} width={(lm.w || 0) - 16} height={(lm.h || 0) - 16} fill={fill} />;
        }
        return null;
      })}
      {(loteamento.trees || []).map((tree, i) => {
        const [x, y, treeType = 1] = tree;
        const TREE_CFG = { 1: { href: '/textures/trees/tree_01.png', s: 60 }, 2: { href: '/textures/trees/tree_02.png', s: 90 }, 3: { href: '/textures/trees/tree_03.png', s: 65 }, 4: { href: '/textures/trees/tree_04.png', s: 85 }, 5: { href: '/textures/trees/tree_05.png', s: 75 } };
        const cfg = TREE_CFG[treeType] || TREE_CFG[1];
        const half = cfg.s / 2;
        return <image key={`t-${i}`} href={cfg.href} x={x - half} y={y - half} width={cfg.s} height={cfg.s} />;
      })}
      {lots.map((lot) => {
        const status = STATUS_COLORS[lot.status] || STATUS_COLORS.disponivel;
        return <polygon key={lot.db_id || lot.id} points={lot.polygon} fill={status.fill} fillOpacity="0.65" stroke={status.stroke} strokeWidth="2" />;
      })}
    </svg>
  );
}

export function SoldLotsPanel({ soldLots, onOpenLoteamento, isVendedor }) {
  const total = soldLots.reduce((sum, lot) => sum + (Number(lot.preco) || 0), 0);
  return (
    <div className="side-card">
      <div className="side-head">
        <h3 className="side-title">{isVendedor ? 'Minhas vendas' : 'Vendas registradas'}</h3>
        <span className="side-link">{soldLots.length} lotes</span>
      </div>
      <div className="sale-total"><span>Valor vendido</span><b>{fmtBRLShort(total)}</b></div>
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

export function StatusPill({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.disponivel;
  return (
    <span className="status-pill" style={{ color: colors.label, background: colors.glow }}>
      <span style={{ background: colors.fill }} />
      {statusLabel(status)}
    </span>
  );
}
