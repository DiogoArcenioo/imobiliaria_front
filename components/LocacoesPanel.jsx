'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtBRL } from '../lib/data';
import {
  cancelarPagamentoLocacao,
  getLocacaoPagamentos,
  registrarPagamentoLocacao,
} from '../lib/api';
import { userHasModule } from '../lib/modules';
import { formatCpfCnpj } from './ClienteManagement';

function clientLabel(client) {
  return `${client.nome} — ${formatCpfCnpj(client.cpf_cnpj)}`;
}

function dateBR(value) {
  if (!value) return 'Sem prazo';
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}

function mesLabel(ref) {
  if (!ref) return '—';
  const [year, month] = ref.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function referenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function proximoVencimento(diaVencimento) {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = d.getMonth() + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`;
}

// ── Status chip de pagamento ─────────────────────────────────────────────────

function StatusPgtoChip({ status }) {
  const cfg = {
    em_dia:         { label: 'Em dia',          color: '#16a34a', bg: 'rgba(22,163,74,.1)' },
    a_vencer:       { label: 'A vencer',         color: '#d97706', bg: 'rgba(217,119,6,.1)' },
    atrasado:       { label: 'Atrasado',         color: '#dc2626', bg: 'rgba(220,38,38,.1)' },
    sem_pagamentos: { label: 'Sem pagamentos',   color: '#6b7280', bg: 'rgba(107,114,128,.1)' },
  }[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ── Dialog de registro de pagamento ─────────────────────────────────────────

function PagamentoDialog({ locacao, onConfirm, onCancel }) {
  const ref = referenciaAtual();
  const [referencia, setReferencia] = useState(ref);
  const [valor, setValor] = useState(locacao.valor_mensal || '');
  const [pagoEm, setPagoEm] = useState(new Date().toISOString().slice(0, 10));
  const [vencimento, setVencimento] = useState(proximoVencimento(locacao.dia_vencimento));
  const [metodo, setMetodo] = useState('pix');
  const [numeroDoc, setNumeroDoc] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = referencia && valor && pagoEm && vencimento && metodo;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        referencia,
        valor: Number(valor),
        pago_em: pagoEm,
        vencimento,
        metodo,
        numero_documento: numeroDoc || undefined,
        observacao: observacao || undefined,
      });
    } catch (err) {
      setError(err.message || 'Erro ao registrar pagamento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sale-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <section className="sale-modal" style={{ maxWidth: 480 }}>
        <header className="sale-modal-head">
          <div>
            <div className="dash-eyebrow">REGISTRAR PAGAMENTO</div>
            <h2>Apt {locacao.apartamento_codigo}</h2>
            <p>{locacao.predio?.nome} · {locacao.cliente?.nome}</p>
          </div>
          <button className="sale-modal-close" onClick={onCancel} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="field-label">
              Competência (mês)
              <input className="field-input" type="month" value={referencia}
                onChange={(e) => setReferencia(e.target.value)} />
            </label>
            <label className="field-label">
              Valor pago
              <input className="field-input" type="number" min="0.01" step="0.01"
                value={valor} onChange={(e) => setValor(e.target.value)} />
            </label>
            <label className="field-label">
              Data do pagamento
              <input className="field-input" type="date" value={pagoEm}
                onChange={(e) => setPagoEm(e.target.value)} />
            </label>
            <label className="field-label">
              Data de vencimento
              <input className="field-input" type="date" value={vencimento}
                onChange={(e) => setVencimento(e.target.value)} />
            </label>
          </div>

          <label className="field-label">
            Método
            <select className="field-input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option value="pix">PIX</option>
              <option value="transferencia">Transferência</option>
              <option value="boleto">Boleto</option>
              <option value="cartao">Cartão</option>
              <option value="manual">Dinheiro / Outro</option>
            </select>
          </label>

          <label className="field-label">
            Nº do documento <small style={{ color: '#888' }}>(opcional)</small>
            <input className="field-input" value={numeroDoc}
              onChange={(e) => setNumeroDoc(e.target.value)}
              placeholder="Comprovante, recibo, ID da transação..." />
          </label>

          <label className="field-label">
            Observação <small style={{ color: '#888' }}>(opcional)</small>
            <textarea className="field-input" rows={2} value={observacao}
              onChange={(e) => setObservacao(e.target.value)} />
          </label>

          {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
        </div>

        <footer className="sale-modal-actions">
          <button className="table-action table-action-ghost" onClick={onCancel}>Cancelar</button>
          <button className="table-action" disabled={!canSubmit || saving} onClick={handleSubmit}>
            {saving ? 'Registrando...' : 'Registrar pagamento'}
          </button>
        </footer>
      </section>
    </div>
  );
}

// ── Painel lateral de histórico de pagamentos ────────────────────────────────

export function EncerrarLocacaoDialog({ locacao, onConfirm, onCancel }) {
  const [dataEncerramento, setDataEncerramento] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!dataEncerramento || !motivo.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        data_encerramento: dataEncerramento,
        motivo: motivo.trim(),
      });
    } catch (err) {
      setError(err.message || 'Não foi possível encerrar a locação.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sale-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <section className="sale-modal" style={{ maxWidth: 460 }}>
        <header className="sale-modal-head">
          <div>
            <div className="dash-eyebrow">ENCERRAR LOCAÇÃO</div>
            <h2>Apt {locacao.apartamento_codigo}</h2>
            <p>{locacao.predio?.nome} · {locacao.cliente?.nome}</p>
          </div>
          <button className="sale-modal-close" onClick={onCancel} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="field-label">
            Data de encerramento
            <input
              className="field-input"
              type="date"
              min={String(locacao.data_inicio || '').slice(0, 10)}
              value={dataEncerramento}
              onChange={(e) => setDataEncerramento(e.target.value)}
            />
          </label>
          <label className="field-label">
            Motivo do encerramento
            <textarea
              className="field-input"
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: término de contrato, mudança do cliente, inadimplência..."
              autoFocus
            />
          </label>
          {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
        </div>

        <footer className="sale-modal-actions">
          <button className="table-action table-action-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button className="table-action" onClick={handleSubmit} disabled={saving || !dataEncerramento || !motivo.trim()}>
            {saving ? 'Encerrando...' : 'Encerrar locação'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function PagamentosPanel({ locacao, canManage, onClose, onPagamentoAdded }) {
  const [pagamentos, setPagamentos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getLocacaoPagamentos(locacao.id);
      setPagamentos(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [locacao.id]);

  async function handleRegistrar(data) {
    const novo = await registrarPagamentoLocacao(locacao.id, data);
    setPagamentos((prev) => [novo, ...(prev || [])]);
    setShowDialog(false);
    onPagamentoAdded?.();
  }

  async function handleCancelar(pagId) {
    if (!window.confirm('Cancelar este pagamento?')) return;
    const atualizado = await cancelarPagamentoLocacao(locacao.id, pagId);
    setPagamentos((prev) => prev.map((p) => p.id === pagId ? atualizado : p));
    onPagamentoAdded?.();
  }

  const total = (pagamentos || []).filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0);

  return (
    <>
      <div className="sale-modal-backdrop" onClick={onClose}>
        <section
          className="sale-modal"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        >
          <header className="sale-modal-head">
            <div>
              <div className="dash-eyebrow">HISTÓRICO DE PAGAMENTOS</div>
              <h2>Apt {locacao.apartamento_codigo}</h2>
              <p>{locacao.predio?.nome} · {locacao.cliente?.nome} · Dia {locacao.dia_vencimento}</p>
            </div>
            <button className="sale-modal-close" onClick={onClose} aria-label="Fechar">
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            </button>
          </header>

          {/* Resumo */}
          <div style={{ display: 'flex', gap: 16, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Valor mensal</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmtBRL(locacao.valor_mensal)}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total recebido</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{fmtBRL(total)}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status atual</div>
              <div style={{ marginTop: 4 }}><StatusPgtoChip status={locacao.status_pagamento} /></div>
            </div>
          </div>

          {/* Ação */}
          {canManage && locacao.status === 'ativa' && (
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={() => setShowDialog(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                  background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Registrar pagamento
              </button>
            </div>
          )}

          {/* Tabela */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
            {loading ? (
              <p style={{ padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center' }}>Carregando...</p>
            ) : !pagamentos?.length ? (
              <p style={{ padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum pagamento registrado ainda.</p>
            ) : (
              <table className="lot-table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th>Vencimento</th>
                    <th>Pago em</th>
                    <th>Valor</th>
                    <th>Método</th>
                    <th>Status</th>
                    {canManage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {pagamentos.map((p) => (
                    <tr key={p.id}>
                      <td><b>{mesLabel(p.referencia)}</b></td>
                      <td>{dateBR(p.vencimento)}</td>
                      <td>{p.pago_em ? new Date(p.pago_em).toLocaleDateString('pt-BR') : '—'}</td>
                      <td>{fmtBRL(p.valor)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{p.metodo}</td>
                      <td>
                        {p.status === 'pago'
                          ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Pago</span>
                          : <span style={{ color: '#dc2626', fontWeight: 600 }}>Cancelado</span>
                        }
                      </td>
                      {canManage && (
                        <td>
                          {p.status === 'pago' && (
                            <button
                              onClick={() => handleCancelar(p.id)}
                              style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                            >
                              Cancelar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {showDialog && (
        <PagamentoDialog
          locacao={locacao}
          onConfirm={handleRegistrar}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </>
  );
}

// ── Dialog de criação de locação ─────────────────────────────────────────────

export function LocacaoDialog({ apartamento, clientes, onConfirm, onCancel }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [valorMensal, setValorMensal] = useState(Number(apartamento?.preco_aluguel) || '');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState('');
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [caucao, setCaucao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clientes.slice(0, 8);
    return clientes.filter((client) =>
      [client.nome, client.cpf_cnpj].filter(Boolean).some((value) =>
        String(value).toLowerCase().includes(normalized)
      )
    ).slice(0, 8);
  }, [clientes, query]);

  const handleSubmit = async () => {
    if (!selected || !Number(valorMensal) || !dataInicio) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        cliente_id: selected.id,
        valor_mensal: Number(valorMensal),
        data_inicio: dataInicio,
        data_fim: dataFim || undefined,
        dia_vencimento: Number(diaVencimento),
        caucao: caucao === '' ? undefined : Number(caucao),
        observacao: observacao || undefined,
      });
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a locação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay ap-status-modal-overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal-box rental-modal" role="dialog" aria-modal="true">
        <div className="rental-modal-head">
          <div>
            <div className="dash-eyebrow">NOVA LOCAÇÃO</div>
            <h3>Alugar apartamento {apartamento?.ap_id}</h3>
            <p>Cadastre os dados financeiros e o período do contrato.</p>
          </div>
          <button className="apc-close" onClick={onCancel} aria-label="Fechar">×</button>
        </div>

        <div className="modal-body rental-form">
          <label className="field-label rental-client-field">
            Cliente
            <input
              className="field-input"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSelected(null); }}
              placeholder="Buscar por nome ou CPF..."
              autoFocus
            />
          </label>
          <div className="sale-client-results">
            {options.length === 0 ? (
              <div className="sale-client-empty">Nenhum cliente encontrado.</div>
            ) : options.map((client) => (
              <button
                key={client.id}
                className={'sale-client-option' + (selected?.id === client.id ? ' sale-client-option-active' : '')}
                onClick={() => { setSelected(client); setQuery(clientLabel(client)); }}
              >
                <span><b>{client.nome}</b><small>{formatCpfCnpj(client.cpf_cnpj)}</small></span>
              </button>
            ))}
          </div>

          <div className="rental-form-grid">
            <label className="field-label">
              Valor mensal
              <input className="field-input" type="number" min="0.01" step="100" value={valorMensal}
                onChange={(event) => setValorMensal(event.target.value)} placeholder="R$ 0,00" />
            </label>
            <label className="field-label">
              Dia do vencimento
              <input className="field-input" type="number" min="1" max="31" value={diaVencimento}
                onChange={(event) => setDiaVencimento(event.target.value)} />
            </label>
            <label className="field-label">
              Início do contrato
              <input className="field-input" type="date" value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)} />
            </label>
            <label className="field-label">
              Término opcional
              <input className="field-input" type="date" min={dataInicio} value={dataFim}
                onChange={(event) => setDataFim(event.target.value)} />
            </label>
            <label className="field-label">
              Caução
              <input className="field-input" type="number" min="0" step="100" value={caucao}
                onChange={(event) => setCaucao(event.target.value)} placeholder="R$ 0,00" />
            </label>
          </div>

          <label className="field-label">
            Observação
            <textarea className="field-input" rows={3} value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              placeholder="Reajuste, garantias, condições especiais..." />
          </label>
          {error && <div className="rental-form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="ap-modal-btn ap-modal-btn-secondary" onClick={onCancel}>Cancelar</button>
          <button
            className="ap-modal-btn ap-modal-btn-primary"
            disabled={!selected || !Number(valorMensal) || !dataInicio || saving}
            onClick={handleSubmit}
          >
            {saving ? 'Registrando...' : 'Iniciar locação'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tabela de locações ───────────────────────────────────────────────────────

function RentalTable({ title, rows, statusFilter, onStatusFilterChange, active, canManage, onEnd, onVerPagamentos }) {
  return (
    <section className="rental-table-card">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{rows.length} contrato{rows.length === 1 ? '' : 's'}</p>
        </div>
        <div className="rental-filter-tabs" role="tablist" aria-label="Filtrar locacoes">
          {[
            ['ativa', 'Ativas'],
            ['encerrada', 'Encerradas'],
            ['todos', 'Todas'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={statusFilter === value ? 'active' : ''}
              onClick={() => onStatusFilterChange?.(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="rental-empty">Nenhuma locação nesta categoria.</div>
      ) : (
        <div className="rental-table-wrap">
          <table className="rental-table">
            <thead>
              <tr>
                <th>Apartamento</th>
                <th>Cliente</th>
                <th>Valor mensal</th>
                <th>Período</th>
                <th>Vencimento</th>
                <th>Status</th>
                {active && <th>Pagamento</th>}
                {active && canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((rental) => (
                <tr key={rental.id}>
                  <td>
                    <b>{rental.apartamento_codigo}</b>
                    <small>{[rental.predio?.nome, rental.andar?.numero ? `${rental.andar.numero}º andar` : null].filter(Boolean).join(' · ')}</small>
                  </td>
                  <td><b>{rental.cliente?.nome || '—'}</b><small>{formatCpfCnpj(rental.cliente?.cpf_cnpj)}</small></td>
                  <td className="rental-money">{fmtBRL(rental.valor_mensal)}</td>
                  <td>{dateBR(rental.data_inicio)}<small>até {dateBR(rental.data_fim)}</small></td>
                  <td>Dia {rental.dia_vencimento}</td>
                  <td>
                    <span className={`rental-status-chip rental-status-${rental.status}`}>
                      {rental.status === 'ativa' ? 'Ativa' : rental.status === 'encerrada' ? 'Encerrada' : rental.status}
                    </span>
                  </td>
                  {active && (
                    <td>
                      <button
                        onClick={() => onVerPagamentos?.(rental)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        title="Ver pagamentos"
                      >
                        <StatusPgtoChip status={rental.status_pagamento || 'sem_pagamentos'} />
                      </button>
                    </td>
                  )}
                  {active && canManage && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="rental-end-btn" style={{ background: '#3b82f6', color: '#fff', border: 'none' }} onClick={() => onVerPagamentos?.(rental)}>
                          Pagamentos
                        </button>
                        <button className="rental-end-btn" onClick={() => onEnd(rental)}>Encerrar</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Painel principal ─────────────────────────────────────────────────────────

export function LocacoesPanel({
  locacoes: initialLocacoes,
  resumo,
  loading,
  user,
  onEnd,
  onLocacoesRefresh,
  statusFilter = 'ativa',
  onStatusFilterChange,
}) {
  const [locacoes, setLocacoes] = useState(initialLocacoes);
  const [pagamentosLocacao, setPagamentosLocacao] = useState(null);
  const [encerrarLocacaoDialog, setEncerrarLocacaoDialog] = useState(null);

  useEffect(() => { setLocacoes(initialLocacoes); }, [initialLocacoes]);

  const active = statusFilter === 'ativa';
  const canManage = ['admin', 'gerente'].includes(user?.role) || (user?.role === 'vendedor' && userHasModule(user, 'locacoes'));
  const tableTitle = statusFilter === 'ativa'
    ? 'Locações ativas'
    : statusFilter === 'encerrada'
    ? 'Locações encerradas'
    : 'Todas as locações';

  function handlePagamentoAdded() {
    onLocacoesRefresh?.();
  }

  if (loading) return <div className="rental-loading">Carregando locações...</div>;

  return (
    <div className="rentals-page">
      <div className="rental-metrics">
        <div className="rental-metric rental-metric-primary">
          <span>Receita mensal</span>
          <strong>{fmtBRL(resumo.receita_mensal || 0)}</strong>
          <small>contratos ativos</small>
        </div>
        <div className="rental-metric">
          <span>Apartamentos alugados</span>
          <strong>{resumo.total_ativas || 0}</strong>
          <small>{resumo.ocupacao_percentual || 0}% de ocupação</small>
        </div>
        <div className="rental-metric">
          <span>Ticket médio</span>
          <strong>{fmtBRL(resumo.ticket_medio || 0)}</strong>
          <small>por apartamento</small>
        </div>
        <div className="rental-metric">
          <span>Unidades vagas</span>
          <strong>{resumo.unidades_vagas || 0}</strong>
          <small>de {resumo.unidades_locaveis || 0} locáveis</small>
        </div>
      </div>

      <RentalTable
        title={tableTitle}
        rows={locacoes}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        active={active}
        canManage={canManage}
        onEnd={(rental) => setEncerrarLocacaoDialog(rental)}
        onVerPagamentos={(rental) => setPagamentosLocacao(rental)}
      />
      {encerrarLocacaoDialog && (
        <EncerrarLocacaoDialog
          locacao={encerrarLocacaoDialog}
          onCancel={() => setEncerrarLocacaoDialog(null)}
          onConfirm={async (data) => {
            await onEnd(encerrarLocacaoDialog, data);
            setEncerrarLocacaoDialog(null);
          }}
        />
      )}
      {pagamentosLocacao && (
        <PagamentosPanel
          locacao={pagamentosLocacao}
          canManage={canManage}
          onClose={() => setPagamentosLocacao(null)}
          onPagamentoAdded={handlePagamentoAdded}
        />
      )}
    </div>
  );
}
