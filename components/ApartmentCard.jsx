'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { fmtBRL } from '../lib/data';
import { formatCpfCnpj, formatPhone } from './ClienteManagement';

const AP_STATUS_COLORS = {
  disponivel: { bg: '#22c55e', label: 'Disponível' },
  reservado:  { bg: '#f59e0b', label: 'Reservado' },
  vendido:    { bg: '#ef4444', label: 'Vendido' },
  alugado:    { bg: '#8b5cf6', label: 'Alugado' },
};

const TIPO_LABELS = {
  venda:   'Venda',
  aluguel: 'Aluguel',
  ambos:   'Venda / Aluguel',
};

export function ApartmentCard({ ap, andar, predio, onClose, position, onStatusChange, user }) {
  if (!ap) return null;

  const [actionLoading, setActionLoading] = useState(false);
  const cardRef = useRef(null);
  const cardStyle = position
    ? { left: position.left, top: position.top, transform: position.transform }
    : {};
  const [adjustedStyle, setAdjustedStyle] = useState(cardStyle);

  useLayoutEffect(() => {
    if (!cardRef.current || !position) {
      setAdjustedStyle(cardStyle);
      return;
    }
    const rect = cardRef.current.getBoundingClientRect();
    const margin = 12;
    let top = parseFloat(position.top);
    let left = parseFloat(position.left);
    const overflowB = rect.bottom - (window.innerHeight - margin);
    if (overflowB > 0) top -= overflowB;
    const adjTop = rect.top - Math.max(0, overflowB);
    if (adjTop < margin) top += margin - adjTop;
    const overflowR = rect.right - (window.innerWidth - margin);
    if (overflowR > 0) left -= overflowR;
    const adjLeft = rect.left - Math.max(0, overflowR);
    if (adjLeft < margin) left += margin - adjLeft;
    setAdjustedStyle({ left: `${left}px`, top: `${top}px`, transform: 'none' });
  }, [position]);

  const stInfo = AP_STATUS_COLORS[ap.status] || AP_STATUS_COLORS.disponivel;
  const isLocked = ap.status === 'vendido' || ap.status === 'alugado';
  const canManage = user && ['admin', 'gerente'].includes(user.role);
  const canReserve = user && ['admin', 'gerente', 'vendedor'].includes(user.role);

  const handleAction = async (nextStatus) => {
    if (!onStatusChange) return;
    setActionLoading(true);
    try {
      await onStatusChange(nextStatus);
    } finally {
      setActionLoading(false);
    }
  };

  const photoBg =
    ap.status === 'vendido'
      ? 'linear-gradient(135deg, #3a2a2a 0%, #5a3838 100%)'
      : ap.status === 'alugado'
      ? 'linear-gradient(135deg, #2a2a3a 0%, #383858 100%)'
      : 'linear-gradient(135deg, #1f2c3a 0%, #2d445a 100%)';

  return (
    <div
      ref={cardRef}
      className="lot-card"
      style={position ? { position: 'fixed', ...adjustedStyle } : {}}
    >
      {/* Faixa de status colorida */}
      <div className="lc-photo" style={{ background: photoBg, position: 'relative' }}>
        <button className="lc-close" onClick={onClose}>✕</button>
        <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
          <span
            className="lc-badge"
            style={{ background: stInfo.bg, color: '#fff', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}
          >
            {stInfo.label}
          </span>
        </div>
        <div style={{ position: 'absolute', bottom: 10, right: 12, color: '#fff', fontSize: 13 }}>
          {TIPO_LABELS[ap.tipo] || '—'}
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="lc-header">
        <div className="lc-id">Apt {ap.ap_id}</div>
        <div className="lc-sub">
          {andar ? `${andar.numero}° Andar` : ''}
          {predio ? ` · ${predio.nome}` : ''}
        </div>
      </div>

      {/* Dados principais */}
      <div className="lc-body">
        <div className="lc-grid">
          {ap.area > 0 && (
            <div className="lc-item">
              <div className="lci-label">Área</div>
              <div className="lci-val">{ap.area} m²</div>
            </div>
          )}
          {ap.quartos > 0 && (
            <div className="lc-item">
              <div className="lci-label">Quartos</div>
              <div className="lci-val">{ap.quartos}</div>
            </div>
          )}
          {ap.banheiros > 0 && (
            <div className="lc-item">
              <div className="lci-label">Banheiros</div>
              <div className="lci-val">{ap.banheiros}</div>
            </div>
          )}
          {ap.preco_venda > 0 && (ap.tipo === 'venda' || ap.tipo === 'ambos') && (
            <div className="lc-item">
              <div className="lci-label">Venda</div>
              <div className="lci-val">{fmtBRL(ap.preco_venda)}</div>
            </div>
          )}
          {ap.preco_aluguel > 0 && (ap.tipo === 'aluguel' || ap.tipo === 'ambos') && (
            <div className="lc-item">
              <div className="lci-label">Aluguel/mês</div>
              <div className="lci-val">{fmtBRL(ap.preco_aluguel)}</div>
            </div>
          )}
        </div>

        {/* Cliente vinculado */}
        {ap.cliente && (
          <div className="lc-cliente">
            <div className="lcc-name">{ap.cliente.nome}</div>
            {ap.cliente.cpf_cnpj && (
              <div className="lcc-doc">{formatCpfCnpj(ap.cliente.cpf_cnpj)}</div>
            )}
          </div>
        )}

        {/* Observação de reserva (admin/gerente) */}
        {ap.observacao_reserva && (
          <div className="lc-obs">
            <span className="lco-label">Obs: </span>
            {ap.observacao_reserva}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="lc-footer">
        {!isLocked && ap.status === 'disponivel' && canReserve && (
          <button
            className="btn btn-sm"
            style={{ background: '#f59e0b', color: '#fff' }}
            disabled={actionLoading}
            onClick={() => handleAction('reservado')}
          >
            Reservar
          </button>
        )}
        {!isLocked && ap.status === 'disponivel' && canManage && (ap.tipo === 'venda' || ap.tipo === 'ambos') && (
          <button
            className="btn btn-sm"
            style={{ background: '#ef4444', color: '#fff' }}
            disabled={actionLoading}
            onClick={() => handleAction('vendido')}
          >
            Vender
          </button>
        )}
        {!isLocked && ap.status === 'disponivel' && canManage && (ap.tipo === 'aluguel' || ap.tipo === 'ambos') && (
          <button
            className="btn btn-sm"
            style={{ background: '#8b5cf6', color: '#fff' }}
            disabled={actionLoading}
            onClick={() => handleAction('alugado')}
          >
            Alugar
          </button>
        )}
        {ap.status === 'reservado' && canReserve && (
          <>
            {canManage && (ap.tipo === 'venda' || ap.tipo === 'ambos') && (
              <button
                className="btn btn-sm"
                style={{ background: '#ef4444', color: '#fff' }}
                disabled={actionLoading}
                onClick={() => handleAction('vendido')}
              >
                Vender
              </button>
            )}
            {canManage && (ap.tipo === 'aluguel' || ap.tipo === 'ambos') && (
              <button
                className="btn btn-sm"
                style={{ background: '#8b5cf6', color: '#fff' }}
                disabled={actionLoading}
                onClick={() => handleAction('alugado')}
              >
                Alugar
              </button>
            )}
            <button
              className="btn btn-sm btn-ghost"
              disabled={actionLoading}
              onClick={() => handleAction('disponivel')}
            >
              Liberar
            </button>
          </>
        )}
        {isLocked && canManage && (
          <button
            className="btn btn-sm btn-ghost"
            disabled={actionLoading}
            onClick={() => handleAction('disponivel')}
          >
            Liberar
          </button>
        )}
      </div>
    </div>
  );
}
