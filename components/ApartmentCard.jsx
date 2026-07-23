'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmtBRL } from '../lib/data';
import { userHasModule } from '../lib/modules';
import { formatCpfCnpj, formatPhone } from './ClienteManagement';
import { deleteApartamentoImagem, uploadApartamentoImagens } from '../lib/api';

function ApPriceEditor({ preco, area, canEdit, defaultMode = 'm2', onSave }) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState(defaultMode);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const total = Number(preco) || 0;
  const precoM2 = area > 0 && total > 0 ? Math.round(total / area) : null;

  const open = () => {
    const m = defaultMode;
    setMode(m);
    setDraft(m === 'm2' ? (precoM2 != null ? String(precoM2) : '') : (total > 0 ? String(total) : ''));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const cancel = () => setEditing(false);

  const changeMode = (m) => {
    setMode(m);
    if (m === 'm2' && area > 0 && Number(draft) > 0 && mode === 'total') {
      setDraft(String(Math.round(Number(draft) / area)));
    } else if (m === 'total' && area > 0 && Number(draft) > 0 && mode === 'm2') {
      setDraft(String(Math.round(Number(draft) * area)));
    } else {
      setDraft('');
    }
  };

  const save = async () => {
    const num = Number(draft) || 0;
    const novoTotal = mode === 'm2' ? Math.round(num * (area || 1)) : num;
    if (novoTotal === total) { cancel(); return; }
    setSaving(true);
    try {
      await onSave(novoTotal);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const derivedNum = Number(draft) || 0;
  const derivedLabel = mode === 'm2' && area > 0 && derivedNum > 0
    ? `= ${fmtBRL(Math.round(derivedNum * area))} total`
    : mode === 'total' && area > 0 && derivedNum > 0
    ? `= ${fmtBRL(Math.round(derivedNum / area))}/m²`
    : null;

  if (editing) {
    return (
      <div className="apc-price-editor">
        <div className="apc-pe-tabs">
          <button className={'apc-pe-tab' + (mode === 'm2' ? ' active' : '')} onClick={() => changeMode('m2')}>Por m²</button>
          <button className={'apc-pe-tab' + (mode === 'total' ? ' active' : '')} onClick={() => changeMode('total')}>Total</button>
        </div>
        <div className="apc-pe-row">
          <span className="apc-pe-label">{mode === 'm2' ? 'R$/m²' : 'R$'}</span>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step={mode === 'm2' ? '10' : '1000'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            disabled={saving}
            className="apc-pe-input"
          />
          <button className="apc-pe-save" onClick={save} disabled={saving}>{saving ? '...' : '✓'}</button>
          <button className="apc-pe-cancel" onClick={cancel} disabled={saving}>✕</button>
        </div>
        {derivedLabel && <div className="apc-pe-derived">{derivedLabel}</div>}
      </div>
    );
  }

  return (
    <div className="apc-price-display-row">
      <div>
        <strong>{fmtBRL(preco)}</strong>
        {precoM2 && <span className="apc-price-m2-label"> · {fmtBRL(precoM2)}/m²</span>}
      </div>
      {canEdit && (
        <button className="apc-pe-edit-btn" onClick={open} title="Editar preço">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2.5a1.41 1.41 0 0 1 2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

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

function ApartmentImageModal({ ap, images, initialIndex, onClose }) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setActiveIndex((index) => (index - 1 + images.length) % images.length);
      if (event.key === 'ArrowRight') setActiveIndex((index) => (index + 1) % images.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [images.length, onClose]);
  if (!images.length || typeof document === 'undefined') return null;
  return createPortal(
    <div className="lot-gallery-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lot-gallery-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="lot-gallery-title">
          <div><strong>Apartamento {ap.ap_id}</strong><span>{activeIndex + 1} de {images.length}</span></div>
          <button type="button" onClick={onClose} aria-label="Fechar galeria">×</button>
        </div>
        <div className="lot-gallery-main">
          <img src={images[activeIndex]} alt={`Apartamento ${ap.ap_id} - imagem ${activeIndex + 1}`} />
          {images.length > 1 && <>
            <button type="button" className="lot-gallery-nav lot-gallery-prev" onClick={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)}>‹</button>
            <button type="button" className="lot-gallery-nav lot-gallery-next" onClick={() => setActiveIndex((index) => (index + 1) % images.length)}>›</button>
          </>}
        </div>
        <div className="lot-gallery-thumbs">
          {images.map((imageUrl, index) => (
            <button type="button" key={imageUrl} className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)}>
              <img src={imageUrl} alt={`Selecionar imagem ${index + 1}`} />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ApartmentImageGallery({ ap, images, canEdit, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [modalIndex, setModalIndex] = useState(null);

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try { const result = await uploadApartamentoImagens(ap.id, files); onChange(result.imagens || []); }
    catch (error) { alert(error.message || 'Nao foi possivel enviar as imagens.'); }
    finally { setBusy(false); }
  };

  const remove = async (imageUrl) => {
    if (!confirm('Remover esta imagem do apartamento?')) return;
    setBusy(true);
    try { const result = await deleteApartamentoImagem(ap.id, imageUrl); onChange(result.imagens || []); }
    catch (error) { alert(error.message || 'Nao foi possivel remover a imagem.'); }
    finally { setBusy(false); }
  };

  if (!images.length && !canEdit) return null;
  return (
    <section className="apc-images">
      <div className="lot-image-gallery-head">
        <span>Imagens do apartamento</span>
        {canEdit && images.length < 10 && <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? 'Enviando...' : '+ Adicionar'}</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} />
      {images.length ? (
        <div className="lot-image-grid">
          {images.map((imageUrl, index) => (
            <div className="lot-image-thumb" key={imageUrl}>
              <button type="button" className="lot-image-open" onClick={() => setModalIndex(index)}><img src={imageUrl} alt={`Apartamento ${ap.ap_id} - imagem ${index + 1}`} /></button>
              {canEdit && <button type="button" className="lot-image-remove" onClick={() => remove(imageUrl)} disabled={busy}>×</button>}
            </div>
          ))}
        </div>
      ) : (
        <button type="button" className="lot-image-empty" onClick={() => inputRef.current?.click()} disabled={busy}>Adicionar fotos deste apartamento</button>
      )}
      {modalIndex !== null && <ApartmentImageModal ap={ap} images={images} initialIndex={modalIndex} onClose={() => setModalIndex(null)} />}
    </section>
  );
}

export function ApartmentCard({ ap, andar, predio, onClose, position, onStatusChange, onUpdatePrice, onImagesChange, defaultPriceMode = 'm2', user }) {
  const [actionLoading, setActionLoading] = useState(false);
  const cardRef = useRef(null);
  const initialStyle = position
    ? { left: position.left, top: position.top, transform: position.transform || 'none' }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  const [adjustedStyle, setAdjustedStyle] = useState(initialStyle);
  const [images, setImages] = useState(ap?.imagens || []);

  useEffect(() => { setImages(ap?.imagens || []); }, [ap?.id, ap?.imagens]);

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
  const isAdminOrManager = user && ['admin', 'gerente'].includes(user.role);
  const canSell = isAdminOrManager || (user?.role === 'vendedor' && userHasModule(user, 'predios'));
  const canRent = isAdminOrManager || (user?.role === 'vendedor' && userHasModule(user, 'predios') && userHasModule(user, 'locacoes'));
  const canManage = isAdminOrManager || canSell || canRent;
  const canReserve = user && ['admin', 'gerente', 'vendedor'].includes(user.role);
  const canEditPrice = !!onUpdatePrice && isAdminOrManager && !isLocked;
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

        {(hasSalePrice || hasRentPrice || canEditPrice) && (
          <div className="apc-prices">
            {['venda', 'ambos'].includes(ap.tipo || 'venda') && (
              <div>
                <span>Valor de venda</span>
                <ApPriceEditor
                  preco={ap.preco_venda}
                  area={ap.area}
                  canEdit={canEditPrice}
                  defaultMode={defaultPriceMode}
                  onSave={onUpdatePrice}
                />
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

        <ApartmentImageGallery
          ap={ap}
          images={images}
          canEdit={isAdminOrManager}
          onChange={(nextImages) => { setImages(nextImages); onImagesChange?.(nextImages); }}
        />

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

        {ap.vendedor && (
          <section className="apc-client">
            <div className="apc-section-label">VENDEDOR RESPONSÁVEL</div>
            <strong>{ap.vendedor.nome}</strong>
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
          {!isLocked && ap.status === 'disponivel' && canSell && ['venda', 'ambos'].includes(ap.tipo || 'venda') && (
            <button className="apc-btn apc-btn-sell" disabled={actionLoading} onClick={() => handleAction('vendido')}>
              Vender
            </button>
          )}
          {!isLocked && ap.status === 'disponivel' && canRent && (
            <button className="apc-btn apc-btn-rent" disabled={actionLoading} onClick={() => handleAction('alugado')}>
              Alugar
            </button>
          )}
          {ap.status === 'reservado' && canSell && ['venda', 'ambos'].includes(ap.tipo || 'venda') && (
            <button className="apc-btn apc-btn-sell" disabled={actionLoading} onClick={() => handleAction('vendido')}>
              Concluir venda
            </button>
          )}
          {ap.status === 'reservado' && canRent && ['aluguel', 'ambos'].includes(ap.tipo) && (
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
