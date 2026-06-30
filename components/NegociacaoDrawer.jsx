'use client';

import { useEffect, useState } from 'react';
import { createEtapa, getEtapas, updateEtapa } from '../lib/api';
import { fmtBRL } from '../lib/data';

function currencyDraft(value) {
  const number = Number(value || 0);
  return number ? number.toLocaleString('pt-BR') : '';
}

function parseCurrency(value) {
  const raw = String(value ?? '').trim();
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

export function NegociacaoDrawer({ lot, user, onClose, onUltimaEtapaChange }) {
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [newValueDraft, setNewValueDraft] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editValueDraft, setEditValueDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  const canAddEtapa = user && (
    user.role === 'admin' || user.role === 'gerente' ||
    user.id === lot?.cliente_vinculado_por
  );

  useEffect(() => {
    if (!lot?.db_id) return;
    setLoading(true);
    setError(null);
    setNewValueDraft(currencyDraft(lot.preco));
    getEtapas(lot.db_id)
      .then((list) => {
        setEtapas(list);
        notifyUltimaEtapa(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [lot?.db_id]);

  function etapaResumo(etapa) {
    if (!etapa) return null;
    return {
      id: etapa.id,
      descricao: etapa.descricao,
      criado_em: etapa.criado_em,
      criado_por_nome: etapa.criado_por_nome,
      valor_anterior: etapa.valor_anterior,
      valor_novo: etapa.valor_novo,
    };
  }

  function notifyUltimaEtapa(list) {
    const last = list.length > 0 ? list[list.length - 1] : null;
    onUltimaEtapaChange?.(lot.db_id, lot.loteamento_id, etapaResumo(last));
  }

  async function handleAdd() {
    if (!newDraft.trim()) return;
    setAddSaving(true);
    setAddError(null);
    try {
      const created = await createEtapa(lot.db_id, newDraft, parseCurrency(newValueDraft));
      const newList = [...etapas, created];
      setEtapas(newList);
      if (created.valor_novo !== null && created.valor_novo !== undefined) {
        setNewValueDraft(currencyDraft(created.valor_novo));
      }
      setNewDraft('');
      setAdding(false);
      notifyUltimaEtapa(newList);
    } catch (e) {
      setAddError(e.message || 'Erro ao salvar');
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(etapa) {
    setEditingId(etapa.id);
    setEditDraft(etapa.descricao);
    setEditValueDraft(currencyDraft(etapa.valor_novo ?? lot.preco));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleEdit() {
    if (!editDraft.trim() || !editingId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await updateEtapa(editingId, editDraft, parseCurrency(editValueDraft));
      const newList = etapas.map((e) => (e.id === editingId ? updated : e));
      setEtapas(newList);
      setEditingId(null);
      notifyUltimaEtapa(newList);
    } catch (e) {
      setEditError(e.message || 'Erro ao salvar');
    } finally {
      setEditSaving(false);
    }
  }

  if (!lot) return null;

  return (
    <div className="neg-backdrop" onClick={onClose}>
      <aside className="neg-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="neg-drawer-head">
          <div>
            <div className="neg-drawer-eyebrow">HISTORICO DE NEGOCIACAO</div>
            <h3 className="neg-drawer-title">Lote {lot.id}</h3>
            <p className="neg-drawer-sub">
              {lot.cliente?.nome ? `Cliente: ${lot.cliente.nome} - ` : ''}
              Valor atual {fmtBRL(lot.preco)}
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
          ) : error ? (
            <div className="neg-empty neg-error">{error}</div>
          ) : etapas.length === 0 && !adding ? (
            <div className="neg-empty">Nenhuma etapa registrada.</div>
          ) : (
            <div className="neg-etapas-list">
              {etapas.map((etapa, index) => (
                <EtapaItem
                  key={etapa.id}
                  etapa={etapa}
                  index={index + 1}
                  isLast={index === etapas.length - 1}
                  displayValue={historicalValueFor(etapas, index, lot.preco)}
                  user={user}
                  isEditing={editingId === etapa.id}
                  editDraft={editDraft}
                  editValueDraft={editValueDraft}
                  editSaving={editSaving}
                  editError={editingId === etapa.id ? editError : null}
                  onStartEdit={() => startEdit(etapa)}
                  onEditChange={setEditDraft}
                  onEditValueChange={setEditValueDraft}
                  onEditSave={handleEdit}
                  onEditCancel={cancelEdit}
                />
              ))}
            </div>
          )}
        </div>

        {canAddEtapa && (
          <div className="neg-drawer-footer">
            {adding ? (
              <div className="neg-new-etapa">
                <div className="neg-new-etapa-label">Nova etapa</div>
                <label className="neg-field">
                  <span>Valor negociado</span>
                  <div className="neg-money-field">
                    <span>R$</span>
                    <input
                      value={newValueDraft}
                      onChange={(e) => setNewValueDraft(e.target.value)}
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </div>
                </label>
                <textarea
                  className="neg-textarea"
                  value={newDraft}
                  onChange={(e) => setNewDraft(e.target.value)}
                  placeholder="Descreva a etapa da negociacao..."
                  rows={4}
                  maxLength={4000}
                  autoFocus
                />
                <div className="neg-etapa-footer-row">
                  <span className="neg-char-count">{newDraft.length}/4000</span>
                  {addError && <span className="neg-error-inline">{addError}</span>}
                  <div className="neg-etapa-actions">
                    <button
                      className="neg-btn neg-btn-ghost"
                      onClick={() => {
                        setAdding(false);
                        setNewDraft('');
                        setNewValueDraft(currencyDraft(lot.preco));
                        setAddError(null);
                      }}
                      disabled={addSaving}
                    >
                      Cancelar
                    </button>
                    <button
                      className="neg-btn neg-btn-primary"
                      onClick={handleAdd}
                      disabled={addSaving || !newDraft.trim()}
                    >
                      {addSaving ? 'Salvando...' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button className="neg-add-btn" onClick={() => setAdding(true)}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Nova etapa
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function EtapaItem({
  etapa,
  index,
  isLast,
  displayValue,
  user,
  isEditing,
  editDraft,
  editValueDraft,
  editSaving,
  editError,
  onStartEdit,
  onEditChange,
  onEditValueChange,
  onEditSave,
  onEditCancel,
}) {
  const canEdit = user && (
    user.role === 'admin' || user.role === 'gerente' || user.id === etapa.criado_por
  );

  const date = new Date(etapa.criado_em).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const wasEdited = etapa.atualizado_em && etapa.criado_em &&
    new Date(etapa.atualizado_em).getTime() - new Date(etapa.criado_em).getTime() > 2000;
  const hasValueChange = etapa.valor_anterior !== null && etapa.valor_anterior !== undefined &&
    etapa.valor_novo !== null && etapa.valor_novo !== undefined &&
    Number(etapa.valor_anterior) !== Number(etapa.valor_novo);

  return (
    <div className="neg-etapa">
      <div className="neg-etapa-timeline">
        <div className="neg-etapa-dot" />
        {!isLast && <div className="neg-etapa-line" />}
      </div>
      <div className="neg-etapa-content">
        <div className="neg-etapa-meta">
          <span className="neg-etapa-num">Etapa {index}</span>
          <span className="neg-etapa-date">{date}</span>
          {etapa.criado_por_nome && (
            <span className="neg-etapa-autor">{etapa.criado_por_nome}</span>
          )}
          {wasEdited && <span className="neg-etapa-edited">(editado)</span>}
          {canEdit && !isEditing && (
            <button className="neg-etapa-edit-btn" onClick={onStartEdit}>
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              Editar
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="neg-etapa-editor">
            <label className="neg-field">
              <span>Valor negociado</span>
              <div className="neg-money-field">
                <span>R$</span>
                <input
                  value={editValueDraft}
                  onChange={(e) => onEditValueChange(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </label>
            <textarea
              className="neg-textarea"
              value={editDraft}
              onChange={(e) => onEditChange(e.target.value)}
              rows={4}
              maxLength={4000}
              autoFocus
            />
            <div className="neg-etapa-footer-row">
              <span className="neg-char-count">{editDraft.length}/4000</span>
              {editError && <span className="neg-error-inline">{editError}</span>}
              <div className="neg-etapa-actions">
                <button className="neg-btn neg-btn-ghost" onClick={onEditCancel} disabled={editSaving}>
                  Cancelar
                </button>
                <button
                  className="neg-btn neg-btn-primary"
                  onClick={onEditSave}
                  disabled={editSaving || !editDraft.trim()}
                >
                  {editSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {hasValueChange ? (
              <div className="neg-value-change">
                <span>{fmtBRL(etapa.valor_anterior)}</span>
                <span>para</span>
                <strong>{fmtBRL(etapa.valor_novo)}</strong>
              </div>
            ) : (
              <div className="neg-value-change">
                <span>Valor</span>
                <strong>{fmtBRL(displayValue)}</strong>
              </div>
            )}
            <p className="neg-etapa-texto">{etapa.descricao}</p>
          </>
        )}
      </div>
    </div>
  );
}
