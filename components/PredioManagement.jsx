'use client';

import { useCallback, useMemo, useState } from 'react';
import { Building3DView } from './Building3DView';
import { FloorPlanEditor } from './FloorPlanEditor';
import { ApartmentCard } from './ApartmentCard';
import { formatCpfCnpj } from './ClienteManagement';

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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
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
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" disabled={!selected || saving} onClick={handleConfirm}>
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
 * Tela principal de um prédio:
 * - Mostra o modelo 3D isométrico
 * - Ao clicar num andar → muda para visão de planta baixa daquele andar
 * - Ao clicar num apartamento → mostra o ApartmentCard
 * - Admins/gerentes podem editar planta baixa
 *
 * Props:
 *   predio          – objeto prédio completo com andares[]
 *   onBack          – voltar à lista de prédios
 *   onSaveFloorPlan(predioId, andarNum, shapes, aps) – salva planta baixa
 *   onUpdateApStatus(apId, status, clienteId, obs) – atualiza status de ap
 *   clientes        – lista de clientes para SaleDialog
 *   user            – usuário logado
 *   onRefresh       – recarrega o prédio do servidor
 */
export function PredioManagement({
  predio,
  onBack,
  onSaveFloorPlan,
  onUpdateApStatus,
  clientes = [],
  user,
  onRefresh,
}) {
  const [selectedFloor, setSelectedFloor] = useState(null); // número do andar
  const [editingFloor, setEditingFloor] = useState(false);
  const [selectedAp, setSelectedAp] = useState(null);
  const [apPos, setApPos] = useState(null);
  const [statusDialog, setStatusDialog] = useState(null); // { ap, status }
  const [saving, setSaving] = useState(false);

  if (!predio) return null;

  const canEdit = user && ['admin', 'gerente'].includes(user.role);

  const activeAndar = selectedFloor != null
    ? predio.andares?.find((a) => a.numero === selectedFloor)
    : null;

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

  const handleApClick = (ap, e) => {
    if (e) {
      const rect = e.currentTarget.closest('svg')?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const svgPt = e.currentTarget.getBoundingClientRect();
      setApPos({
        left: `${svgPt.left + svgPt.width / 2}px`,
        top: `${svgPt.top - 10}px`,
        transform: 'translate(-50%, -100%)',
      });
    } else {
      setApPos(null);
    }
    setSelectedAp(ap);
  };

  const handleStatusChange = async (nextStatus) => {
    if (!selectedAp) return;
    if (nextStatus === 'disponivel') {
      await onUpdateApStatus?.(selectedAp.id, nextStatus, null, null);
      setSelectedAp(null);
      onRefresh?.();
      return;
    }
    setStatusDialog({ ap: selectedAp, status: nextStatus });
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

  const handleSaveFloor = async (shapes, aps) => {
    if (!activeAndar) return;
    await onSaveFloorPlan?.(predio.id, activeAndar.numero, shapes, aps);
    onRefresh?.();
  };

  // Estatísticas gerais do prédio
  const stats = predio.stats || {};

  return (
    <div className="predio-mgmt">
      {/* Header */}
      <div className="predio-header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Prédios
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
      </div>

      {/* Conteúdo principal */}
      {!selectedFloor ? (
        /* Visão 3D */
        <div className="predio-3d-view">
          <div className="p3d-hint">Clique em um andar para ver a planta baixa</div>
          <Building3DView
            predio={predio}
            onSelectFloor={handleFloorClick}
            selectedFloor={selectedFloor}
          />
        </div>
      ) : editingFloor ? (
        /* Editor de planta baixa */
        <FloorPlanEditor
          andar={activeAndar}
          predio={predio}
          onSave={handleSaveFloor}
          onClose={() => setEditingFloor(false)}
        />
      ) : (
        /* Visão planta baixa — prédio "visto de cima" */
        <div className="floor-plan-view">
          <div className="fpv-toolbar">
            <button className="btn btn-ghost btn-sm" onClick={handleBack3D}>
              ← Visão 3D
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
              <button className="btn btn-sm" style={{ background: '#3288e0', color: '#fff' }} onClick={() => setEditingFloor(true)}>
                Editar Planta
              </button>
            )}
          </div>

          {/* Planta baixa com apartamentos */}
          {activeAndar ? (
            <FloorPlanEditor
              andar={activeAndar}
              predio={predio}
              readOnly
              onClose={handleBack3D}
              onSelectAp={(ap) => setSelectedAp(ap)}
            />
          ) : (
            <div className="fpv-empty">
              <p>Nenhuma planta baixa cadastrada para este andar.</p>
              {canEdit && (
                <button className="btn btn-primary" onClick={() => setEditingFloor(true)}>
                  Criar Planta Baixa
                </button>
              )}
            </div>
          )}

          {/* Card do apartamento selecionado */}
          {selectedAp && (
            <ApartmentCard
              ap={selectedAp}
              andar={activeAndar}
              predio={predio}
              position={apPos}
              onClose={() => setSelectedAp(null)}
              onStatusChange={handleStatusChange}
              user={user}
            />
          )}
        </div>
      )}

      {/* Diálogo de reserva/venda/aluguel */}
      {statusDialog && (
        <ApStatusDialog
          ap={statusDialog.ap}
          status={statusDialog.status}
          clientes={clientes}
          onConfirm={handleStatusDialogConfirm}
          onCancel={() => setStatusDialog(null)}
        />
      )}
    </div>
  );
}
