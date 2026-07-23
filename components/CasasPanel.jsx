'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmtBRL } from '../lib/data';
import {
  createEtapaUnidade,
  deleteCasaFoto,
  getEtapasUnidade,
  setCasaFotoCapa,
  updateEtapa,
  uploadCasaFotos,
} from '../lib/api';
import { formatCpfCnpj } from './ClienteManagement';
import { House3DView } from './House3DView';
import { LocacaoDialog } from './LocacoesPanel';
import { SaleDialog } from './SaleDialog';
import { NegociacaoDrawer } from './NegociacaoDrawer';
import { copyTemporaryPropertyLink } from '../lib/public-share';

const STATUS = {
  disponivel: { label: 'Disponivel', color: '#22c55e' },
  reservado: { label: 'Reservado', color: '#f59e0b' },
  vendido: { label: 'Vendido', color: '#ef4444' },
  alugado: { label: 'Alugado', color: '#8b5cf6' },
};

const COMODOS_BASE = ['Sala', 'Cozinha', 'Quarto', 'Suite', 'Banheiro', 'Lavanderia', 'Garagem', 'Varanda', 'Quintal', 'Escritorio'];
const COMODO_FIELD = {
  Quarto: 'quartos',
  Banheiro: 'banheiros',
  Suite: 'suites',
  Garagem: 'vagas',
};

function clientLabel(cliente) {
  if (!cliente) return '';
  return `${cliente.nome} - ${formatCpfCnpj(cliente.cpf_cnpj)}`;
}

function CasaReservaDialog({ casa, clientes, onSearchClientes, onCreateClient, onConfirm, onCancel }) {
  return (
    <SaleDialog
      lot={casa}
      entityLabel="Casa"
      entityName={casa.nome}
      contextName={casa.codigo || [casa.cidade, casa.estado].filter(Boolean).join(' - ') || 'Casa'}
      price={casa.preco_venda}
      actionStatus="reservado"
      clientes={clientes}
      onSearch={onSearchClientes}
      onClose={onCancel}
      onCreateClient={onCreateClient}
      onConfirm={(cliente, observacao) => onConfirm({
        clienteId: cliente.id,
        observacao,
        dataVenda: undefined,
      })}
    />
  );
}

