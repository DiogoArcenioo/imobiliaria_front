'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building3DView } from './Building3DView';
import { FloorPlanEditor } from './FloorPlanEditor';
import { ApartmentCard } from './ApartmentCard';
import { formatCpfCnpj } from './ClienteManagement';
import { LocacaoDialog, LocacoesPanel } from './LocacoesPanel';
import { createLocacao, encerrarLocacao, getLocacoes, getLocacoesResumo } from '../lib/api';

function clientLabel(c) {
  if (!c) return '';
  return `${c.nome} — ${formatCpfCnpj(c.cpf_cnpj)}`;
}

function ApStatusDialog({ ap, status, clientes, onConfirm, onCancel }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  const STATUS_LABELS = {
    reservado: 'Reservar',
    vendido: 'Confirmar Venda',
    alugado: 'Confirmar Aluguel',
  };

  const options = useMemo(() => {
    if (!query.trim()) return clientes.slice(0, 8);
    const q = query.toLowerCase();
    return clientes.filter((c) =>
      [c.nome, c.cpf_cnpj].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    ).slice(0, 8);
  }, [clientes, query]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onConfirm({ clienteId: selected.id, observacao: obs });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay ap-status-modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box ap-status-modal" style={{ maxWidth: 480 }} role="dialog" aria-modal="true">
        <h3 className="modal-title">{STATUS_LABELS[status] || status} — Apt {ap?.ap_id}</h3>
        <div className="modal-body">
          <label className="field-label">
            Cliente
            <input
              className="field-input"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              placeholder="Buscar por nome ou CPF..."
              autoFocus
            />
          </label>
          <div className="sale-client-results">
            {options.length === 0 ? (
              <div className="sale-client-empty">Nenhum cliente encontrado.</div>
            ) : (
              options.map((c) => (
                <button
                  key={c.id}
                  className={'sale-client-option' + (selected?.id === c.id ? ' sale-client-option-active' : '')}
                  onClick={() => { setSelected(c); setQuery(clientLabel(c)); }}
                >
                  <span><b>{c.nome}</b><small>{formatCpfCnpj(c.cpf_cnpj)}</small></span>
                </button>
              ))
            )}
          </div>
          {status === 'reservado' && (
            <label className="field-label">
              Observação
              <textarea
                className="field-input"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={2}
                placeholder="Notas sobre a negociação..."
              />
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="ap-modal-btn ap-modal-btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="ap-modal-btn ap-modal-btn-primary" disabled={!selected || saving} onClick={handleConfirm}>
            {saving ? 'Salvando...' : STATUS_LABELS[status] || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const AP_STATUS_COLORS = {
  disponivel: { bg: '#22c55e', label: 'Disponível' },
  reservado:  { bg: '#f59e0b', label: 'Reservado' },
  vendido:    { bg: '#ef4444', label: 'Vendido' },
  alugado:    { bg: '#8b5cf6', label: 'Alugado' },
};

/**
 * PredioManagement
 * Props:
 *   predio          – objeto prédio completo com andares[]
 *   onBack          – voltar à lista de prédios
 *   onSaveFloorPlan(predioId, andarNum, shapes, aps, meta) – salva planta baixa
 *   onUpdateApStatus(apId, status, clienteId, obs) – atualiza status de ap
 *   clientes        – lista de clientes
 *   user            – usuário logado
 *   onRefresh       – recarrega o prédio do servidor
 */
export function PredioManagement({
  predio,
  onBack,
  onSaveFloorPlan,
  onUpdateApStatus,
  onUpdateAp,
  defaultApM2 = 700,
  clientes = [],
  user,
  onRefresh,
  onStartEditingAndar,
  onStopEditingAndar,
}) {
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [editingFloor, setEditingFloor] = useState(false);
  const [selectedAp, setSelectedAp] = useState(null);
  const [apPos, setApPos] = useState(null);
  const [statusDialog, setStatusDialog] = useState(null);
  const [locacaoDialog, setLocacaoDialog] = useState(null);
  const [section, setSection] = useState('predio');
  const [locacoes, setLocacoes] = useState([]);
  const [locacoesResumo, setLocacoesResumo] = useState({});
  const [locacoesLoading, setLocacoesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!predio) return null;

  const canEdit = user && ['admin', 'gerente'].includes(user.role);

  const activeAndar = selectedFloor != null
    ? predio.andares?.find((a) => a.numero === selectedFloor)
    : null;

  const loadLocacoes = useCallback(async () => {
    if (!predio?.id) return;
    setLocacoesLoading(true);
    try {
      const [list, summary] = await Promise.all([
        getLocacoes({ predioId: predio.id }),
        getLocacoesResumo(predio.id),
      ]);
      setLocacoes(list);
      setLocacoesResumo(summary);
    } finally {
      setLocacoesLoading(false);
    }
  }, [predio?.id]);

  useEffect(() => {
    loadLocacoes().catch(() => {});
  }, [loadLocacoes]);

  const handleFloorClick = (numero) => {
    setSelectedFloor(numero);
    setEditingFloor(false);
    setSelectedAp(null);
  };

  const handleBack3D = () => {
    setSelectedFloor(null);
    setEditingFloor(false);
    setSelectedAp(null);
  };

  const handleApClick = (ap, position) => {
    setSelectedAp(ap);
    setApPos(position || null);
  };

  const handleStatusChange = async (nextStatus) => {
    if (!selectedAp) return;
    if (nextStatus === 'alugado') {
      setLocacaoDialog(selectedAp);
      setSelectedAp(null);
      setApPos(null);
      return;
    }
    if (nextStatus === 'disponivel') {
      const activeRental = locacoes.find((item) =>
        item.status === 'ativa' && item.apartamento_id === selectedAp.id
      );
      if (activeRental) {
        if (!window.confirm(`Encerrar a locação do apartamento ${selectedAp.ap_id}?`)) return;
        await encerrarLocacao(activeRental.id, 'Encerrada pelo cadastro do apartamento');
        await loadLocacoes();
      } else {
        await onUpdateApStatus?.(selectedAp.id, nextStatus, null, null);
      }
      setSelectedAp(null);
      setApPos(null);
      onRefresh?.();
      return;
    }
    setStatusDialog({ ap: selectedAp, status: nextStatus });
    setSelectedAp(null);
    setApPos(null);
  };

  const handleStatusDialogConfirm = async ({ clienteId, observacao }) => {
    if (!statusDialog) return;
    setSaving(true);
    try {
      await onUpdateApStatus?.(statusDialog.ap.id, statusDialog.status, clienteId, observacao);
      setStatusDialog(null);
      setSelectedAp(null);
      onRefresh?.();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLocacao = async (data) => {
    if (!locacaoDialog) return;
    await createLocacao(locacaoDialog.id, data);
    setLocacaoDialog(null);
    await Promise.all([loadLocacoes(), onRefresh?.()]);
  };

  const handleEndLocacao = async (locacao) => {
    if (!window.confirm(`Encerrar a locação do apartamento ${locacao.apartamento_codigo}?`)) return;
    try {
      await encerrarLocacao(locacao.id, 'Encerrada pelo painel de locações');
      await Promise.all([loadLocacoes(), onRefresh?.()]);
    } catch (err) {
      window.alert(err.message || 'Não foi possível encerrar a locação.');
    }
  };

  const handleSaveFloor = async (shapes, aps, meta) => {
    if (!activeAndar) return;
    await onSaveFloorPlan?.(predio.id, activeAndar.numero, shapes, aps, meta);
    onRefresh?.();
  };

  const handleSelectAndarInEditor = (numero) => {
    setSelectedFloor(numero);
  };

  const stats = predio.stats || {};

  // Full-screen editor mode
  if (editingFloor) {
    return (
      <FloorPlanEditor
        andar={activeAndar}
        predio={predio}
        onSave={handleSaveFloor}
        onClose={() => { setEditingFloor(false); onStopEditingAndar?.(); }}
        allAndares={predio.andares}
        onSelectAndar={handleSelectAndarInEditor}
        defaultApM2={defaultApM2}
      />
    );
  }

  return (
    <div className="predio-mgmt">
      {/* Header */}
      <div className="predio-header">
        <button className="tb-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Prédios
        </button>
        <div className="predio-title-wrap">
          <h2 className="predio-title">{predio.nome}</h2>
          {(predio.cidade || predio.bairro) && (
            <div className="predio-sub">
              {[predio.bairro, predio.cidade, predio.estado].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="predio-stats-pills">
          {Object.entries(AP_STATUS_COLORS).map(([s, info]) => (
            <span key={s} className="ap-pill" style={{ background: info.bg + '22', color: info.bg, border: `1px solid ${info.bg}44` }}>
              {stats[s] ?? 0} {info.label.toLowerCase()}
            </span>
          ))}
        </div>
        <div className="predio-section-tabs">
          <button className={section === 'predio' ? 'active' : ''} onClick={() => setSection('predio')}>
            Visão do prédio
          </button>
          <button className={section === 'locacoes' ? 'active' : ''} onClick={() => setSection('locacoes')}>
            Locações
            {locacoesResumo.total_ativas > 0 && <span>{locacoesResumo.total_ativas}</span>}
          </button>
        </div>
      </div>

      {/* Main content */}
      {section === 'locacoes' ? (
        <LocacoesPanel
          locacoes={locacoes}
          resumo={locacoesResumo}
          loading={locacoesLoading}
          user={user}
          onEnd={handleEndLocacao}
        />
      ) : !selectedFloor ? (
        /* 3D view */
        <div className="predio-3d-view">
          <div className="p3d-hint">Clique em um andar para ver a planta baixa</div>
          <Building3DView
            predio={predio}
            onSelectFloor={handleFloorClick}
            selectedFloor={selectedFloor}
          />
        </div>
      ) : (
        /* Floor plan view */
        <div className="floor-plan-view">
          <div className="fpv-toolbar">
            <button className="tb-back" onClick={handleBack3D}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Visão 3D
            </button>
            <div className="fpv-floor-nav">
              {predio.andares?.map((a) => (
                <button
                  key={a.numero}
                  className={`fpv-floor-btn${a.numero === selectedFloor ? ' active' : ''}`}
                  onClick={() => setSelectedFloor(a.numero)}
                >
                  {a.numero}°
                </button>
              ))}
            </div>
            {canEdit && (
              <button
                className="btn btn-sm"
                style={{ background: '#3288e0', color: '#fff' }}
                onClick={() => { setEditingFloor(true); onStartEditingAndar?.(); }}
              >
                Editar Planta
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="fpv-legend">
            {Object.entries(AP_STATUS_COLORS).map(([s, info]) => (
              <span key={s} className="fpv-leg-item">
                <span className="fpv-leg-dot" style={{ background: info.bg }} />
                {info.label}
              </span>
            ))}
          </div>

          {/* Floor plan canvas */}
          {activeAndar ? (
            <FloorPlanEditor
              andar={activeAndar}
              predio={predio}
              readOnly
              onClose={handleBack3D}
              onSelectAp={handleApClick}
            />
          ) : (
            <div className="fpv-empty">
              <p>Nenhuma planta baixa cadastrada para este andar.</p>
              {canEdit && (
                <button className="btn btn-primary" onClick={() => { setEditingFloor(true); onStartEditingAndar?.(); }}>
                  Criar Planta Baixa
                </button>
              )}
            </div>
          )}

          {/* Apartment detail card */}
          {selectedAp && (
            <ApartmentCard
              ap={selectedAp}
              andar={activeAndar}
              predio={predio}
              position={apPos}
              onClose={() => setSelectedAp(null)}
              onStatusChange={handleStatusChange}
              onUpdatePrice={onUpdateAp ? async (novoPreco) => {
                await onUpdateAp(selectedAp.id, { preco_venda: novoPreco });
                setSelectedAp((prev) => prev ? { ...prev, preco_venda: novoPreco } : prev);
              } : undefined}
              defaultPriceMode="m2"
              user={user}
            />
          )}
        </div>
      )}

      {/* Status dialog */}
      {statusDialog && (
        <ApStatusDialog
          ap={statusDialog.ap}
          status={statusDialog.status}
          clientes={clientes}
          onConfirm={handleStatusDialogConfirm}
          onCancel={() => setStatusDialog(null)}
        />
      )}
      {locacaoDialog && (
        <LocacaoDialog
          apartamento={locacaoDialog}
          clientes={clientes}
          onConfirm={handleCreateLocacao}
          onCancel={() => setLocacaoDialog(null)}
        />
      )}
    </div>
  );
}
