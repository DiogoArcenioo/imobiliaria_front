'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicProperty } from '../../../lib/api';
import { fmtBRL } from '../../../lib/data';

const STATUS_LABEL = {
  disponivel: 'Disponivel',
  reservado: 'Reservado',
  vendido: 'Vendido',
  alugado: 'Alugado',
};

function Detail({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return <div className="property-public-detail"><span>{label}</span><strong>{value}</strong></div>;
}

export default function PublicPropertyPage() {
  const { token } = useParams();
  const [property, setProperty] = useState(null);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlHeight: html.style.height,
      htmlOverflowX: html.style.overflowX,
      htmlOverflowY: html.style.overflowY,
      bodyHeight: body.style.height,
      bodyOverflowX: body.style.overflowX,
      bodyOverflowY: body.style.overflowY,
    };
    html.style.height = 'auto';
    html.style.overflowX = 'hidden';
    html.style.overflowY = 'auto';
    body.style.height = 'auto';
    body.style.overflowX = 'hidden';
    body.style.overflowY = 'auto';
    return () => {
      html.style.height = previous.htmlHeight;
      html.style.overflowX = previous.htmlOverflowX;
      html.style.overflowY = previous.htmlOverflowY;
      body.style.height = previous.bodyHeight;
      body.style.overflowX = previous.bodyOverflowX;
      body.style.overflowY = previous.bodyOverflowY;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    getPublicProperty(token).then(setProperty).catch((err) => setError(err.message));
  }, [token]);

  const images = property?.imagens || [];
  const location = useMemo(() => property
    ? [property.endereco, property.numero, property.bairro, property.cidade, property.estado].filter(Boolean).join(' - ')
    : '', [property]);

  useEffect(() => {
    if (!lightbox || !images.length) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLightbox(false);
      if (event.key === 'ArrowLeft') setActiveImage((index) => (index - 1 + images.length) % images.length);
      if (event.key === 'ArrowRight') setActiveImage((index) => (index + 1) % images.length);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightbox, images.length]);

  if (error) {
    return (
      <main className="property-public-state">
        <div>
          <span>LINK INDISPONIVEL</span>
          <h1>Este anuncio nao esta mais disponivel</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!property) return <main className="property-public-state"><div><p>Carregando imovel...</p></div></main>;

  const phone = String(property.empresa?.telefone || '').replace(/\D/g, '');
  const whatsapp = phone ? `https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}?text=${encodeURIComponent(`Ola! Tenho interesse em ${property.titulo}.`)}` : null;

  return (
    <main className="property-public-page">
      <header className="property-public-header">
        <div className="property-public-brand">
          <i>⌂</i>
          <div><strong>{property.empresa?.nome || 'Imobiliaria'}</strong><span>Oferta exclusiva</span></div>
        </div>
        <div className="property-public-expiration">Link valido ate {new Date(property.expira_em).toLocaleDateString('pt-BR')}</div>
      </header>

      <section className="property-public-gallery">
        <button
          type="button"
          className="property-public-main-photo"
          disabled={!images.length}
          onClick={() => images.length && setLightbox(true)}
        >
          {images.length ? <img src={images[activeImage]} alt={`${property.titulo} - foto ${activeImage + 1}`} /> : <div className="property-public-no-photo">Imovel sem fotos cadastradas</div>}
          {images.length > 0 && <span>{activeImage + 1} / {images.length}</span>}
        </button>
        {images.length > 1 && (
          <div className="property-public-thumbnails">
            {images.map((image, index) => (
              <button type="button" key={image} className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)}>
                <img src={image} alt={`Ver foto ${index + 1}`} />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="property-public-layout">
        <article className="property-public-content">
          <div className="property-public-tags">
            <span>{property.tipo === 'casa' ? 'Casa' : 'Apartamento'}</span>
            <span className={`status-${property.status}`}>{STATUS_LABEL[property.status] || property.status}</span>
            {property.empreendimento && <span>{property.empreendimento}</span>}
          </div>
          <h1>{property.titulo}</h1>
          {location && <p className="property-public-location">⌖ {location}</p>}

          <div className="property-public-details">
            <Detail label="Area privativa" value={property.area ? `${property.area} m²` : null} />
            <Detail label="Quartos" value={property.quartos} />
            <Detail label="Suites" value={property.suites} />
            <Detail label="Banheiros" value={property.banheiros} />
            <Detail label="Vagas" value={property.vagas} />
            <Detail label="Andar" value={property.andar ? `${property.andar}º` : null} />
            <Detail label="Comodos" value={property.comodos_total} />
          </div>

          {property.comodos?.length > 0 && (
            <section className="property-public-section">
              <h2>Comodos e ambientes</h2>
              <div className="property-public-rooms">{property.comodos.map((room) => <span key={room}>✓ {room}</span>)}</div>
            </section>
          )}

          {property.descricao && (
            <section className="property-public-section">
              <h2>Sobre este imovel</h2>
              <p>{property.descricao}</p>
            </section>
          )}
        </article>

        <aside className="property-public-offer">
          <span>{property.finalidade === 'aluguel' ? 'Valor do aluguel' : 'Valor do imovel'}</span>
          {property.preco_venda != null && property.finalidade !== 'aluguel' && <strong>{fmtBRL(property.preco_venda)}</strong>}
          {property.preco_aluguel != null && property.finalidade !== 'venda' && <strong>{fmtBRL(property.preco_aluguel)}<small>/mes</small></strong>}
          {property.area > 0 && property.preco_venda > 0 && <p>{fmtBRL(Math.round(property.preco_venda / property.area))} por m²</p>}
          {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer">Tenho interesse</a>}
          {property.empresa?.telefone && <div><span>Fale com a imobiliaria</span><b>{property.empresa.telefone}</b></div>}
          {property.empresa?.email && <div><span>E-mail</span><b>{property.empresa.email}</b></div>}
          <small>Consulte disponibilidade e condicoes com a equipe responsavel.</small>
        </aside>
      </div>

      <footer className="property-public-footer">
        <strong>{property.empresa?.nome || 'Imobiliaria'}</strong>
        <span>As informacoes deste anuncio podem sofrer alteracoes sem aviso previo.</span>
      </footer>

      {lightbox && images.length > 0 && (
        <div className="lot-gallery-modal" role="dialog" aria-modal="true" onClick={() => setLightbox(false)}>
          <div className="lot-gallery-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="lot-gallery-title">
              <div><strong>{property.titulo}</strong><span>{activeImage + 1} de {images.length}</span></div>
              <button type="button" onClick={() => setLightbox(false)} aria-label="Fechar galeria">×</button>
            </div>
            <div className="lot-gallery-main">
              <img src={images[activeImage]} alt={`${property.titulo} - foto ${activeImage + 1}`} />
              {images.length > 1 && <>
                <button type="button" className="lot-gallery-nav lot-gallery-prev" onClick={() => setActiveImage((index) => (index - 1 + images.length) % images.length)}>‹</button>
                <button type="button" className="lot-gallery-nav lot-gallery-next" onClick={() => setActiveImage((index) => (index + 1) % images.length)}>›</button>
              </>}
            </div>
            <div className="lot-gallery-thumbs">
              {images.map((image, index) => (
                <button type="button" key={image} className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)}>
                  <img src={image} alt={`Selecionar foto ${index + 1}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