function CasaStatusDialog({ casa, status, clientes, onSearchClientes, onConfirm, onCancel }) {
  const [query, setQuery] = useState('');
  const [localClientes, setLocalClientes] = useState(clientes);
  const [selected, setSelected] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clientesError, setClientesError] = useState('');

  useEffect(() => {
    setLocalClientes(clientes);
  }, [clientes]);

  useEffect(() => {
    if (!onSearchClientes) return;
    const normalized = query.trim();
    if (normalized.length === 1) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoadingClientes(true);
      setClientesError('');
      try {
        const data = await onSearchClientes(normalized);
        if (active) setLocalClientes(data || []);
      } catch (err) {
        if (active) setClientesError(err.message || 'Nao foi possivel carregar clientes.');
      } finally {
        if (active) setLoadingClientes(false);
      }
    }, normalized ? 350 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, onSearchClientes]);

  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return localClientes.slice(0, 8);
    return localClientes.filter((cliente) =>
      [cliente.nome, cliente.cpf_cnpj].filter(Boolean).some((value) =>
        String(value).toLowerCase().includes(normalized)
      )
    ).slice(0, 8);
  }, [localClientes, query]);

  const label = status === 'reservado' ? 'Reservar casa' : 'Vender casa';

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await onConfirm({
        clienteId: selected.id,
        observacao: status === 'reservado' ? observacao : undefined,
        dataVenda: status === 'vendido' ? dataVenda : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay ap-status-modal-overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal-box ap-status-modal" style={{ maxWidth: 500 }} role="dialog" aria-modal="true">
        <h3 className="modal-title">{label} - {casa.nome}</h3>
        <div className="modal-body">
          <label className="field-label">
            Cliente
            <input
              className="field-input"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSelected(null); }}
              placeholder="Buscar por nome ou CPF..."
              autoFocus
            />
          </label>
          <div className="sale-client-results">
            {loadingClientes ? (
              <div className="sale-client-empty">Carregando clientes...</div>
            ) : clientesError ? (
              <div className="sale-client-empty sale-client-error">{clientesError}</div>
            ) : options.length === 0 ? (
              <div className="sale-client-empty">Nenhum cliente encontrado.</div>
            ) : options.map((cliente) => (
              <button
                key={cliente.id}
                className={'sale-client-option' + (selected?.id === cliente.id ? ' sale-client-option-active' : '')}
                onClick={() => { setSelected(cliente); setQuery(clientLabel(cliente)); }}
              >
                <span><b>{cliente.nome}</b><small>{formatCpfCnpj(cliente.cpf_cnpj)}</small></span>
              </button>
            ))}
          </div>
          {status === 'vendido' && (
            <label className="field-label">
              Data da venda
              <input className="field-input" type="date" value={dataVenda} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDataVenda(event.target.value)} />
            </label>
          )}
          {status === 'reservado' && (
            <label className="field-label">
              Observacao
              <textarea className="field-input" rows={3} value={observacao} onChange={(event) => setObservacao(event.target.value)} />
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="ap-modal-btn ap-modal-btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="ap-modal-btn ap-modal-btn-primary" disabled={!selected || saving} onClick={handleConfirm}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CasaForm({ initial, onConfirm, onCancel }) {
  const initialComodosDetalhes = initial?.comodos_detalhes || Object.fromEntries(
    (initial?.comodos || []).map((name) => [name, initial?.[COMODO_FIELD[name]] || 1])
  );
  const steps = [
    { id: 'basico', label: 'Casa' },
    { id: 'endereco', label: 'Endereco' },
    { id: 'detalhes', label: 'Comodos' },
    { id: 'valores', label: 'Valores' },
    { id: 'revisao', label: 'Revisao' },
  ];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({
    nome: initial?.nome || '',
    codigo: initial?.codigo || '',
    cep: initial?.cep || '',
    endereco: initial?.endereco || '',
    numero: initial?.numero || '',
    complemento: initial?.complemento || '',
    bairro: initial?.bairro || '',
    cidade: initial?.cidade || '',
    estado: initial?.estado || '',
    area: initial?.area || '',
    quartos: initial?.quartos || '',
    banheiros: initial?.banheiros || '',
    suites: initial?.suites || '',
    vagas: initial?.vagas || '',
    comodos_total: initial?.comodos_total || '',
    comodos: initial?.comodos || [],
    comodos_detalhes: initialComodosDetalhes,
    preco_venda: initial?.preco_venda || '',
    preco_aluguel: initial?.preco_aluguel || '',
    tipo: initial?.tipo || 'venda',
    foto_url: initial?.foto_url || '',
    descricao: initial?.descricao || '',
    ativo: initial?.ativo ?? true,
  }));
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const selectedComodos = form.comodos || [];
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const canGoNext = (() => {
    if (current.id === 'basico') return form.nome.trim() && form.tipo;
    if (current.id === 'valores') {
      if (form.tipo === 'venda') return Number(form.preco_venda) > 0;
      if (form.tipo === 'aluguel') return Number(form.preco_aluguel) > 0;
      return Number(form.preco_venda) > 0 || Number(form.preco_aluguel) > 0;
    }
    return true;
  })();
  const toggleComodo = (name) => setForm((prev) => {
    const selected = prev.comodos.includes(name);
    const field = COMODO_FIELD[name];
    const nextDetails = { ...(prev.comodos_detalhes || {}) };
    if (selected) {
      delete nextDetails[name];
      return {
        ...prev,
        comodos: prev.comodos.filter((item) => item !== name),
        comodos_detalhes: nextDetails,
        ...(field ? { [field]: '' } : {}),
      };
    }
    nextDetails[name] = field ? Number(prev[field] || 1) : 1;
    return {
      ...prev,
      comodos: [...prev.comodos, name],
      comodos_detalhes: nextDetails,
      ...(field && !prev[field] ? { [field]: 1 } : {}),
    };
  });

  const setComodoQuantidade = (name, value) => {
    const clean = value === '' ? '' : Math.max(1, Number(value));
    const field = COMODO_FIELD[name];
    setForm((prev) => ({
      ...prev,
      comodos_detalhes: {
        ...(prev.comodos_detalhes || {}),
        [name]: clean,
      },
      ...(field ? { [field]: clean } : {}),
    }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const numericKeys = ['area', 'quartos', 'banheiros', 'suites', 'vagas', 'comodos_total', 'preco_venda', 'preco_aluguel'];
      const payload = { ...form };
      const comodosDetalhes = {};
      payload.comodos.forEach((name) => {
        const quantidade = Math.max(1, Number(payload.comodos_detalhes?.[name] || 1));
        comodosDetalhes[name] = quantidade;
        const field = COMODO_FIELD[name];
        if (field) payload[field] = quantidade;
      });
      payload.comodos_detalhes = comodosDetalhes;
      payload.comodos_total = Object.values(comodosDetalhes).reduce((sum, value) => sum + value, 0) || undefined;
      numericKeys.forEach((key) => {
        payload[key] = payload[key] === '' ? undefined : Number(payload[key]);
      });
      if (payload.tipo === 'venda') payload.preco_aluguel = undefined;
      if (payload.tipo === 'aluguel') payload.preco_venda = undefined;
      await onConfirm(payload);
    } finally {
      setSaving(false);
    }
  }

  const next = () => {
    if (!canGoNext) return;
    setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const back = () => setStep((value) => Math.max(value - 1, 0));

  const StepTitle = () => {
    const copy = {
      basico: ['Vamos comecar pelo essencial', 'Nome e finalidade da casa. O codigo sera criado automaticamente.'],
      endereco: ['Onde fica essa casa?', 'Informe so o que voce tiver agora. O restante pode ficar em branco.'],
      detalhes: ['Como a casa e por dentro?', 'Marque os comodos e preencha os numeros principais.'],
      valores: ['Como essa casa sera negociada?', 'Precos, foto e observacao para o card.'],
      revisao: ['Confira antes de salvar', 'Se estiver tudo certo, finalize o cadastro.'],
    }[current.id];
    return (
      <div className="casa-step-title">
        <h3>{copy[0]}</h3>
        <p>{copy[1]}</p>
      </div>
    );
  };

  const ReviewItem = ({ label, value }) => (
    <div className="casa-review-item">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );

  return (
    <div className="sale-modal-backdrop" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="sale-modal casa-form-modal casa-wizard-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 760 }}>
        <header className="sale-modal-head">
          <div>
            <div className="dash-eyebrow">{initial ? 'EDITAR CASA' : 'NOVA CASA'}</div>
            <h2>{initial ? initial.nome : 'Cadastrar casa'}</h2>
            <p>Cadastro por etapas, mais rapido de preencher.</p>
          </div>
          <button className="sale-modal-close" onClick={onCancel} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </header>
        <form onSubmit={handleSubmit} className="casa-wizard-form">
          <div className="casa-stepper">
            {steps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={(index === step ? 'active ' : '') + (index < step ? 'done' : '')}
                onClick={() => index <= step && setStep(index)}
              >
                <span>{index + 1}</span>
                {item.label}
              </button>
            ))}
          </div>

          <StepTitle />

          {current.id === 'basico' && (
            <div className="casa-step-card">
              <label className="field-label casa-main-field">Nome da casa<input className="field-input" value={form.nome} onChange={(e) => set('nome', e.target.value)} required autoFocus placeholder="Ex: Casa Jardim Norte" /></label>
              <div className="casa-form-grid casa-form-grid-single">
                <label className="field-label">Finalidade<select className="field-input" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}><option value="venda">Venda</option><option value="aluguel">Aluguel</option><option value="ambos">Venda e aluguel</option></select></label>
              </div>
              {initial?.codigo && <div className="casa-auto-code">Codigo automatico: <b>{initial.codigo}</b></div>}
            </div>
          )}

          {current.id === 'endereco' && (
            <div className="casa-step-card">
              <div className="casa-form-grid casa-address-grid">
                <label className="field-label">CEP<input className="field-input" value={form.cep} onChange={(e) => set('cep', e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Somente numeros" /></label>
                <label className="field-label casa-address-street">Endereco<input className="field-input" value={form.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder="Rua, avenida..." /></label>
                <label className="field-label">Numero<input className="field-input" value={form.numero} onChange={(e) => set('numero', e.target.value)} /></label>
                <label className="field-label">Bairro<input className="field-input" value={form.bairro} onChange={(e) => set('bairro', e.target.value)} /></label>
                <label className="field-label casa-address-city">Cidade<input className="field-input" value={form.cidade} onChange={(e) => set('cidade', e.target.value)} /></label>
                <label className="field-label">UF<input className="field-input" value={form.estado} onChange={(e) => set('estado', e.target.value.toUpperCase().slice(0, 2))} /></label>
                <label className="field-label casa-address-complement">Complemento<input className="field-input" value={form.complemento} onChange={(e) => set('complemento', e.target.value)} placeholder="Opcional" /></label>
              </div>
            </div>
          )}

          {current.id === 'detalhes' && (
            <div className="casa-step-card">
              <label className="field-label casa-area-field">Area m2<input className="field-input" type="number" min="0" step="0.01" value={form.area} onChange={(e) => set('area', e.target.value)} /></label>
              <div className="field-label" style={{ marginBottom: -6 }}>Marque os comodos da casa</div>
              <div className="casa-comodos-picker casa-comodos-large">
                {COMODOS_BASE.map((name) => (
                  <button key={name} type="button" className={form.comodos.includes(name) ? 'active' : ''} onClick={() => toggleComodo(name)}>
                    {name}
                  </button>
                ))}
              </div>
              {selectedComodos.length === 0 ? (
                <div className="casa-comodos-empty">Selecione os comodos acima para preencher as quantidades.</div>
              ) : (
                <div className="casa-comodos-qty-grid">
                  {selectedComodos.map((name) => (
                    <label key={name} className="field-label">
                      {name}
                      <input
                        className="field-input"
                        type="number"
                        min="1"
                        value={form.comodos_detalhes?.[name] ?? ''}
                        onChange={(e) => setComodoQuantidade(name, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {current.id === 'valores' && (
            <div className="casa-step-card">
              <div className="casa-form-grid casa-form-grid-compact">
                {(form.tipo === 'venda' || form.tipo === 'ambos') && <label className="field-label">Valor de venda<input className="field-input" type="number" min="0" step="100" value={form.preco_venda} onChange={(e) => set('preco_venda', e.target.value)} placeholder="Ex: 350000" /></label>}
                {(form.tipo === 'aluguel' || form.tipo === 'ambos') && <label className="field-label">Valor de aluguel<input className="field-input" type="number" min="0" step="50" value={form.preco_aluguel} onChange={(e) => set('preco_aluguel', e.target.value)} placeholder="Ex: 2500" /></label>}
              </div>
              <label className="field-label">Foto da casa<input className="field-input" value={form.foto_url} onChange={(e) => set('foto_url', e.target.value)} placeholder="https://..." /></label>
              <label className="field-label">Observacao<textarea className="field-input casa-observacao-input" rows={5} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Detalhes importantes para o time comercial..." /></label>
            </div>
          )}

          {current.id === 'revisao' && (
            <div className="casa-step-card casa-review">
              <ReviewItem label="Casa" value={[form.nome, initial?.codigo].filter(Boolean).join(' - ')} />
              <ReviewItem label="Finalidade" value={form.tipo === 'ambos' ? 'Venda e aluguel' : form.tipo} />
              <ReviewItem label="Endereco" value={[form.endereco, form.numero, form.bairro, form.cidade, form.estado].filter(Boolean).join(' - ')} />
              <ReviewItem label="Comodos" value={form.comodos.length ? form.comodos.map((name) => `${name}: ${form.comodos_detalhes?.[name] || 1}`).join(', ') : '-'} />
              <ReviewItem label="Area" value={form.area ? `${form.area} m2` : '-'} />
              <ReviewItem label="Valores" value={[
                form.preco_venda ? `Venda: ${fmtBRL(form.preco_venda)}` : null,
                form.preco_aluguel ? `Aluguel: ${fmtBRL(form.preco_aluguel)}` : null,
              ].filter(Boolean).join(' / ')} />
            </div>
          )}

          {!canGoNext && current.id !== 'revisao' && (
            <div className="casa-step-hint">
              {current.id === 'basico' ? 'Informe pelo menos o nome da casa para continuar.' : 'Informe ao menos um valor para essa finalidade.'}
            </div>
          )}

          <footer className="sale-modal-actions casa-wizard-actions" style={{ padding: 0 }}>
            <button type="button" className="table-action table-action-ghost" onClick={onCancel}>Cancelar</button>
            {step > 0 && <button type="button" className="table-action table-action-ghost" onClick={back}>Voltar</button>}
            {!isLast ? (
              <button type="button" className="table-action" disabled={!canGoNext} onClick={next}>Avancar</button>
            ) : (
              <button className="table-action" disabled={saving || !form.nome.trim()}>{saving ? 'Salvando...' : 'Salvar casa'}</button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}

function CasaGalleryModal({ casa, photos, initialIndex = 0, onClose }) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setActiveIndex((index) => (index - 1 + photos.length) % photos.length);
      if (event.key === 'ArrowRight') setActiveIndex((index) => (index + 1) % photos.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photos.length, onClose]);

  if (!photos.length || typeof document === 'undefined') return null;
  return createPortal(
    <div className="lot-gallery-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lot-gallery-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="lot-gallery-title">
          <div><strong>{casa.nome}</strong><span>{activeIndex + 1} de {photos.length}</span></div>
          <button type="button" onClick={onClose} aria-label="Fechar galeria">×</button>
        </div>
        <div className="lot-gallery-main">
          <img src={photos[activeIndex]} alt={`${casa.nome} - foto ${activeIndex + 1}`} />
          {photos.length > 1 && (
            <>
              <button type="button" className="lot-gallery-nav lot-gallery-prev" onClick={() => setActiveIndex((index) => (index - 1 + photos.length) % photos.length)}>‹</button>
              <button type="button" className="lot-gallery-nav lot-gallery-next" onClick={() => setActiveIndex((index) => (index + 1) % photos.length)}>›</button>
            </>
          )}
        </div>
        <div className="lot-gallery-thumbs">
          {photos.map((photo, index) => (
            <button type="button" key={photo} className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)}>
              <img src={photo} alt={`Selecionar foto ${index + 1}`} />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CasaPhotosDialog({ casa, onClose, onChanged }) {
  const [photos, setPhotos] = useState(casa.fotos || []);
  const [cover, setCover] = useState(casa.capa_url || casa.foto_url || null);
  const [busy, setBusy] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [error, setError] = useState('');

  const applyResult = async (result) => {
    setPhotos(result.fotos || []);
    setCover(result.capa_url || null);
    await onChanged?.();
  };

  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setBusy(true); setError('');
    try { await applyResult(await uploadCasaFotos(casa.id, files)); }
    catch (err) { setError(err.message || 'Erro ao enviar fotos'); }
    finally { setBusy(false); }
  };

  const chooseCover = async (photo) => {
    setBusy(true); setError('');
    try { await applyResult(await setCasaFotoCapa(casa.id, photo)); }
    catch (err) { setError(err.message || 'Erro ao definir a capa'); }
    finally { setBusy(false); }
  };

  const remove = async (photo) => {
    if (!confirm('Remover esta foto da casa?')) return;
    setBusy(true); setError('');
    try { await applyResult(await deleteCasaFoto(casa.id, photo)); }
    catch (err) { setError(err.message || 'Erro ao remover a foto'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay casa-photos-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="casa-photos-dialog" role="dialog" aria-modal="true">
        <header>
          <div><span>FOTOS DA CASA</span><h2>{casa.nome}</h2><p>Escolha uma capa e adicione fotos dos comodos.</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="casa-photos-toolbar">
          <label className={busy || photos.length >= 20 ? 'disabled' : ''}>
            {busy ? 'Salvando...' : '+ Adicionar fotos'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={busy || photos.length >= 20} onChange={upload} />
          </label>
          <span>{photos.length}/20 fotos</span>
        </div>
        {error && <div className="casa-photos-error">{error}</div>}
        {photos.length ? (
          <div className="casa-photos-grid">
            {photos.map((photo, index) => (
              <article key={photo} className={cover === photo ? 'is-cover' : ''}>
                <button type="button" className="casa-photo-preview" onClick={() => setViewerIndex(index)}><img src={photo} alt={`${casa.nome} - foto ${index + 1}`} /></button>
                {cover === photo && <span className="casa-cover-badge">Capa</span>}
                <div>
                  <button type="button" onClick={() => chooseCover(photo)} disabled={busy || cover === photo}>{cover === photo ? 'Foto de capa' : 'Usar como capa'}</button>
                  <button type="button" className="danger" onClick={() => remove(photo)} disabled={busy}>Remover</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <label className="casa-photos-empty">Adicionar a foto de capa e imagens dos comodos<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} /></label>
        )}
      </section>
      {viewerIndex !== null && <CasaGalleryModal casa={casa} photos={photos} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
    </div>,
    document.body,
  );
}

function CasaCard({ casa, canManage, user, onEdit, onDelete, onStatus, onRent, onNegociacao, onPhotosChanged }) {
  const status = STATUS[casa.status] || STATUS.disponivel;
  const location = [casa.endereco, casa.numero, casa.bairro, casa.cidade, casa.estado].filter(Boolean).join(' - ');
  const mainPrice = casa.status === 'alugado' || casa.tipo === 'aluguel'
    ? fmtBRL(casa.preco_aluguel)
    : fmtBRL(casa.preco_venda);
  const canSeeNegociacao = ['reservado', 'vendido'].includes(casa.status) && user && (
    user.role === 'admin' || user.role === 'gerente' || user.id === casa.cliente_vinculado_por
  );
  const [photosOpen, setPhotosOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const galleryPhotos = casa.fotos?.length ? casa.fotos : (casa.foto_url ? [casa.foto_url] : []);
  const coverPhoto = casa.capa_url || casa.foto_url;

  return (
    <article className="casa-card">
      <div className="casa-card-photo">
        {coverPhoto ? (
          <button type="button" className="casa-cover-button" onClick={() => setViewerOpen(true)} aria-label="Abrir fotos da casa">
            <img src={coverPhoto} alt={casa.nome} />
            {galleryPhotos.length > 1 && <small>{galleryPhotos.length} fotos</small>}
          </button>
        ) : (
          <House3DView casa={casa} />
        )}
        <span style={{ background: status.color }}>{status.label}</span>
        {user && (
          <button
            type="button"
            className="casa-share-button"
            disabled={sharing}
            title="Copiar link publico valido por 7 dias"
            aria-label="Compartilhar casa"
            onClick={async (event) => {
              event.stopPropagation();
              setSharing(true);
              try {
                await copyTemporaryPropertyLink('casa', casa.id, casa.nome);
              } catch (error) {
                alert(error.message || 'Nao foi possivel criar o link publico.');
              } finally {
                setSharing(false);
              }
            }}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M7 9a3 3 0 0 0 4.5.4l2-2A3 3 0 0 0 9 3L7.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M9 7a3 3 0 0 0-4.5-.4l-2 2A3 3 0 0 0 7 13l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="casa-card-body">
        <div className="casa-card-head">
          <div>
            <div className="dash-eyebrow">{casa.codigo || casa.tipo}</div>
            <h3>{casa.nome}</h3>
            <p>{location || 'Endereco nao informado'}</p>
          </div>
          <strong>{mainPrice}</strong>
        </div>
        <div className="casa-card-specs">
          <span>{casa.area || '-'} m2</span>
          <span>{casa.comodos_total || casa.comodos?.length || 0} comodos</span>
          <span>{casa.quartos || 0} quartos</span>
          <span>{casa.banheiros || 0} banheiros</span>
          <span>{casa.vagas || 0} vagas</span>
        </div>
        {casa.comodos?.length > 0 && (
          <div className="casa-card-tags">
            {casa.comodos.slice(0, 6).map((item) => <span key={item}>{item}</span>)}
          </div>
        )}
        {casa.cliente && (
          <div className="casa-card-client">
            Cliente: <b>{casa.cliente.nome}</b>
          </div>
        )}
        {canSeeNegociacao && (
          <div className="lot-neg-preview">
            <div className="lot-neg-preview-head">
              <span>Histórico da negociação</span>
              <button type="button" className="lot-neg-ver-mais" onClick={() => onNegociacao(casa)}>
                Ver histórico
              </button>
            </div>
            {casa.observacao_reserva ? (
              <p className="lot-neg-preview-text">{casa.observacao_reserva}</p>
            ) : (
              <p className="lot-neg-preview-empty">Abra o histórico para consultar ou adicionar etapas.</p>
            )}
          </div>
        )}
        <div className="casa-card-actions">
          {casa.status !== 'vendido' && casa.status !== 'alugado' && (
            <>
              <button className="table-action table-action-ghost" onClick={() => onStatus(casa, 'reservado')}>Reservar</button>
              {(casa.tipo === 'venda' || casa.tipo === 'ambos') && <button className="table-action" onClick={() => onStatus(casa, 'vendido')}>Vender</button>}
              {(casa.tipo === 'aluguel' || casa.tipo === 'ambos') && <button className="table-action" style={{ background: '#8b5cf6' }} onClick={() => onRent(casa)}>Alugar</button>}
            </>
          )}
          {(casa.status === 'reservado' || casa.status === 'vendido') && (
            <button className="table-action table-action-ghost" onClick={() => onStatus(casa, 'disponivel')}>Liberar</button>
          )}
          {canManage && (
            <>
              <button className="table-action table-action-ghost" onClick={() => setPhotosOpen(true)}>Fotos</button>
              <button className="table-action table-action-ghost" onClick={() => onEdit(casa)}>Editar</button>
              <button className="table-action table-action-ghost" style={{ color: '#dc2626' }} onClick={() => onDelete(casa)}>Remover</button>
            </>
          )}
        </div>
      </div>
      {viewerOpen && galleryPhotos.length > 0 && <CasaGalleryModal casa={casa} photos={galleryPhotos} onClose={() => setViewerOpen(false)} />}
      {photosOpen && <CasaPhotosDialog casa={casa} onClose={() => setPhotosOpen(false)} onChanged={onPhotosChanged} />}
    </article>
  );
}

function currencyDraft(value) {
  const number = Number(value || 0);
  return number ? number.toLocaleString('pt-BR') : '';
}

function parseCurrency(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function historicalValueFor(etapas, index, currentValue) {
  const etapa = etapas[index];
  if (etapa?.valor_novo !== null && etapa?.valor_novo !== undefined) return etapa.valor_novo;
  if (etapa?.valor_anterior !== null && etapa?.valor_anterior !== undefined) return etapa.valor_anterior;
  for (let i = index + 1; i < etapas.length; i += 1) {
    const next = etapas[i];
    if (next?.valor_anterior !== null && next?.valor_anterior !== undefined) return next.valor_anterior;
    if (next?.valor_novo !== null && next?.valor_novo !== undefined) return next.valor_novo;
  }
  return currentValue;
}

function CasaNegociacaoDrawer({ casa, user, onClose, onSaved }) {
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState('');
  const [newValueDraft, setNewValueDraft] = useState(currencyDraft(casa?.preco_venda));
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editValueDraft, setEditValueDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const canAddEtapa = user && (
    user.role === 'admin' || user.role === 'gerente' ||
    user.id === casa?.cliente_vinculado_por
  );

  useEffect(() => {
    if (!casa?.id) return;
    let alive = true;
    setLoading(true);
    setError('');
    setNewValueDraft(currencyDraft(casa.preco_venda));
    getEtapasUnidade('casa', casa.id)
      .then((list) => { if (alive) setEtapas(list); })
      .catch((err) => { if (alive) setError(err.message || 'Erro ao carregar negociacao'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [casa?.id, casa?.preco_venda]);

  async function handleAdd() {
    if (!newDraft.trim()) return;
    setAddSaving(true);
    setError('');
    try {
      const created = await createEtapaUnidade('casa', casa.id, newDraft, parseCurrency(newValueDraft));
      const next = [...etapas, created];
      setEtapas(next);
      setNewDraft('');
      setAdding(false);
      if (created.valor_novo !== null && created.valor_novo !== undefined) {
        setNewValueDraft(currencyDraft(created.valor_novo));
      }
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Erro ao registrar negociacao');
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(etapa) {
    setEditingId(etapa.id);
    setEditDraft(etapa.descricao);
    setEditValueDraft(currencyDraft(etapa.valor_novo ?? casa.preco_venda));
    setError('');
  }

  async function handleEdit() {
    if (!editDraft.trim() || !editingId) return;
    setEditSaving(true);
    setError('');
    try {
      const updated = await updateEtapa(editingId, editDraft, parseCurrency(editValueDraft));
      setEtapas((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      setEditingId(null);
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Erro ao salvar etapa');
    } finally {
      setEditSaving(false);
    }
  }

  if (!casa) return null;

  return (
    <div className="neg-backdrop" onClick={onClose}>
      <aside className="neg-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="neg-drawer-head">
          <div>
            <div className="neg-drawer-eyebrow">HISTORICO DE NEGOCIACAO</div>
            <h3 className="neg-drawer-title">{casa.codigo || casa.nome}</h3>
            <p className="neg-drawer-sub">
              {casa.cliente?.nome ? `Cliente: ${casa.cliente.nome} - ` : ''}
              Valor atual {fmtBRL(casa.preco_venda)}
            </p>
          </div>
          <button className="neg-drawer-close" onClick={onClose} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="neg-drawer-body">
          {loading ? (
            <div className="neg-empty">Carregando etapas...</div>
          ) : error && etapas.length === 0 ? (
            <div className="neg-empty neg-error">{error}</div>
          ) : etapas.length === 0 && !adding ? (
            <div className="neg-empty">Nenhuma etapa registrada.</div>
          ) : (
            <div className="neg-etapas-list">
              {etapas.map((etapa, index) => (
                <CasaEtapaItem
                  key={etapa.id}
                  etapa={etapa}
                  index={index + 1}
                  isLast={index === etapas.length - 1}
                  displayValue={historicalValueFor(etapas, index, casa.preco_venda)}
                  user={user}
                  isEditing={editingId === etapa.id}
                  editDraft={editDraft}
                  editValueDraft={editValueDraft}
                  editSaving={editSaving}
                  onStartEdit={() => startEdit(etapa)}
                  onEditChange={setEditDraft}
                  onEditValueChange={setEditValueDraft}
                  onEditSave={handleEdit}
                  onEditCancel={() => setEditingId(null)}
                />
              ))}
            </div>
          )}
        </div>

        {canAddEtapa && (
          <div className="neg-drawer-footer">
            {adding ? (
              <div className="neg-new-etapa">
                <div className="neg-new-etapa-label">Nova etapa</div>
                <label className="neg-field">
                  <span>Valor negociado</span>
                  <div className="neg-money-field">
                    <span>R$</span>
                    <input value={newValueDraft} onChange={(e) => setNewValueDraft(e.target.value)} placeholder="0,00" inputMode="decimal" />
                  </div>
                </label>
                <textarea
                  className="neg-textarea"
                  value={newDraft}
                  onChange={(e) => setNewDraft(e.target.value)}
                  placeholder="Descreva a etapa da negociacao..."
                  rows={4}
                  maxLength={4000}
                  autoFocus
                />
                <div className="neg-etapa-footer-row">
                  <span className="neg-char-count">{newDraft.length}/4000</span>
                  {error && <span className="neg-error-inline">{error}</span>}
                  <div className="neg-etapa-actions">
                    <button className="neg-btn neg-btn-ghost" onClick={() => { setAdding(false); setNewDraft(''); setError(''); }} disabled={addSaving}>Cancelar</button>
                    <button className="neg-btn neg-btn-primary" onClick={handleAdd} disabled={addSaving || !newDraft.trim()}>{addSaving ? 'Salvando...' : 'Adicionar'}</button>
                  </div>
                </div>
              </div>
            ) : (
              <button className="neg-add-btn" onClick={() => setAdding(true)}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Nova etapa
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function CasaEtapaItem({
  etapa,
  index,
  isLast,
  displayValue,
  user,
  isEditing,
  editDraft,
  editValueDraft,
  editSaving,
  onStartEdit,
  onEditChange,
  onEditValueChange,
  onEditSave,
  onEditCancel,
}) {
  const canEdit = user && (user.role === 'admin' || user.role === 'gerente' || user.id === etapa.criado_por);
  const date = new Date(etapa.criado_em).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const hasValueChange = etapa.valor_anterior !== null && etapa.valor_anterior !== undefined &&
    etapa.valor_novo !== null && etapa.valor_novo !== undefined &&
    Number(etapa.valor_anterior) !== Number(etapa.valor_novo);

  return (
    <div className="neg-etapa">
      <div className="neg-etapa-timeline">
        <div className="neg-etapa-dot" />
        {!isLast && <div className="neg-etapa-line" />}
      </div>
      <div className="neg-etapa-content">
        <div className="neg-etapa-meta">
          <span className="neg-etapa-num">Etapa {index}</span>
          <span className="neg-etapa-date">{date}</span>
          {etapa.criado_por_nome && <span className="neg-etapa-autor">{etapa.criado_por_nome}</span>}
          {canEdit && !isEditing && (
            <button className="neg-etapa-edit-btn" onClick={onStartEdit}>Editar</button>
          )}
        </div>
        {isEditing ? (
          <div className="neg-etapa-editor">
            <label className="neg-field">
              <span>Valor negociado</span>
              <div className="neg-money-field">
                <span>R$</span>
                <input value={editValueDraft} onChange={(e) => onEditValueChange(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
            </label>
            <textarea className="neg-textarea" value={editDraft} onChange={(e) => onEditChange(e.target.value)} rows={4} maxLength={4000} autoFocus />
            <div className="neg-etapa-footer-row">
              <span className="neg-char-count">{editDraft.length}/4000</span>
              <div className="neg-etapa-actions">
                <button className="neg-btn neg-btn-ghost" onClick={onEditCancel} disabled={editSaving}>Cancelar</button>
                <button className="neg-btn neg-btn-primary" onClick={onEditSave} disabled={editSaving || !editDraft.trim()}>{editSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {hasValueChange ? (
              <div className="neg-value-change">
                <span>{fmtBRL(etapa.valor_anterior)}</span>
                <span>para</span>
                <strong>{fmtBRL(etapa.valor_novo)}</strong>
              </div>
            ) : (
              <div className="neg-value-change">
                <span>Valor</span>
                <strong>{fmtBRL(displayValue)}</strong>
              </div>
            )}
            <p className="neg-etapa-texto">{etapa.descricao}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function CasasPanel({
  casas = [],
  clientes = [],
  user,
  loading,
  onCreate,
  onUpdate,
  onDelete,
  onUpdateStatus,
  onCreateLocacao,
  onSearchClientes,
  onCreateClient,
  onRefresh,
}) {
  const [formCasa, setFormCasa] = useState(null);
  const [statusDialog, setStatusDialog] = useState(null);
  const [locacaoCasa, setLocacaoCasa] = useState(null);
  const [negociacaoCasa, setNegociacaoCasa] = useState(null);
  const [filter, setFilter] = useState('todos');
  const canManage = ['admin', 'gerente'].includes(user?.role);

  const filtered = casas.filter((casa) => {
    if (filter === 'todos') return true;
    if (filter === 'ativos') return casa.ativo !== false;
    return casa.status === filter;
  });

  const stats = casas.reduce((acc, casa) => {
    acc.total += 1;
    acc[casa.status] = (acc[casa.status] || 0) + 1;
    return acc;
  }, { total: 0, disponivel: 0, reservado: 0, vendido: 0, alugado: 0 });

  return (
    <section className="list-page casas-page">
      <header className="list-page-head">
        <div>
          <div className="dash-eyebrow">CASAS</div>
          <h1 className="list-page-title">Casas cadastradas</h1>
          <p className="dash-sub">{filtered.length} de {casas.length} casa{casas.length === 1 ? '' : 's'} exibida{filtered.length === 1 ? '' : 's'}.</p>
        </div>
        <div className="casa-toolbar">
          {['todos', 'disponivel', 'reservado', 'vendido', 'alugado'].map((item) => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item === 'todos' ? 'Todas' : STATUS[item]?.label}
            </button>
          ))}
          {canManage && <button className="qa-btn qa-btn-primary" onClick={() => setFormCasa({})}>+ Nova casa</button>}
        </div>
      </header>
      <div className="rental-metrics" style={{ marginBottom: 20 }}>
        <div className="rental-metric rental-metric-primary"><span>Total</span><strong>{stats.total}</strong><small>casas no estoque</small></div>
        <div className="rental-metric"><span>Disponiveis</span><strong>{stats.disponivel}</strong><small>prontas para negociar</small></div>
        <div className="rental-metric"><span>Vendidas</span><strong>{stats.vendido}</strong><small>fechadas</small></div>
        <div className="rental-metric"><span>Alugadas</span><strong>{stats.alugado}</strong><small>contratos ativos</small></div>
      </div>
      {loading ? (
        <div className="list-empty">Carregando casas...</div>
      ) : filtered.length === 0 ? (
        <div className="list-empty">
          <p>Nenhuma casa encontrada.</p>
          {canManage && <button className="qa-btn qa-btn-primary" onClick={() => setFormCasa({})}>Cadastrar primeira casa</button>}
        </div>
      ) : (
        <div className="casas-grid">
          {filtered.map((casa) => (
            <CasaCard
              key={casa.id}
              casa={casa}
              canManage={canManage}
              user={user}
              onEdit={setFormCasa}
              onDelete={onDelete}
              onStatus={(item, status) => status === 'disponivel' ? onUpdateStatus(item, status) : setStatusDialog({ casa: item, status })}
              onRent={setLocacaoCasa}
              onNegociacao={setNegociacaoCasa}
              onPhotosChanged={onRefresh}
            />
          ))}
        </div>
      )}
      {formCasa && (
        <CasaForm
          initial={formCasa.id ? formCasa : null}
          onCancel={() => setFormCasa(null)}
          onConfirm={async (data) => {
            if (formCasa.id) await onUpdate(formCasa.id, data);
            else await onCreate(data);
            setFormCasa(null);
          }}
        />
      )}
      {statusDialog && (
        statusDialog.status === 'reservado' ? (
          <CasaReservaDialog
            casa={statusDialog.casa}
            clientes={clientes}
            onSearchClientes={onSearchClientes}
            onCreateClient={onCreateClient}
            onCancel={() => setStatusDialog(null)}
            onConfirm={async ({ clienteId, observacao, dataVenda }) => {
              await onUpdateStatus(statusDialog.casa, statusDialog.status, clienteId, observacao, dataVenda);
              setStatusDialog(null);
            }}
          />
        ) : (
          <CasaStatusDialog
            casa={statusDialog.casa}
            status={statusDialog.status}
            clientes={clientes}
            onSearchClientes={onSearchClientes}
            onCancel={() => setStatusDialog(null)}
            onConfirm={async ({ clienteId, observacao, dataVenda }) => {
              await onUpdateStatus(statusDialog.casa, statusDialog.status, clienteId, observacao, dataVenda);
              setStatusDialog(null);
            }}
          />
        )
      )}
      {locacaoCasa && (
        <LocacaoDialog
          apartamento={{ ...locacaoCasa, ap_id: locacaoCasa.codigo || locacaoCasa.nome }}
          clientes={clientes}
          onCancel={() => setLocacaoCasa(null)}
          onConfirm={async (data) => {
            await onCreateLocacao(locacaoCasa, data);
            setLocacaoCasa(null);
          }}
        />
      )}
      {negociacaoCasa && (
        <NegociacaoDrawer
          unitType="casa"
          unitId={negociacaoCasa.id}
          title={negociacaoCasa.codigo || negociacaoCasa.nome}
          currentValue={negociacaoCasa.preco_venda}
          clientName={negociacaoCasa.cliente?.nome}
          linkedByUserId={negociacaoCasa.cliente_vinculado_por}
          user={user}
          onClose={() => setNegociacaoCasa(null)}
          onSaved={async (ultimaEtapa) => {
            if (ultimaEtapa?.valor_novo !== null && ultimaEtapa?.valor_novo !== undefined) {
              setNegociacaoCasa((current) => current ? { ...current, preco_venda: Number(ultimaEtapa.valor_novo) } : current);
            }
            await onRefresh?.();
          }}
        />
      )}
    </section>
  );
}
