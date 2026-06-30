'use client';

import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { fmtBRL, statusLabel as getStatusLabel } from '../lib/data';
import { formatCpfCnpj, formatPhone } from './ClienteManagement';
import { STATUS_COLORS } from './MapView';
import { getLotePrecoHistorico } from '../lib/api';

function imprimirFichaLote(lot, loteamento) {
  const fmtV = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const statusTexto = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido' };
  const statusCor = { disponivel: '#2563eb', reservado: '#d97706', vendido: '#dc2626' };
  const cor = statusCor[lot.status] || '#2563eb';
  const local = [loteamento?.bairro, loteamento?.cidade, loteamento?.estado].filter(Boolean).join(' · ');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Ficha do Lote ${lot.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
    .page { max-width: 148mm; margin: auto; padding: 10mm; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${cor}; padding-bottom: 8px; margin-bottom: 12px; }
    .header-left h1 { font-size: 22px; font-weight: 900; color: ${cor}; letter-spacing: -0.5px; }
    .header-left p { font-size: 11px; color: #555; margin-top: 2px; }
    .status-badge { background: ${cor}; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: .05em; }
    .empreend { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
    .empreend-sub { font-size: 11px; color: #666; margin-bottom: 14px; }
    .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .spec { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
    .spec-k { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #888; margin-bottom: 2px; }
    .spec-v { font-size: 15px; font-weight: 700; color: #111; }
    .spec-v small { font-size: 11px; font-weight: 400; color: #555; }
    .price-box { background: ${cor}; color: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    .price-box .lbl { font-size: 11px; opacity: .85; text-transform: uppercase; letter-spacing: .06em; }
    .price-box .val { font-size: 22px; font-weight: 900; }
    .price-box .m2 { font-size: 11px; opacity: .8; }
    .tags { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
    .tag { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
    .tag-premium { background: #fef9c3; color: #854d0e; border-color: #fde047; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
    @media print { @page { size: A5 portrait; margin: 8mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>LOTE ${lot.id}</h1>
        <p>Quadra ${lot.quadra || '—'} · Lote Nº ${lot.numero || lot.id}</p>
      </div>
      <span class="status-badge">${statusTexto[lot.status] || lot.status}</span>
    </div>
    <div class="empreend">${loteamento?.nome || '—'}</div>
    <div class="empreend-sub">${local || 'Local não informado'}${loteamento?.fase ? ' · ' + loteamento.fase : ''}</div>
    <div class="price-box">
      <div><div class="lbl">Preço</div><div class="val">${fmtV(lot.preco || 0)}</div></div>
      ${lot.area > 0 && lot.preco > 0 ? `<div><div class="lbl">Por m²</div><div class="m2">${fmtV(Math.round(lot.preco / lot.area))}/m²</div></div>` : ''}
    </div>
    <div class="specs">
      <div class="spec"><div class="spec-k">Área total</div><div class="spec-v">${lot.area || '—'} <small>${lot.area ? 'm²' : ''}</small></div></div>
      <div class="spec"><div class="spec-k">Frente</div><div class="spec-v">${lot.frente || '—'} <small>${lot.frente ? 'm' : ''}</small></div></div>
      <div class="spec"><div class="spec-k">Fundo</div><div class="spec-v">${lot.fundo || '—'} <small>${lot.fundo ? 'm' : ''}</small></div></div>
      <div class="spec"><div class="spec-k">Orientação</div><div class="spec-v">${lot.orientacao || '—'}</div></div>
    </div>
    ${(lot.esquina || lot.premium) ? `<div class="tags">${lot.esquina ? '<span class="tag">Esquina</span>' : ''}${lot.premium ? '<span class="tag tag-premium">Premium</span>' : ''}</div>` : ''}
    <div class="footer">
      <span>Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
      <span>${loteamento?.nome || ''}</span>
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Permita pop-ups para imprimir a ficha.'); return; }
  win.document.write(html);
  win.document.close();
}

function PriceEditor({ preco, area, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const open = () => {
    setDraft(preco != null ? String(preco) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    const num = Number(String(draft).replace(/\D/g, '')) || 0;
    if (num === Number(preco)) { cancel(); return; }
    setSaving(true);
    try {
      await onSave(num);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const precoM2 = area > 0 && preco > 0 ? Math.round(preco / area) : null;

  if (editing) {
    return (
      <div className="lcd-price-edit">
        <span className="lcd-price-edit-label">R$</span>
        <input
          ref={inputRef}
          className="lcd-price-input"
          type="number"
          min="0"
          step="1000"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          disabled={saving}
        />
        <button className="lcd-price-save" onClick={save} disabled={saving} title="Salvar">
          {saving ? '...' : '✓'}
        </button>
        <button className="lcd-price-cancel" onClick={cancel} disabled={saving} title="Cancelar">✕</button>
      </div>
    );
  }

  return (
    <div className="lcd-price-row">
      <div>
        <div className="lcd-price">{fmtBRL(preco)}</div>
        {precoM2 && <div className="lcd-price-m2">{fmtBRL(precoM2)} / m²</div>}
      </div>
      {canEdit && (
        <button className="lcd-price-edit-btn" onClick={open} title="Editar preço">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2.5a1.41 1.41 0 0 1 2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

export const LotCard = ({ lot, variant = 'detalhado', onClose, position, onStatusChange, onUpdatePrice, onOpenDrawer, user, loteamento }) => {
  if (!lot) return null;
  const status = STATUS_COLORS[lot.status] || STATUS_COLORS.disponivel;
  const statusLabel = getStatusLabel(lot.status);
  const [actionLoading, setActionLoading] = useState(false);
  const canEditPrice = onUpdatePrice && user && ['admin', 'gerente'].includes(user.role) && lot.status !== 'vendido';
  const [precoHistorico, setPrecoHistorico] = useState([]);

  useEffect(() => {
    if (!lot?.db_id) return;
    getLotePrecoHistorico(lot.db_id).then(setPrecoHistorico).catch(() => {});
  }, [lot?.db_id]);

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
        <PriceEditor preco={lot.preco} area={lot.area} canEdit={canEditPrice} onSave={onUpdatePrice} />
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
        {lot.status === 'reservado' && lot.reserva_expira_em && (() => {
          const expira = new Date(lot.reserva_expira_em);
          const diffMs = expira - new Date();
          const expirou = diffMs < 0;
          const diffDias = Math.ceil(Math.abs(diffMs) / 86_400_000);
          return (
            <div style={{
              fontSize: '0.68rem', fontWeight: 600, padding: '3px 7px', borderRadius: 5, marginBottom: 4,
              background: expirou ? '#fee2e2' : diffDias <= 3 ? '#fef9c3' : '#f0fdf4',
              color: expirou ? '#b91c1c' : diffDias <= 3 ? '#92400e' : '#15803d',
            }}>
              {expirou ? `Expirada há ${diffDias}d` : `Expira em ${diffDias}d`}
            </div>
          );
        })()}
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
          <PriceEditor preco={lot.preco} area={lot.area} canEdit={canEditPrice} onSave={onUpdatePrice} />
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
          <PriceEditor preco={lot.preco} area={lot.area} canEdit={canEditPrice} onSave={onUpdatePrice} />
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

      {lot.status === 'reservado' && lot.reserva_expira_em && (() => {
        const expira = new Date(lot.reserva_expira_em);
        const agora = new Date();
        const diffMs = expira - agora;
        const expirou = diffMs < 0;
        const diffDias = Math.ceil(Math.abs(diffMs) / 86_400_000);
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px',
            borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, marginBottom: 4,
            background: expirou ? '#fee2e2' : diffDias <= 3 ? '#fef9c3' : '#f0fdf4',
            color: expirou ? '#b91c1c' : diffDias <= 3 ? '#92400e' : '#15803d',
            border: `1px solid ${expirou ? '#fca5a5' : diffDias <= 3 ? '#fde68a' : '#86efac'}`,
          }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 3v5l3 3M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {expirou ? `Reserva expirada há ${diffDias} dia${diffDias !== 1 ? 's' : ''}` : `Reserva expira em ${diffDias} dia${diffDias !== 1 ? 's' : ''}`}
          </div>
        );
      })()}

      <ClientLinkInfo lot={lot} user={user} onOpenDrawer={onOpenDrawer} />

      {precoHistorico.length > 0 && (
        <div style={{ margin: '8px 0 4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 3v5l3 3M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Histórico de preço
          </div>
          {precoHistorico.slice(0, 5).map((h) => (
            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {h.preco_anterior != null ? fmtBRL(h.preco_anterior) : '—'}
                {' → '}
                <b style={{ color: 'var(--text)' }}>{h.preco_novo != null ? fmtBRL(h.preco_novo) : '—'}</b>
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                {new Date(h.alterado_em).toLocaleDateString('pt-BR')}
                {h.alterado_por ? ` · ${h.alterado_por}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

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
      <button
        onClick={() => imprimirFichaLote(lot, loteamento)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, width: '100%', marginTop: 6,
          padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.75rem', color: 'var(--text-muted)', justifyContent: 'center',
        }}
        title="Abrir ficha do lote para impressão/PDF"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M4 5V2h8v3M3 5h10a1 1 0 0 1 1 1v5H2V6a1 1 0 0 1 1-1zM4 11v3h8v-3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
        Imprimir ficha
      </button>
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
            <>
              {lot.ultima_etapa.valor_novo !== null && lot.ultima_etapa.valor_novo !== undefined && (
                <div className="lot-neg-preview-value">{fmtBRL(lot.ultima_etapa.valor_novo)}</div>
              )}
              <p className="lot-neg-preview-text">{lot.ultima_etapa.descricao}</p>
            </>
          ) : (
            <p className="lot-neg-preview-empty">Sem etapas. Clique em "Ver histórico" para adicionar.</p>
          )}
        </div>
      )}
    </div>
  );
}
