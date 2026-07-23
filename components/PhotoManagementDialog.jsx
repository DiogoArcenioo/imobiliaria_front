'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function PhotoViewer({ title, images, initialIndex, onClose }) {
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

  return createPortal(
    <div className="lot-gallery-modal photo-management-viewer" role="dialog" aria-modal="true" aria-label={`Fotos de ${title}`} onClick={onClose}>
      <div className="lot-gallery-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="lot-gallery-title">
          <div><strong>{title}</strong><span>{activeIndex + 1} de {images.length}</span></div>
          <button type="button" onClick={onClose} aria-label="Fechar galeria">×</button>
        </div>
        <div className="lot-gallery-main">
          <img src={images[activeIndex]} alt={`${title} - foto ${activeIndex + 1}`} />
          {images.length > 1 && (
            <>
              <button type="button" className="lot-gallery-nav lot-gallery-prev" onClick={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)} aria-label="Foto anterior">‹</button>
              <button type="button" className="lot-gallery-nav lot-gallery-next" onClick={() => setActiveIndex((index) => (index + 1) % images.length)} aria-label="Próxima foto">›</button>
            </>
          )}
        </div>
        <div className="lot-gallery-thumbs">
          {images.map((imageUrl, index) => (
            <button type="button" key={imageUrl} className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)}>
              <img src={imageUrl} alt={`Selecionar foto ${index + 1}`} />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function PhotoManagementDialog({
  eyebrow,
  title,
  subtitle,
  images,
  maxImages = 10,
  onUpload,
  onSetCover,
  onRemove,
  onChange,
  onClose,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewerIndex, setViewerIndex] = useState(null);
  const cover = images[0] || null;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && viewerIndex === null) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, viewerIndex]);

  const run = async (operation, fallbackMessage) => {
    setBusy(true);
    setError('');
    try {
      const result = await operation();
      onChange(result.imagens || []);
    } catch (err) {
      setError(err.message || fallbackMessage);
    } finally {
      setBusy(false);
    }
  };

  const upload = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    run(() => onUpload(files), 'Não foi possível enviar as fotos.');
  };

  const chooseCover = (imageUrl) => {
    run(() => onSetCover(imageUrl), 'Não foi possível definir a foto de capa.');
  };

  const remove = (imageUrl) => {
    if (!confirm('Remover esta foto?')) return;
    run(() => onRemove(imageUrl), 'Não foi possível remover a foto.');
  };

  return createPortal(
    <>
      <div className="modal-overlay casa-photos-overlay photo-management-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
        <section className="casa-photos-dialog" role="dialog" aria-modal="true" aria-label={eyebrow}>
          <header>
            <div><span>{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>
            <button type="button" onClick={onClose} aria-label="Fechar">×</button>
          </header>
          <div className="casa-photos-toolbar">
            <label className={busy || images.length >= maxImages ? 'disabled' : ''}>
              {busy ? 'Salvando...' : '+ Adicionar fotos'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                disabled={busy || images.length >= maxImages}
                onChange={upload}
              />
            </label>
            <span>{images.length}/{maxImages} fotos</span>
          </div>
          {error && <div className="casa-photos-error">{error}</div>}
          {images.length ? (
            <div className="casa-photos-grid">
              {images.map((imageUrl, index) => (
                <article key={imageUrl} className={cover === imageUrl ? 'is-cover' : ''}>
                  <button type="button" className="casa-photo-preview" onClick={() => setViewerIndex(index)}>
                    <img src={imageUrl} alt={`${title} - foto ${index + 1}`} />
                  </button>
                  {cover === imageUrl && <span className="casa-cover-badge">Capa</span>}
                  <div>
                    <button type="button" onClick={() => chooseCover(imageUrl)} disabled={busy || cover === imageUrl}>
                      {cover === imageUrl ? 'Foto de capa' : 'Usar como capa'}
                    </button>
                    <button type="button" className="danger" onClick={() => remove(imageUrl)} disabled={busy}>Remover</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <label className="casa-photos-empty">
              Adicionar a foto de capa e outras imagens
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={busy} onChange={upload} />
            </label>
          )}
        </section>
      </div>
      {viewerIndex !== null && images.length > 0 && (
        <PhotoViewer title={title} images={images} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </>,
    document.body,
  );
}
