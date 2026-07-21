'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  converterReservaEmVenda,
  createEtapaUnidade,
  gerarPropostaComercial,
  getEtapasUnidade,
  getReservasComerciais,
} from '../lib/api';
import { fmtBRL, fmtBRLShort } from '../lib/data';
import { formatCpfCnpj } from './ClienteManagement';

function fmtDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

function fmtDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
}

function tipoLabel(tipo) {
  if (tipo === 'casa') return 'Casa';
  return tipo === 'apartamento' ? 'Apartamento' : 'Lote';
}

function localDateToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseCurrency(value) {
  if (value === null || value === undefined) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function historicalValueFor(etapas, index, currentValue) {
  const etapa = etapas[index];
  if (etapa?.valor_novo !== null && etapa?.valor_novo !== undefined) return etapa.valor_novo;
  if (etapa?.valor_anterior !== null && etapa?.valor_anterior !== undefined) return etapa.valor_anterior;

  for (let i = index + 1; i < etapas.length; i += 1) {
    const next = etapas[i];
    if (next?.valor_anterior !== null && next?.valor_anterior !== undefined) return next.valor_anterior;
    if (next?.valor_novo !== null && next?.valor_novo !== undefined) return next.valor_novo;
  }

  return currentValue;
}

export function ComercialPanel() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [negociando, setNegociando] = useState(null);
  const [confirmandoVenda, setConfirmandoVenda] = useState(null);

  const fetchData = useCallback(async () => {
    setError('');
    try {
      setReservas(await getReservasComerciais());
    } catch (err) {
      setError(err.message || 'Erro ao carregar reservas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = useMemo(() => ({
    count: reservas.length,
    value: reservas.reduce((sum, item) => sum + (Number(item.valor) || 0), 0),
  }), [reservas]);

  async function handleProposta(item) {
    const key = `proposta-${item.tipo}-${item.id}`;
    setBusy(key);
    try {
      const result = await gerarPropostaComercial(item.tipo, item.id, 'html');
      const win = window.open('', '_blank');
      if (!win) throw new Error('Permita pop-ups para abrir a proposta.');
      win.document.write(result.conteudo);
      win.document.close();
    } catch (err) {
      alert(err.message || 'Erro ao gerar proposta');
    } finally {
      setBusy(null);
    }
  }

  async function handleConverter(item, dataVenda) {
    const key = `venda-${item.tipo}-${item.id}`;
    setBusy(key);
    try {
      await converterReservaEmVenda(item.tipo, item.id, dataVenda);
      setReservas((prev) => prev.filter((reserva) => !(reserva.tipo === item.tipo && reserva.id === item.id)));
      setConfirmandoVenda(null);
    } catch (err) {
      throw new Error(err.message || 'Erro ao converter reserva');
    } finally {
      setBusy(null);
    }
  }

  function handleNegociacaoSaved(item, etapa) {
    if (etapa?.valor_novo === null || etapa?.valor_novo === undefined) return;
    setReservas((prev) => prev.map((reserva) => (
      reserva.tipo === item.tipo && reserva.id === item.id
        ? { ...reserva, valor: Number(etapa.valor_novo) }
        : reserva
    )));
    setNegociando((current) => (
      current && current.tipo === item.tipo && current.id === item.id
        ? { ...current, valor: Number(etapa.valor_novo) }
        : current
    ));
  }

  if (loading) {
    return (
      <section className="list-page">
        <Header totals={totals} onRefresh={fetchData} />
        <div className="list-empty">Carregando reservas...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="list-page">
        <Header totals={totals} onRefresh={fetchData} />
        <div className="list-empty">
          <p>{error}</p>
          <button className="qa-btn qa-btn-primary" onClick={fetchData}>Tentar novamente</button>
        </div>
      </section>
    );
  }

  return (
    <section className="list-page">
      <Header totals={totals} onRefresh={fetchData} />

      {reservas.length === 0 ? (
        <div className="list-empty">Nenhuma reserva em aberto.</div>
      ) : (
        <div className="lot-table-wrap">
          <table className="lot-table">
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Empreendimento</th>
                <th>Cliente</th>
                <th>Responsavel</th>
                <th>Reservado em</th>
                <th>Validade</th>
                <th>Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reservas.map((item) => {
                const propostaKey = `proposta-${item.tipo}-${item.id}`;
                const vendaKey = `venda-${item.tipo}-${item.id}`;
                const isBusy = busy === propostaKey || busy === vendaKey;
                return (
                  <tr key={`${item.tipo}-${item.id}`}>
                    <td>
                      <b className="lot-code">{item.codigo}</b>
                      <div className="table-sub">{tipoLabel(item.tipo)}</div>
                    </td>
                    <td>{item.empreendimento}</td>
                    <td>
                      <b>{item.cliente || '-'}</b>
                      {item.cliente_documento && (
                        <div className="table-sub">{formatCpfCnpj(item.cliente_documento)}</div>
                      )}
                    </td>
                    <td>{item.responsavel || '-'}</td>
                    <td>{fmtDate(item.reservado_em)}</td>
                    <td>{fmtDate(item.reserva_expira_em)}</td>
                    <td>{fmtBRL(item.valor)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="table-action table-action-ghost"
                          onClick={() => setNegociando(item)}
                          disabled={isBusy}
                        >
                          Negociar
                        </button>
                        <button
                          className="table-action table-action-ghost"
                          onClick={() => handleProposta(item)}
                          disabled={isBusy}
                        >
                          {busy === propostaKey ? 'Gerando...' : 'Proposta'}
                        </button>
                        <button
                          className="table-action"
                          onClick={() => setConfirmandoVenda(item)}
                          disabled={isBusy || !item.cliente_id}
                          title={!item.cliente_id ? 'Reserva sem cliente vinculado' : 'Converter reserva em venda'}
                        >
                          {busy === vendaKey ? 'Convertendo...' : 'Converter em venda'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {negociando && (
        <ComercialNegociacaoDrawer
          item={negociando}
          onClose={() => setNegociando(null)}
          onSaved={handleNegociacaoSaved}
        />
      )}

      {confirmandoVenda && (
        <ComercialVendaModal
          item={confirmandoVenda}
          saving={busy === `venda-${confirmandoVenda.tipo}-${confirmandoVenda.id}`}
          onClose={() => setConfirmandoVenda(null)}
          onConfirm={(dataVenda) => handleConverter(confirmandoVenda, dataVenda)}
        />
      )}
    </section>
  );
}

function ComercialVendaModal({ item, saving, onClose, onConfirm }) {
  const [dataVenda, setDataVenda] = useState(localDateToday);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!dataVenda || saving) return;
    setError('');
    try {
      await onConfirm(dataVenda);
    } catch (err) {
      setError(err.message || 'Erro ao converter reserva');
    }
  }

  return (
    <div className="sale-modal-backdrop" role="presentation" onMouseDown={() => !saving && onClose()}>
      <section
        className="sale-modal comercial-sale-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comercial-sale-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sale-modal-head">
          <div>
            <div className="dash-eyebrow">CONFIRMAR VENDA</div>
            <h2 id="comercial-sale-title">{tipoLabel(item.tipo)} {item.codigo}</h2>
            <p>{item.empreendimento} - {fmtBRL(item.valor)}</p>
          </div>
          <button className="sale-modal-close" type="button" onClick={onClose} disabled={saving} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <p className="comercial-sale-intro">Confira as informações antes de concluir a venda.</p>

        <div className="comercial-sale-fields">
          <label className="field-label">
            Cliente
            <input className="field-input" value={item.cliente || ''} readOnly />
          </label>
          <label className="field-label">
            Data da venda
            <input
              className="field-input"
              type="date"
              value={dataVenda}
              max={localDateToday()}
              onChange={(event) => setDataVenda(event.target.value)}
              required
            />
          </label>
        </div>

        {error && <div className="comercial-sale-error" role="alert">{error}</div>}

        <footer className="sale-modal-actions">
          <button className="table-action table-action-ghost" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="table-action" type="button" onClick={handleConfirm} disabled={saving || !dataVenda}>
            {saving ? 'Convertendo...' : 'Confirmar venda'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Header({ totals, onRefresh }) {
  return (
    <header className="list-page-head">
      <div>
        <div className="dash-eyebrow">COMERCIAL</div>
        <h1 className="list-page-title">Reservas em aberto</h1>
        <p className="dash-sub">
          {totals.count} {totals.count === 1 ? 'reserva' : 'reservas'} - {fmtBRLShort(totals.value)} em valor reservado.
        </p>
      </div>
      <button className="qa-btn" onClick={onRefresh}>Atualizar</button>
    </header>
  );
}

function ComercialNegociacaoDrawer({ item, onClose, onSaved }) {
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState(item.valor ? String(Number(item.valor).toLocaleString('pt-BR')) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getEtapasUnidade(item.tipo, item.id)
      .then((list) => {
        if (alive) setEtapas(list);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Erro ao carregar negociacao');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [item.tipo, item.id]);

  async function handleAdd() {
    if (!descricao.trim()) return;
    const valorNegociado = parseCurrency(valor);
    setSaving(true);
    setError('');
    try {
      const created = await createEtapaUnidade(item.tipo, item.id, descricao, valorNegociado);
      setEtapas((prev) => [...prev, created]);
      setDescricao('');
      if (created.valor_novo !== null && created.valor_novo !== undefined) {
        setValor(String(Number(created.valor_novo).toLocaleString('pt-BR')));
      }
      onSaved?.(item, created);
    } catch (err) {
      setError(err.message || 'Erro ao registrar negociacao');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="neg-backdrop" onClick={onClose}>
      <aside className="neg-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="neg-drawer-head">
          <div>
            <div className="neg-drawer-eyebrow">NEGOCIACAO</div>
            <h3 className="neg-drawer-title">{tipoLabel(item.tipo)} {item.codigo}</h3>
            <p className="neg-drawer-sub">
              {item.cliente || 'Cliente nao informado'} - Valor atual {fmtBRL(item.valor)}
            </p>
          </div>
          <button className="neg-drawer-close" onClick={onClose} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="neg-drawer-body">
          {loading ? (
            <div className="neg-empty">Carregando etapas...</div>
          ) : etapas.length === 0 ? (
            <div className="neg-empty">Nenhuma etapa registrada.</div>
          ) : (
            <div className="neg-etapas-list">
              {etapas.map((etapa, index) => (
                <div className="neg-etapa" key={etapa.id}>
                  <div className="neg-etapa-content">
                    <div className="neg-etapa-meta">
                      <span className="neg-etapa-num">Etapa {index + 1}</span>
                      <span className="neg-etapa-date">{fmtDateTime(etapa.criado_em)}</span>
                      {etapa.criado_por_nome && <span className="neg-etapa-autor">{etapa.criado_por_nome}</span>}
                    </div>
                    <EtapaValor
                      etapa={etapa}
                      displayValue={historicalValueFor(etapas, index, item.valor)}
                    />
                    <p className="neg-etapa-texto">{etapa.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="neg-drawer-footer">
          <div className="neg-new-etapa">
            <div className="neg-new-etapa-label">Nova etapa</div>
            <label className="neg-field">
              <span>Valor negociado</span>
              <div className="neg-money-field">
                <span>R$</span>
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </label>
            <textarea
              className="neg-textarea"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a etapa da negociacao..."
              rows={4}
              maxLength={4000}
            />
            <div className="neg-etapa-footer-row">
              <span className="neg-char-count">{descricao.length}/4000</span>
              {error && <span className="neg-error-inline">{error}</span>}
              <div className="neg-etapa-actions">
                <button className="neg-btn neg-btn-ghost" onClick={onClose} disabled={saving}>
                  Fechar
                </button>
                <button
                  className="neg-btn neg-btn-primary"
                  onClick={handleAdd}
                  disabled={saving || !descricao.trim()}
                >
                  {saving ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function EtapaValor({ etapa, displayValue }) {
  const hasValueChange = etapa.valor_anterior !== null && etapa.valor_anterior !== undefined &&
    etapa.valor_novo !== null && etapa.valor_novo !== undefined &&
    Number(etapa.valor_anterior) !== Number(etapa.valor_novo);

  if (hasValueChange) {
    return (
      <div className="neg-value-change">
        <span>{fmtBRL(etapa.valor_anterior)}</span>
        <span>para</span>
        <strong>{fmtBRL(etapa.valor_novo)}</strong>
      </div>
    );
  }

  return (
    <div className="neg-value-change">
      <span>Valor</span>
      <strong>{fmtBRL(displayValue)}</strong>
    </div>
  );
}
