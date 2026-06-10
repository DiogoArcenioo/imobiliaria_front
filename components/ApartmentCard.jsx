'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtBRL } from '../lib/data';
import { formatCpfCnpj, formatPhone } from './ClienteManagement';

const AP_STATUS_COLORS = {
  disponivel: { bg: '#22c55e', soft: 'rgba(34,197,94,.12)', label: 'Disponível' },
  reservado:  { bg: '#f59e0b', soft: 'rgba(245,158,11,.12)', label: 'Reservado' },
  vendido:    { bg: '#ef4444', soft: 'rgba(239,68,68,.12)', label: 'Vendido' },
  alugado:    { bg: '#8b5cf6', soft: 'rgba(139,92,246,.12)', label: 'Alugado' },
};

const TIPO_LABELS = {
  venda: 'Venda',
  aluguel: 'Aluguel',
  ambos: 'Venda e aluguel',
};

function Metric({ label, value, suffix }) {
  return (
    <div className="apc-metric">
      <span>{label}</span>
      <strong>{value ?? '—'}{value != null && suffix ? ` ${suffix}` : ''}</strong>
    </div>
  );
}

export function ApartmentCard({ ap, andar, predio, onClose, position, onStatusChange, user }) {
  const [actionLoading, setActionLoading] = useState(false);
  const cardRef = useRef(null);
  const initialStyle = position
    ? { left: position.left, top: position.top, transform: position.transform || 'none' }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  const [adjustedStyle, setAdjustedStyle] = useState(initialStyle);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    if (!position) {
      setAdjustedStyle({ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }

    const target = {
      left: Number.parseFloat(position.left),
      top: Number.parseFloat(position.top),
    };
    setAdjustedStyle({ left: `${target.left}px`, top: `${target.top}px`, transform: 'none' });

    const frame = window.requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const margin = 16;
      const left = Math.min(
        Math.max(margin, target.left),
        Math.max(margin, window.innerWidth - rect.width - margin),
      );
      const top = Math.min(
        Math.max(margin, target.top),
        Math.max(margin, window.innerHeight - rect.height - margin),
      );
      setAdjustedStyle({ left: `${left}px`, top: `${top}px`, transform: 'none' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [position]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!ap) return null;

  const status = AP_STATUS_COLORS[ap.status] || AP_STATUS_COLORS.disponivel;
  const isLocked = ap.status === 'vendido' || ap.status === 'alugado';
  const canManage = user && ['admin', 'gerente'].includes(user.role);
  const canReserve = user && ['admin', 'gerente', 'vendedor'].includes(user.role);
  const hasSalePrice = Number(ap.preco_venda) > 0 && ['venda', 'ambos'].includes(ap.tipo || 'venda');
  const hasRentPrice = Number(ap.preco_aluguel) > 0 && ['aluguel', 'ambos'].includes(ap.tipo);

  const handleAction = async (nextStatus) => {
    if (!onStatusChange) return;
    setActionLoading(true);
    try {
      await onStatusChange(nextStatus);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="apc-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <article
        ref={cardRef}
        className="apartment-popover"
        style={{ ...adjustedStyle, '--ap-status': status.bg, '--ap-status-soft': status.soft }}
        role="dialog"
        aria-modal="true"
        aria-label={`Apartamento ${ap.ap_id}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="apc-accent" />
        <header className="apc-head">
          <div>
            <div className="apc-eyebrow">APARTAMENTO</div>
            <h3>{ap.ap_id}</h3>
            <p>
              {andar ? `${andar.numero}º andar` : 'Andar'}
              {predio?.nome ? ` · ${predio.nome}` : ''}
            </p>
          </div>
          <button className="apc-close" onClick={onClose} aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="apc-status-row">
          <span className="apc-status"><i />{status.label}</span>
          <span className="apc-type">{TIPO_LABELS[ap.tipo] || 'Venda'}</span>
        </div>

        {(hasSalePrice || hasRentPrice) && (
          <div className="apc-prices">
            {hasSalePrice && (
              <div>
                <span>Valor de venda</span>
                <strong>{fmtBRL(ap.preco_venda)}</strong>
              </div>
            )}
            {hasRentPrice && (
              <div>
                <span>Aluguel mensal</span>
                <strong>{fmtBRL(ap.preco_aluguel)}</strong>
              </div>
            )}
          </div>
        )}

        <div className="apc-metrics">
          <Metric label="Área" value={ap.area > 0 ? ap.area : null} suffix="m²" />
          <Metric label="Quartos" value={ap.quartos ?? null} />
          <Metric label="Banheiros" value={ap.banheiros ?? null} />
        </div>

        {ap.cliente && (
          <section className="apc-client">
            <div className="apc-section-label">CLIENTE VINCULADO</div>
            <strong>{ap.cliente.nome}</strong>
            <div>
              {ap.cliente.cpf_cnpj && <span>{formatCpfCnpj(ap.cliente.cpf_cnpj)}</span>}
              {ap.cliente.telefone && <span>{formatPhone(ap.cliente.telefone)}</span>}
            </div>
          </section>
        )}

        {ap.observacao_reserva && (
          <section className="apc-note">
            <div className="apc-section-label">OBSERVAÇÃO</div>
            <p>{ap.observacao_reserva}</p>
          </section>
        )}

        <footer className="apc-actions">
          {!isLocked && ap.status === 'disponivel' && canReserve && (
            <button className="apc-btn apc-btn-reserve" disabled={actionLoading} onClick={() => handleAction('reservado')}>
              Reservar
            </button>
          )}
          {!isLocked && ap.status === 'disponivel' && canManage && ['venda', 'ambos'].includes(ap.tipo || 'venda') && (
            <button className="apc-btn apc-btn-sell" disabled={actionLoading} onClick={() => handleAction('vendido')}>
              Vender
            </button>
          )}
          {!isLocked && ap.status === 'disponivel' && canManage && (
            <button className="apc-btn apc-btn-rent" disabled={actionLoading} onClick={() => handleAction('alugado')}>
              Alugar
            </button>
          )}
          {ap.status === 'reservado' && canManage && ['venda', 'ambos'].includes(ap.tipo || 'venda') && (
            <button className="apc-btn apc-btn-sell" disabled={actionLoading} onClick={() => handleAction('vendido')}>
              Concluir venda
            </button>
          )}
          {ap.status === 'reservado' && canManage && ['aluguel', 'ambos'].includes(ap.tipo) && (
            <button className="apc-btn apc-btn-rent" disabled={actionLoading} onClick={() => handleAction('alugado')}>
              Concluir aluguel
            </button>
          )}
          {(ap.status === 'reservado' ? canReserve : isLocked && canManage) && (
            <button className="apc-btn apc-btn-ghost" disabled={actionLoading} onClick={() => handleAction('disponivel')}>
              Liberar
            </button>
          )}
        </footer>
      </article>
    </div>
  );
}
