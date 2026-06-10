'use client';

import { useMemo, useState } from 'react';
import { fmtBRL } from '../lib/data';
import { formatCpfCnpj } from './ClienteManagement';

function clientLabel(client) {
  return `${client.nome} — ${formatCpfCnpj(client.cpf_cnpj)}`;
}

function dateBR(value) {
  if (!value) return 'Sem prazo';
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}

export function LocacaoDialog({ apartamento, clientes, onConfirm, onCancel }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [valorMensal, setValorMensal] = useState(Number(apartamento?.preco_aluguel) || '');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState('');
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [caucao, setCaucao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clientes.slice(0, 8);
    return clientes.filter((client) =>
      [client.nome, client.cpf_cnpj].filter(Boolean).some((value) =>
        String(value).toLowerCase().includes(normalized)
      )
    ).slice(0, 8);
  }, [clientes, query]);

  const handleSubmit = async () => {
    if (!selected || !Number(valorMensal) || !dataInicio) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        cliente_id: selected.id,
        valor_mensal: Number(valorMensal),
        data_inicio: dataInicio,
        data_fim: dataFim || undefined,
        dia_vencimento: Number(diaVencimento),
        caucao: caucao === '' ? undefined : Number(caucao),
        observacao: observacao || undefined,
      });
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a locação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay ap-status-modal-overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal-box rental-modal" role="dialog" aria-modal="true">
        <div className="rental-modal-head">
          <div>
            <div className="dash-eyebrow">NOVA LOCAÇÃO</div>
            <h3>Alugar apartamento {apartamento?.ap_id}</h3>
            <p>Cadastre os dados financeiros e o período do contrato.</p>
          </div>
          <button className="apc-close" onClick={onCancel} aria-label="Fechar">×</button>
        </div>

        <div className="modal-body rental-form">
          <label className="field-label rental-client-field">
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
            {options.length === 0 ? (
              <div className="sale-client-empty">Nenhum cliente encontrado.</div>
            ) : options.map((client) => (
              <button
                key={client.id}
                className={'sale-client-option' + (selected?.id === client.id ? ' sale-client-option-active' : '')}
                onClick={() => { setSelected(client); setQuery(clientLabel(client)); }}
              >
                <span><b>{client.nome}</b><small>{formatCpfCnpj(client.cpf_cnpj)}</small></span>
              </button>
            ))}
          </div>

          <div className="rental-form-grid">
            <label className="field-label">
              Valor mensal
              <input className="field-input" type="number" min="0.01" step="100" value={valorMensal}
                onChange={(event) => setValorMensal(event.target.value)} placeholder="R$ 0,00" />
            </label>
            <label className="field-label">
              Dia do vencimento
              <input className="field-input" type="number" min="1" max="31" value={diaVencimento}
                onChange={(event) => setDiaVencimento(event.target.value)} />
            </label>
            <label className="field-label">
              Início do contrato
              <input className="field-input" type="date" value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)} />
            </label>
            <label className="field-label">
              Término opcional
              <input className="field-input" type="date" min={dataInicio} value={dataFim}
                onChange={(event) => setDataFim(event.target.value)} />
            </label>
            <label className="field-label">
              Caução
              <input className="field-input" type="number" min="0" step="100" value={caucao}
                onChange={(event) => setCaucao(event.target.value)} placeholder="R$ 0,00" />
            </label>
          </div>

          <label className="field-label">
            Observação
            <textarea className="field-input" rows={3} value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              placeholder="Reajuste, garantias, condições especiais..." />
          </label>
          {error && <div className="rental-form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="ap-modal-btn ap-modal-btn-secondary" onClick={onCancel}>Cancelar</button>
          <button
            className="ap-modal-btn ap-modal-btn-primary"
            disabled={!selected || !Number(valorMensal) || !dataInicio || saving}
            onClick={handleSubmit}
          >
            {saving ? 'Registrando...' : 'Iniciar locação'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RentalTable({ title, rows, active, canManage, onEnd }) {
  return (
    <section className="rental-table-card">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{rows.length} contrato{rows.length === 1 ? '' : 's'}</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="rental-empty">Nenhuma locação nesta categoria.</div>
      ) : (
        <div className="rental-table-wrap">
          <table className="rental-table">
            <thead>
              <tr>
                <th>Apartamento</th>
                <th>Cliente</th>
                <th>Valor mensal</th>
                <th>Período</th>
                <th>Vencimento</th>
                {active && canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((rental) => (
                <tr key={rental.id}>
                  <td>
                    <b>{rental.apartamento_codigo}</b>
                    <small>{[rental.predio?.nome, rental.andar?.numero ? `${rental.andar.numero}º andar` : null].filter(Boolean).join(' · ')}</small>
                  </td>
                  <td><b>{rental.cliente?.nome || '—'}</b><small>{formatCpfCnpj(rental.cliente?.cpf_cnpj)}</small></td>
                  <td className="rental-money">{fmtBRL(rental.valor_mensal)}</td>
                  <td>{dateBR(rental.data_inicio)}<small>até {dateBR(rental.data_fim)}</small></td>
                  <td>Dia {rental.dia_vencimento}</td>
                  {active && canManage && (
                    <td><button className="rental-end-btn" onClick={() => onEnd(rental)}>Encerrar</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function LocacoesPanel({ locacoes, resumo, loading, user, onEnd }) {
  const active = locacoes.filter((item) => item.status === 'ativa');
  const history = locacoes.filter((item) => item.status !== 'ativa');
  const canManage = ['admin', 'gerente'].includes(user?.role);

  if (loading) return <div className="rental-loading">Carregando locações...</div>;

  return (
    <div className="rentals-page">
      <div className="rental-metrics">
        <div className="rental-metric rental-metric-primary"><span>Receita mensal</span><strong>{fmtBRL(resumo.receita_mensal || 0)}</strong><small>contratos ativos</small></div>
        <div className="rental-metric"><span>Apartamentos alugados</span><strong>{resumo.total_ativas || 0}</strong><small>{resumo.ocupacao_percentual || 0}% de ocupação</small></div>
        <div className="rental-metric"><span>Ticket médio</span><strong>{fmtBRL(resumo.ticket_medio || 0)}</strong><small>por apartamento</small></div>
        <div className="rental-metric"><span>Unidades vagas</span><strong>{resumo.unidades_vagas || 0}</strong><small>de {resumo.unidades_locaveis || 0} locáveis</small></div>
      </div>
      <RentalTable title="Locações ativas" rows={active} active canManage={canManage} onEnd={onEnd} />
      <RentalTable title="Histórico de locações" rows={history} canManage={canManage} onEnd={onEnd} />
    </div>
  );
}
