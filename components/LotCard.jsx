'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import { fmtBRL, statusLabel as getStatusLabel } from '../lib/data';
import { formatCpfCnpj, formatPhone } from './ClienteManagement';
import { STATUS_COLORS } from './MapView';

export const LotCard = ({ lot, variant = 'detalhado', onClose, position, onStatusChange, onOpenDrawer, user }) => {
  if (!lot) return null;
  const status = STATUS_COLORS[lot.status] || STATUS_COLORS.disponivel;
  const statusLabel = getStatusLabel(lot.status);
  const [actionLoading, setActionLoading] = useState(false);

  const photoBg = lot.status === 'vendido'
    ? 'linear-gradient(135deg, #3a2a2a 0%, #5a3838 100%)'
    : lot.premium
    ? 'linear-gradient(135deg, #1f3a2f 0%, #2d5a45 100%)'
    : 'linear-gradient(135deg, #2c3a4a 0%, #44546a 100%)';

  const cardStyle = position
    ? { left: position.left, top: position.top, transform: position.transform }
    : {};

  const cardRef = useRef(null);
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

    const adjustedRectTop = rect.top - Math.max(0, overflowB);
    if (adjustedRectTop < margin) top += margin - adjustedRectTop;

    const overflowR = rect.right - (window.innerWidth - margin);
    if (overflowR > 0) left -= overflowR;

    const adjustedRectLeft = rect.left - Math.max(0, overflowR);
    if (adjustedRectLeft < margin) left += margin - adjustedRectLeft;

    setAdjustedStyle({ left: `${left}px`, top: `${top}px`, transform: 'none' });
  }, [position]);

  const handleAction = async (nextStatus) => {
    if (!onStatusChange || lot.status === 'vendido') return;
    setActionLoading(true);
    try {
      await onStatusChange(nextStatus);
    } finally {
      setActionLoading(false);
    }
  };

  const canReserve = lot.status === 'disponivel';
  const canSell = lot.status !== 'vendido';
  const sellLabel = actionLoading ? 'Salvando...' : lot.status === 'vendido' ? 'Vendido' : 'Vender lote';

  if (variant === 'compacto') {
    return (
      <div ref={cardRef} className="lot-card lot-card-compacto" style={adjustedStyle}>
        <div className="lcc-arrow" style={{ background: status.fill }} />
        <button className="lcc-x" onClick={onClose} aria-label="Fechar">×</button>
        <div className="lcc-head">
          <div className="lcc-id-block">
            <div className="lcc-quadra">Quadra {lot.quadra}</div>
            <div className="lcc-id">{lot.id}</div>
          </div>
          <div className="lcc-status-pill" style={{ background: status.fill }}>
            <span className="lcc-status-dot" />
            {statusLabel}
          </div>
        </div>
        <div className="lcc-price">{fmtBRL(lot.preco)}</div>
        <div className="lcc-grid">
          <div className="lcc-cell">
            <div className="lcc-cell-k">Área</div>
            <div className="lcc-cell-v">{lot.area} m²</div>
          </div>
          <div className="lcc-cell">
            <div className="lcc-cell-k">Frente</div>
            <div className="lcc-cell-v">{lot.frente || '—'} {lot.frente ? 'm' : ''}</div>
          </div>
          <div className="lcc-cell">
            <div className="lcc-cell-k">Fundo</div>
            <div className="lcc-cell-v">{lot.fundo || '—'} {lot.fundo ? 'm' : ''}</div>
          </div>
        </div>
        <ClientLinkInfo lot={lot} user={user} compact onOpenDrawer={onOpenDrawer} />
        <div className="lcc-actions">
          {canReserve && (
            <button
              className="lcc-btn lcc-btn-ghost"
              disabled={actionLoading}
              onClick={() => handleAction('reservado')}
            >
              Reservar
            </button>
          )}
          <button
            className="lcc-btn lcc-btn-primary"
            disabled={actionLoading || !canSell}
            onClick={() => handleAction('vendido')}
          >
            {sellLabel}
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'premium') {
    return (
      <div ref={cardRef} className="lot-card lot-card-premium" style={adjustedStyle}>
        <button className="lcp-x" onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className="lcp-photo" style={{ background: photoBg }}>
          <div className="lcp-photo-grain" />
          <div className="lcp-photo-label">LOTE</div>
          <div className="lcp-photo-tag">{lot.id}</div>
          {lot.premium && <div className="lcp-premium-badge">PREMIUM</div>}
        </div>
        <div className="lcp-body">
          <div className="lcp-status-line">
            <span className="lcp-status-dot" style={{ background: status.fill, boxShadow: `0 0 0 4px ${status.glow}` }} />
            <span className="lcp-status-txt" style={{ color: status.label }}>{statusLabel.toUpperCase()}</span>
            {lot.orientacao && (
              <>
                <span className="lcp-sep">·</span>
                <span className="lcp-orient">{lot.orientacao}</span>
              </>
            )}
          </div>
          <div className="lcp-quadra">Quadra {lot.quadra || '—'} · Lote {lot.numero || lot.id}</div>
          <div className="lcp-price">
            {fmtBRL(lot.preco)}
            {lot.area > 0 && <span className="lcp-price-sub"> · {fmtBRL(Math.round(lot.preco / lot.area))} /m²</span>}
          </div>
          <div className="lcp-specs">
            <div className="lcp-spec">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2h12v12H2z M2 5h12 M5 2v12 M11 2v12 M2 11h12" stroke="currentColor" strokeWidth="1.2" /></svg>
              <div><b>{lot.area || '—'}</b> {lot.area ? 'm² total' : 'área'}</div>
            </div>
            {lot.frente && (
              <div className="lcp-spec">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12 M2 6v4 M14 6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                <div><b>{lot.frente}</b> m de frente</div>
              </div>
            )}
            {lot.fundo && (
              <div className="lcp-spec">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12 M6 2v12 M10 2v12" stroke="currentColor" strokeWidth="1.2" /></svg>
                <div><b>{lot.fundo}</b> m de fundo</div>
              </div>
            )}
            {lot.esquina && (
              <div className="lcp-spec">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14V2h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                <div>Lote de <b>esquina</b></div>
              </div>
            )}
          </div>
          <ClientLinkInfo lot={lot} user={user} onOpenDrawer={onOpenDrawer} />
          <div className="lcp-actions">
            {canReserve && (
              <button
                className="lcp-btn lcp-btn-ghost"
                disabled={actionLoading}
                onClick={() => handleAction('reservado')}
              >
                Reservar lote
              </button>
            )}
            <button
              className="lcp-btn lcp-btn-primary"
              disabled={actionLoading || !canSell}
              onClick={() => handleAction('vendido')}
            >
              {sellLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={cardRef} className="lot-card lot-card-detalhado" style={adjustedStyle}>
      <div className="lcd-arrow" />
      <button className="lcd-x" onClick={onClose} aria-label="Fechar">
        <svg width="12" height="12" viewBox="0 0 14 14">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <div className="lcd-top">
        <div className="lcd-photo" style={{ background: photoBg }}>
          <div className="lcd-photo-grain" />
          <div className="lcd-photo-label">LOTE {lot.id}</div>
        </div>
        <div className="lcd-top-info">
          <div className="lcd-status-pill" style={{ color: status.label, background: status.glow }}>
            <span className="lcd-status-dot" style={{ background: status.fill }} />
            {statusLabel}
          </div>
          <div className="lcd-quadra">Quadra {lot.quadra || '—'} · Lote {lot.numero || lot.id}</div>
          <div className="lcd-price">{fmtBRL(lot.preco)}</div>
          {lot.area > 0 && <div className="lcd-price-m2">{fmtBRL(Math.round(lot.preco / lot.area))} / m²</div>}
        </div>
      </div>

      <div className="lcd-specs">
        <div className="lcd-spec">
          <div className="lcd-spec-k">Área</div>
          <div className="lcd-spec-v">{lot.area || '—'} <span>{lot.area ? 'm²' : ''}</span></div>
        </div>
        <div className="lcd-spec">
          <div className="lcd-spec-k">Frente</div>
          <div className="lcd-spec-v">{lot.frente || '—'} <span>{lot.frente ? 'm' : ''}</span></div>
        </div>
        <div className="lcd-spec">
          <div className="lcd-spec-k">Fundo</div>
          <div className="lcd-spec-v">{lot.fundo || '—'} <span>{lot.fundo ? 'm' : ''}</span></div>
        </div>
        <div className="lcd-spec">
          <div className="lcd-spec-k">Face</div>
          <div className="lcd-spec-v lcd-spec-v-text">{lot.orientacao || '—'}</div>
        </div>
      </div>

      {(lot.esquina || lot.premium) && (
        <div className="lcd-tags">
          {lot.esquina && <span className="lcd-tag">Esquina</span>}
          {lot.premium && <span className="lcd-tag lcd-tag-premium">Premium</span>}
        </div>
      )}

      <ClientLinkInfo lot={lot} user={user} onOpenDrawer={onOpenDrawer} />

      <div className="lcd-actions">
        {canReserve && (
          <button
            className="lcd-btn lcd-btn-ghost"
            disabled={actionLoading}
            onClick={() => handleAction('reservado')}
          >
            Reservar lote
          </button>
        )}
        <button
          className="lcd-btn lcd-btn-primary"
          disabled={actionLoading || !canSell}
          onClick={() => handleAction('vendido')}
        >
          {sellLabel}
        </button>
      </div>
    </div>
  );
};

function ClientLinkInfo({ lot, user: currentUser, compact = false, onOpenDrawer }) {
  if (!['vendido', 'reservado'].includes(lot.status)) return null;

  const vendedor = lot.cliente_vinculado_por_usuario;
  const userName = vendedor?.nome || vendedor?.login || vendedor?.email || (lot.cliente_vinculado_por ? `Usuario ${lot.cliente_vinculado_por}` : 'Nao informado');

  const canSeeNegociacao = currentUser && (
    currentUser.role === 'admin' || currentUser.role === 'gerente' ||
    currentUser.id === lot.cliente_vinculado_por
  );

  return (
    <div className={compact ? 'lot-client-info lot-client-info-compact' : 'lot-client-info'}>
      <div>
        <span>Cliente vinculado</span>
        <b>{lot.cliente?.nome || 'Cliente nao informado'}</b>
        {lot.cliente && (
          <small>
            ID {lot.cliente.id} - {formatCpfCnpj(lot.cliente.cpf_cnpj)}
            {lot.cliente.celular ? ` - ${formatPhone(lot.cliente.celular)}` : ''}
          </small>
        )}
      </div>
      <div>
        <span>Vinculado por</span>
        <b>{userName}</b>
        {vendedor?.email && <small>{vendedor.email}</small>}
      </div>
      {canSeeNegociacao && (
        <div className="lot-neg-preview">
          <div className="lot-neg-preview-head">
            <span>Negociação</span>
            <button className="lot-neg-ver-mais" onClick={() => onOpenDrawer?.(lot)}>
              Ver histórico
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {lot.ultima_etapa ? (
            <p className="lot-neg-preview-text">{lot.ultima_etapa.descricao}</p>
          ) : (
            <p className="lot-neg-preview-empty">Sem etapas. Clique em "Ver histórico" para adicionar.</p>
          )}
        </div>
      )}
    </div>
  );
}
