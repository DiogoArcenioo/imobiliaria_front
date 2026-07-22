'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getLoteamentoPublico } from '../../../lib/api';
import { MapView, STATUS_COLORS } from '../../../components/MapView';
import { fmtBRL } from '../../../lib/data';

export default function LoteamentoPublicoPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedLot, setSelectedLot] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!id) return;
    getLoteamentoPublico(id)
      .then(setData)
      .catch(() => setError('Loteamento não encontrado ou indisponível.'));
  }, [id]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#555' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏘️</div>
          <h2 style={{ marginBottom: 8 }}>Empreendimento não encontrado</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#888' }}>
        Carregando mapa...
      </div>
    );
  }

  const counts = { disponivel: 0, reservado: 0, vendido: 0 };
  for (const l of data.lots) counts[l.status] = (counts[l.status] || 0) + 1;
  const local = [data.bairro, data.cidade, data.estado].filter(Boolean).join(' · ');

  return (
    <main className="public-map-page">
      {/* Header */}
      <header className="public-map-header">
        <div className="public-map-heading">
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
            {data.fase || 'Loteamento'}
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111', margin: 0 }}>{data.nome}</h1>
          {local && <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>📍 {local}</div>}
        </div>
        <div className="public-map-summary">
          {[
            { label: 'Disponíveis', value: counts.disponivel, color: '#2563eb' },
            { label: 'Reservados', value: counts.reservado, color: '#d97706' },
            { label: 'Vendidos', value: counts.vendido, color: '#dc2626' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Map */}
      <div className="public-map-body">
        <section className="public-map-stage" aria-label="Mapa do loteamento">
          <MapView
            loteamento={data}
            mapTheme="claro"
            responsiveOverlays
            showInfoOverlays={false}
            onLotClick={(lot) => setSelectedLot(selectedLot?.id === lot.id ? null : lot)}
            selectedLotId={selectedLot?.id}
          />
        </section>

        {/* Lot info tooltip */}
        {selectedLot && (
          <div className="public-lot-detail" style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            padding: '14px 20px', boxShadow: '0 4px 24px rgba(0,0,0,.12)',
            display: 'flex', gap: 24, alignItems: 'center', minWidth: 280,
            zIndex: 10,
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>Lote</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111' }}>{selectedLot.id}</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Quadra {selectedLot.quadra}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                <span><b>{selectedLot.area || '—'}</b> {selectedLot.area ? 'm²' : ''}</span>
                {selectedLot.frente && <span><b>{selectedLot.frente}</b> m frente</span>}
              </div>
              <div style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                background: STATUS_COLORS[selectedLot.status]?.glow || '#eee',
                color: STATUS_COLORS[selectedLot.status]?.label || '#555',
              }}>
                {selectedLot.status === 'disponivel' ? 'Disponível' : selectedLot.status === 'reservado' ? 'Reservado' : 'Vendido'}
              </div>
            </div>
            {selectedLot.status === 'disponivel' && selectedLot.preco > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase' }}>Preço</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb' }}>{fmtBRL(selectedLot.preco)}</div>
                {selectedLot.area > 0 && <div style={{ fontSize: '0.7rem', color: '#999' }}>{fmtBRL(Math.round(selectedLot.preco / selectedLot.area))}/m²</div>}
              </div>
            )}
            {selectedLot.imagens?.length > 0 && (
              <div className="public-lot-gallery">
                {selectedLot.imagens.map((imageUrl, index) => (
                  <button type="button" key={imageUrl} onClick={() => setPreviewImage(imageUrl)}>
                    <img src={imageUrl} alt={`Lote ${selectedLot.id} - imagem ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setSelectedLot(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 18, padding: '0 4px' }}>×</button>
          </div>
        )}
      </div>

      {/* Info footer */}
      {(data.descricao || data.area_total || data.entrega) && (
        <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {data.area_total && (
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>Área total</div>
              <div style={{ fontWeight: 600 }}>{data.area_total}</div>
            </div>
          )}
          {data.entrega && (
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>Previsão de entrega</div>
              <div style={{ fontWeight: 600 }}>{data.entrega}</div>
            </div>
          )}
          {data.descricao && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Sobre o empreendimento</div>
              <div style={{ fontSize: '0.85rem', color: '#444' }}>{data.descricao}</div>
            </div>
          )}
        </div>
      )}
      {previewImage && (
        <div className="public-image-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewImage(null)}>
          <button type="button" aria-label="Fechar imagem" onClick={() => setPreviewImage(null)}>×</button>
          <img src={previewImage} alt="Imagem ampliada do lote" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </main>
  );
}
