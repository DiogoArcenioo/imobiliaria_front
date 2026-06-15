'use client';

import { useEffect, useState } from 'react';
import { getPlanos, assinarPlano } from '../lib/api';
import { fmtBRL } from '../lib/data';

export function PlanosPagina({ currentEmpresa, onAssinar }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(null);
  const [assinando, setAssinando] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    getPlanos()
      .then(setPlanos)
      .catch(() => setErro('Erro ao carregar planos.'))
      .finally(() => setLoading(false));
  }, []);

  const planoAtual = currentEmpresa?.plano_id;

  const handleAssinar = async (plano) => {
    setAssinando(true);
    setErro('');
    try {
      const res = await assinarPlano(plano.id);
      setSucesso(plano);
      setConfirmando(null);
      onAssinar?.(res);
    } catch (err) {
      setErro(err.message || 'Erro ao contratar plano.');
    } finally {
      setAssinando(false);
    }
  };

  if (loading) {
    return (
      <section className="list-page">
        <div className="list-empty">Carregando planos...</div>
      </section>
    );
  }

  return (
    <section className="list-page">
      <header className="list-page-head">
        <div>
          <div className="dash-eyebrow">ASSINATURA</div>
          <h1 className="list-page-title">Planos disponíveis</h1>
          <p className="dash-sub">
            {planoAtual
              ? `Seu plano atual: ${currentEmpresa?.plano?.toUpperCase() || 'Básico'} · vence ${currentEmpresa?.venc_mensalidade ? new Date(currentEmpresa.venc_mensalidade).toLocaleDateString('pt-BR') : '—'}`
              : 'Escolha um plano para continuar usando o sistema.'}
          </p>
        </div>
      </header>

      {sucesso && (
        <div style={{
          margin: '0 0 20px',
          padding: '14px 18px',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 10,
          color: '#15803d',
          fontWeight: 600,
        }}>
          Plano <strong>{sucesso.nome}</strong> contratado com sucesso! Sua assinatura foi ativada.
        </div>
      )}
      {erro && (
        <div style={{
          margin: '0 0 20px',
          padding: '14px 18px',
          background: '#fff0f0',
          border: '1px solid #fca5a5',
          borderRadius: 10,
          color: '#dc2626',
        }}>
          {erro}
        </div>
      )}

      {planos.length === 0 ? (
        <div className="list-empty">Nenhum plano disponível no momento.</div>
      ) : (
        <div className="planos-grid">
          {planos.map((plano) => {
            const isAtual = plano.id === planoAtual;
            return (
              <div
                key={plano.id}
                className={'plano-card' + (plano.destaque ? ' plano-card-destaque' : '') + (isAtual ? ' plano-card-atual' : '')}
                style={{ '--plano-cor': plano.cor || '#3288e0' }}
              >
                {plano.destaque && (
                  <div className="plano-badge-top">RECOMENDADO</div>
                )}
                {isAtual && (
                  <div className="plano-badge-top plano-badge-atual">PLANO ATUAL</div>
                )}

                <div className="plano-nome">{plano.nome}</div>

                <div className="plano-preco">
                  <span className="plano-preco-val">{fmtBRL(plano.preco_mensal)}</span>
                  <span className="plano-preco-per">/mês</span>
                </div>
                {plano.preco_anual > 0 && (
                  <div className="plano-preco-anual">ou {fmtBRL(plano.preco_anual)}/ano</div>
                )}

                {plano.descricao && (
                  <p className="plano-desc">{plano.descricao}</p>
                )}

                <div className="plano-limites">
                  <div className="plano-limite-item">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14v-.8c0-1.9 2.2-3.5 5-3.5s5 1.6 5 3.5V14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    <span>{plano.max_usuarios != null ? `${plano.max_usuarios} usuários` : 'Usuários ilimitados'}</span>
                  </div>
                  <div className="plano-limite-item">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4l4-1 4 1 4-1v11l-4 1-4-1-4 1V4zM6 3v11M10 4v11" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/></svg>
                    <span>{plano.max_loteamentos != null ? `${plano.max_loteamentos} loteamentos` : 'Loteamentos ilimitados'}</span>
                  </div>
                  <div className="plano-limite-item">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1"/><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1"/></svg>
                    <span>{plano.max_predios != null ? `${plano.max_predios} prédios` : 'Prédios ilimitados'}</span>
                  </div>
                </div>

                {plano.recursos?.length > 0 && (
                  <ul className="plano-recursos">
                    {plano.recursos.map((r, i) => (
                      <li key={i}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  className="plano-btn"
                  disabled={isAtual || assinando}
                  onClick={() => setConfirmando(plano)}
                >
                  {isAtual ? 'Plano atual' : 'Assinar agora'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmando && (
        <div className="plano-modal-backdrop" onClick={() => !assinando && setConfirmando(null)}>
          <div className="plano-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Contratar plano</h3>
            <p>
              Você está contratando o plano <strong>{confirmando.nome}</strong> por{' '}
              <strong>{fmtBRL(confirmando.preco_mensal)}/mês</strong>.
            </p>
            {planoAtual && (
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Seu plano atual será substituído por este.
              </p>
            )}
            {erro && (
              <div style={{ color: '#dc2626', fontSize: '0.875rem', margin: '8px 0' }}>{erro}</div>
            )}
            <div className="plano-modal-btns">
              <button
                className="plano-modal-cancel"
                onClick={() => { setConfirmando(null); setErro(''); }}
                disabled={assinando}
              >
                Cancelar
              </button>
              <button
                className="plano-modal-confirm"
                onClick={() => handleAssinar(confirmando)}
                disabled={assinando}
                style={{ background: confirmando.cor || '#3288e0' }}
              >
                {assinando ? 'Processando...' : 'Assinar agora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
