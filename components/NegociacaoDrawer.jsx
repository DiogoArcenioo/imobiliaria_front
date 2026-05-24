'use client';

import { useState, useEffect } from 'react';
import { getEtapas, createEtapa, updateEtapa } from '../lib/api';

export function NegociacaoDrawer({ lot, user, onClose, onUltimaEtapaChange }) {
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
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
    getEtapas(lot.db_id)
      .then((list) => {
        setEtapas(list);
        notifyUltimaEtapa(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [lot?.db_id]); // notifyUltimaEtapa intentionally omitted — runs only on lot change

  function notifyUltimaEtapa(list) {
    const last = list.length > 0 ? list[list.length - 1] : null;
    onUltimaEtapaChange?.(lot.db_id, lot.loteamento_id, last ? {
      id: last.id,
      descricao: last.descricao,
      criado_em: last.criado_em,
      criado_por_nome: last.criado_por_nome,
    } : null);
  }

  async function handleAdd() {
    if (!newDraft.trim()) return;
    setAddSaving(true);
    setAddError(null);
    try {
      const created = await createEtapa(lot.db_id, newDraft);
      const newList = [...etapas, created];
      setEtapas(newList);
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
      const updated = await updateEtapa(editingId, editDraft);
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
            <div className="neg-drawer-eyebrow">HISTÓRICO DE NEGOCIAÇÃO</div>
            <h3 className="neg-drawer-title">Lote {lot.id}</h3>
            {lot.cliente?.nome && (
              <p className="neg-drawer-sub">Cliente: {lot.cliente.nome}</p>
            )}
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
                  user={user}
                  isEditing={editingId === etapa.id}
                  editDraft={editDraft}
                  editSaving={editSaving}
                  editError={editingId === etapa.id ? editError : null}
                  onStartEdit={() => startEdit(etapa)}
                  onEditChange={setEditDraft}
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
                <textarea
                  className="neg-textarea"
                  value={newDraft}
                  onChange={(e) => setNewDraft(e.target.value)}
                  placeholder="Descreva a etapa da negociação..."
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
                      onClick={() => { setAdding(false); setNewDraft(''); setAddError(null); }}
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

function EtapaItem({ etapa, index, isLast, user, isEditing, editDraft, editSaving, editError, onStartEdit, onEditChange, onEditSave, onEditCancel }) {
  const canEdit = user && (
    user.role === 'admin' || user.role === 'gerente' || user.id === etapa.criado_por
  );

  const date = new Date(etapa.criado_em).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const wasEdited = etapa.atualizado_em && etapa.criado_em &&
    new Date(etapa.atualizado_em).getTime() - new Date(etapa.criado_em).getTime() > 2000;

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
          <p className="neg-etapa-texto">{etapa.descricao}</p>
        )}
      </div>
    </div>
  );
}
