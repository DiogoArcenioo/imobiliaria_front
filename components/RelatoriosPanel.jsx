'use client';

// Painel de Relatórios e Resultados — exclusivo para gerente e admin.
// Aba "Visão geral": resumo executivo (KPIs, evolução mensal, ranking, empreendimentos).
// Aba "Explorar": consulta configurável com filtros, agrupamentos e exportação CSV.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRelatorioGerencial } from '../lib/api';
import { fmtBRL, fmtBRLShort } from '../lib/data';

const PERIODOS = [
  { id: 'mes', label: 'Este mês' },
  { id: 'mes_anterior', label: 'Mês passado' },
  { id: 'trimestre', label: 'Últimos 3 meses' },
  { id: 'ano', label: 'Este ano' },
  { id: '12m', label: '12 meses' },
  { id: 'tudo', label: 'Tudo' },
  { id: 'custom', label: 'Personalizado' },
];

const DATASETS = [
  { id: 'vendas', label: 'Vendas' },
  { id: 'locacoes', label: 'Aluguéis' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'cancelamentos', label: 'Cancelamentos' },
];

const AGRUPAMENTOS = [
  { id: 'nenhum', label: 'Sem agrupamento' },
  { id: 'vendedor', label: 'Por vendedor' },
  { id: 'empreendimento', label: 'Por empreendimento' },
  { id: 'mes', label: 'Por mês' },
];

// Datas "YYYY-MM-DD" precisam ser interpretadas no fuso local (não UTC)
function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtData(value) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

function mesKey(value) {
  const d = parseDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const nome = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
  return `${nome.replace('.', '')}/${String(y).slice(2)}`;
}

function getRange(periodo, customIni, customFim) {
  const now = new Date();
  const inicioDe = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (periodo) {
    case 'mes':
      return { ini: new Date(now.getFullYear(), now.getMonth(), 1), fim: null };
    case 'mes_anterior':
      return {
        ini: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        fim: new Date(now.getFullYear(), now.getMonth(), 1),
      };
    case 'trimestre':
      return { ini: new Date(now.getFullYear(), now.getMonth() - 2, 1), fim: null };
    case 'ano':
      return { ini: new Date(now.getFullYear(), 0, 1), fim: null };
    case '12m':
      return { ini: new Date(now.getFullYear(), now.getMonth() - 11, 1), fim: null };
    case 'custom': {
      const ini = parseDate(customIni);
      const fimDia = parseDate(customFim);
      return {
        ini: ini ? inicioDe(ini) : null,
        fim: fimDia ? new Date(fimDia.getFullYear(), fimDia.getMonth(), fimDia.getDate() + 1) : null,
      };
    }
    default:
      return { ini: null, fim: null };
  }
}

function inRange(value, range) {
  const d = parseDate(value);
  if (!d) return false;
  if (range.ini && d < range.ini) return false;
  if (range.fim && d >= range.fim) return false;
  return true;
}

function exportCsv(filename, headers, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))];
  // BOM para o Excel abrir com acentuação correta
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf({ titulo, periodoLabel, dsLabel, rows, grupos, groupBy, total, valorHeader, dataset }) {
  const fmtV = (v) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const gruposHtml = grupos && grupos.length > 0 ? `
    <h3>Agrupamento por ${
      groupBy === 'vendedor' ? 'Responsável' : groupBy === 'empreendimento' ? 'Empreendimento' : 'Mês'
    }</h3>
    <table>
      <thead><tr>
        <th>${groupBy === 'vendedor' ? 'Responsável' : groupBy === 'empreendimento' ? 'Empreendimento' : 'Mês'}</th>
        <th>Registros</th>
        <th>${valorHeader} total</th>
        <th>Ticket médio</th>
        <th>% do total</th>
      </tr></thead>
      <tbody>${grupos.map((g) => `<tr>
        <td><strong>${esc(groupBy === 'mes' ? mesLabel(g.key) : g.key)}</strong></td>
        <td>${g.qtd}</td>
        <td>${fmtV(g.valor)}</td>
        <td>${fmtV(g.qtd ? g.valor / g.qtd : 0)}</td>
        <td>${total > 0 ? Math.round((g.valor / total) * 100) : 0}%</td>
      </tr>`).join('')}</tbody>
    </table>` : '';

  const rowsHtml = `
    <h3>Detalhamento</h3>
    <table>
      <thead><tr>
        <th>Data</th><th>Unidade</th><th>Empreendimento</th>
        <th>Responsável</th>
        <th>${dataset === 'cancelamentos' ? 'Motivo' : 'Cliente'}</th>
        <th>${valorHeader}</th>
      </tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${esc(fmtData(r.data))}</td>
        <td>${esc(r.codigo)}<br/><small>${esc(r.extra)}</small></td>
        <td>${esc(r.empreendimento)}</td>
        <td>${esc(r.responsavel)}</td>
        <td>${esc(r.cliente)}</td>
        <td>${fmtV(r.valor)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr>
        <td colspan="5"><strong>Total</strong></td>
        <td><strong>${fmtV(total)}</strong></td>
      </tr></tfoot>
    </table>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>${esc(titulo)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px 32px; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 18px; }
    .header h1 { font-size: 18px; color: #1e3a8a; }
    .header p { color: #555; margin-top: 4px; font-size: 11px; }
    h3 { font-size: 12px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;
         letter-spacing: .04em; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { background: #eff6ff; color: #1e3a8a; font-weight: 700; padding: 6px 8px;
         text-align: left; border: 1px solid #dbeafe; white-space: nowrap; }
    td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    tfoot td { background: #eff6ff !important; font-weight: 700; border-top: 2px solid #93c5fd; }
    small { color: #6b7280; font-size: 9.5px; }
    .meta { display: flex; gap: 24px; margin-bottom: 6px; font-size: 11px; color: #374151; }
    .meta span strong { color: #111; }
    @media print {
      @page { margin: 15mm 12mm; size: A4 landscape; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${esc(titulo)}</h1>
    <p>Período: ${esc(periodoLabel)} · Tipo: ${esc(dsLabel)} · Gerado em ${new Date().toLocaleString('pt-BR')}</p>
  </div>
  <div class="meta">
    <span><strong>${rows.length}</strong> ${rows.length === 1 ? 'registro' : 'registros'}</span>
    <span>Total: <strong>${fmtV(total)}</strong></span>
  </div>
  ${gruposHtml}
  ${rowsHtml}
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return; }
  win.document.write(html);
  win.document.close();
}

export function RelatoriosPanel({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('visao');

  // Período global (vale para as duas abas)
  const [periodo, setPeriodo] = useState('mes');
  const [customIni, setCustomIni] = useState('');
  const [customFim, setCustomFim] = useState('');

  // Configuração da aba Explorar
  const [dataset, setDataset] = useState('vendas');
  const [groupBy, setGroupBy] = useState('vendedor');
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroEmpreendimento, setFiltroEmpreendimento] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState(''); // '' | 'lote' | 'apartamento'
  const [busca, setBusca] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getRelatorioGerencial();
      setData(result);
    } catch (err) {
      setError(err.message || 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const range = useMemo(() => getRange(periodo, customIni, customFim), [periodo, customIni, customFim]);

  const calc = useMemo(() => {
    if (!data) return null;
    const vendas = (data.vendas || []).filter((v) => !filtroOrigem || v.origem === filtroOrigem);
    const locacoes = data.locacoes || [];
    const reservas = data.reservas || [];
    const cancelamentos = data.cancelamentos || [];
    const equipe = data.equipe || [];

    const vendasP = vendas.filter((v) => inRange(v.data, range));
    const novasLocacoes = locacoes.filter((l) => inRange(l.data_inicio, range));
    const encerradasP = locacoes.filter((l) => l.encerrado_em && inRange(l.encerrado_em, range));
    const cancelamentosP = cancelamentos.filter((c) => inRange(c.data, range));
    const ativas = locacoes.filter((l) => l.status === 'ativa');

    const faturamentoVendas = vendasP.reduce((s, v) => s + v.valor, 0);
    const receitaMensalAluguel = ativas.reduce((s, l) => s + l.valor_mensal, 0);
    const novosContratosValor = novasLocacoes.reduce((s, l) => s + l.valor_mensal, 0);
    const cancelamentosValor = cancelamentosP.reduce((s, c) => s + (c.valor || 0), 0);

    // ── Ranking da equipe (vendas + aluguéis fechados no período, reservas em aberto) ──
    const porUsuario = new Map();
    const entrada = (id, nome) => {
      const key = id ?? 0;
      if (!porUsuario.has(key)) {
        porUsuario.set(key, {
          id: key,
          nome: nome || equipe.find((u) => u.id === id)?.nome || 'Não informado',
          role: equipe.find((u) => u.id === id)?.role || null,
          vendas_qtd: 0, vendas_valor: 0,
          alugueis_qtd: 0, alugueis_valor: 0,
          reservas_qtd: 0, comissao_valor: 0,
        });
      }
      return porUsuario.get(key);
    };
    for (const u of equipe) {
      if (u.role === 'vendedor' || u.role === 'gerente') entrada(u.id, u.nome);
    }
    for (const v of vendasP) {
      const e = entrada(v.vendedor_id, v.vendedor_nome);
      e.vendas_qtd++;
      e.vendas_valor += v.valor;
      e.comissao_valor += v.valor * ((v.comissao_percentual || 0) / 100);
    }
    for (const l of novasLocacoes) {
      const e = entrada(l.responsavel_id, l.responsavel_nome);
      e.alugueis_qtd++;
      e.alugueis_valor += l.valor_mensal;
    }
    for (const r of reservas) {
      const e = entrada(r.vendedor_id, r.vendedor_nome);
      e.reservas_qtd++;
    }
    const ranking = [...porUsuario.values()].sort(
      (a, b) => (b.vendas_valor - a.vendas_valor) || (b.alugueis_valor - a.alugueis_valor) || (b.reservas_qtd - a.reservas_qtd),
    );

    // ── Faturamento por empreendimento (onde faturou) ──
    const porEmp = new Map();
    const entradaEmp = (key, nome, tipo, local) => {
      if (!porEmp.has(key)) {
        porEmp.set(key, { key, nome, tipo, local, vendas_qtd: 0, vendas_valor: 0, aluguel_mensal: 0, alugueis_qtd: 0 });
      }
      return porEmp.get(key);
    };
    for (const v of vendasP) {
      const local = [v.cidade, v.estado].filter(Boolean).join('/');
      const e = entradaEmp(`${v.empreendimento_tipo}-${v.empreendimento_id}`, v.empreendimento, v.empreendimento_tipo, local);
      e.vendas_qtd++;
      e.vendas_valor += v.valor;
    }
    for (const l of ativas) {
      const e = entradaEmp(`predio-${l.predio_id}`, l.predio, 'predio', '');
      e.aluguel_mensal += l.valor_mensal;
      e.alugueis_qtd++;
    }
    const empreendimentos = [...porEmp.values()].sort(
      (a, b) => (b.vendas_valor - a.vendas_valor) || (b.aluguel_mensal - a.aluguel_mensal),
    );

    // ── Série mensal (últimos 12 meses, independe do período selecionado) ──
    const agora = new Date();
    const serie = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      serie.push({ key, label: mesLabel(key), vendas: 0, aluguel: 0 });
    }
    const serieMap = new Map(serie.map((s) => [s.key, s]));
    for (const v of vendas) {
      const s = serieMap.get(mesKey(v.data));
      if (s) s.vendas += v.valor;
    }
    for (const l of locacoes) {
      const s = serieMap.get(mesKey(l.criado_em));
      if (s) s.aluguel += l.valor_mensal;
    }
    const serieMax = Math.max(1, ...serie.map((s) => s.vendas + s.aluguel));

    return {
      vendasP, novasLocacoes, encerradasP, cancelamentosP, ativas,
      faturamentoVendas, receitaMensalAluguel, novosContratosValor, cancelamentosValor,
      ranking, empreendimentos, serie, serieMax,
    };
  }, [data, range, filtroOrigem]);

  // ── Aba Explorar: linhas filtradas do conjunto selecionado ──
  const explorar = useMemo(() => {
    if (!data || !calc) return null;

    let rows;
    if (dataset === 'vendas') {
      rows = calc.vendasP.map((v) => ({
        data: v.data,
        codigo: `${v.origem === 'lote' ? 'Lote' : 'Apto'} ${v.codigo}`,
        empreendimento: v.empreendimento,
        empKey: `${v.empreendimento_tipo}-${v.empreendimento_id}`,
        responsavel: v.vendedor_nome || 'Não informado',
        responsavelId: v.vendedor_id,
        cliente: v.cliente_nome || '—',
        valor: v.valor,
        extra: v.origem === 'lote' ? 'Venda de lote' : 'Venda de apartamento',
      }));
    } else if (dataset === 'locacoes') {
      rows = calc.novasLocacoes.map((l) => ({
        data: l.data_inicio,
        codigo: `Apto ${l.apartamento_codigo}`,
        empreendimento: l.predio,
        empKey: `predio-${l.predio_id}`,
        responsavel: l.responsavel_nome || 'Não informado',
        responsavelId: l.responsavel_id,
        cliente: l.cliente_nome || '—',
        valor: l.valor_mensal,
        extra: l.status === 'ativa' ? 'Contrato ativo' : `Contrato ${l.status}`,
      }));
    } else if (dataset === 'reservas') {
      rows = (data.reservas || []).map((r) => ({
        data: r.data,
        codigo: `Lote ${r.codigo}`,
        empreendimento: r.empreendimento,
        empKey: `${r.empreendimento_tipo}-${r.empreendimento_id}`,
        responsavel: r.vendedor_nome || 'Não informado',
        responsavelId: r.vendedor_id,
        cliente: r.cliente_nome || '—',
        valor: r.valor,
        extra: 'Reserva em aberto',
      }));
    } else {
      rows = calc.cancelamentosP.map((c) => ({
        data: c.data,
        codigo: c.entidade_codigo || '—',
        empreendimento: c.empreendimento || '—',
        empKey: '',
        responsavel: c.cancelado_por_nome || 'Não informado',
        responsavelId: null,
        cliente: c.motivo || '—',
        valor: c.valor || 0,
        extra: 'Venda cancelada',
      }));
    }

    if (filtroVendedor) rows = rows.filter((r) => String(r.responsavelId ?? '') === filtroVendedor);
    if (filtroEmpreendimento) rows = rows.filter((r) => r.empKey === filtroEmpreendimento);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      rows = rows.filter((r) =>
        [r.codigo, r.empreendimento, r.responsavel, r.cliente].some((s) => (s || '').toLowerCase().includes(q)),
      );
    }
    rows = [...rows].sort((a, b) => (parseDate(b.data)?.getTime() || 0) - (parseDate(a.data)?.getTime() || 0));

    const total = rows.reduce((s, r) => s + r.valor, 0);

    let grupos = null;
    if (groupBy !== 'nenhum') {
      const map = new Map();
      for (const r of rows) {
        const key = groupBy === 'vendedor' ? r.responsavel : groupBy === 'empreendimento' ? r.empreendimento : mesKey(r.data) || '—';
        if (!map.has(key)) map.set(key, { key, qtd: 0, valor: 0 });
        const g = map.get(key);
        g.qtd++;
        g.valor += r.valor;
      }
      grupos = [...map.values()].sort((a, b) => b.valor - a.valor);
      if (groupBy === 'mes') grupos.sort((a, b) => (a.key < b.key ? 1 : -1));
    }

    return { rows, total, grupos };
  }, [data, calc, dataset, groupBy, filtroVendedor, filtroEmpreendimento, busca]);

  const periodoLabel = PERIODOS.find((p) => p.id === periodo)?.label || '';

  const handleExport = () => {
    if (!explorar) return;
    const dsLabel = DATASETS.find((d) => d.id === dataset)?.label || dataset;
    exportCsv(
      `relatorio-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Data', 'Unidade', 'Empreendimento', 'Responsável', dataset === 'cancelamentos' ? 'Motivo' : 'Cliente', 'Valor (R$)', 'Detalhe'],
      explorar.rows.map((r) => [
        fmtData(r.data), r.codigo, r.empreendimento, r.responsavel, r.cliente,
        String(r.valor).replace('.', ','), r.extra,
      ]),
    );
  };

  const handleExportPdf = () => {
    if (!explorar) return;
    const dsLabel = DATASETS.find((d) => d.id === dataset)?.label || dataset;
    const valorHeader = dataset === 'locacoes' ? 'Valor mensal' : 'Valor';
    exportPdf({
      titulo: `Relatório de ${dsLabel}`,
      periodoLabel,
      dsLabel,
      rows: explorar.rows,
      grupos: explorar.grupos,
      groupBy,
      total: explorar.total,
      valorHeader,
      dataset,
    });
  };

  if (loading) {
    return (
      <div className="dash">
        <RelHeader user={user} />
        <div className="list-empty">Carregando indicadores...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash">
        <RelHeader user={user} />
        <div className="list-empty">
          <p>{error}</p>
          <button className="qa-btn qa-btn-primary" onClick={fetchData}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!calc) return null;

  return (
    <div className="dash rel-page">
      <RelHeader user={user} onRefresh={fetchData} />

      <div className="rel-toolbar">
        <div className="rel-tabs">
          <button className={'rel-tab' + (tab === 'visao' ? ' rel-tab-active' : '')} onClick={() => setTab('visao')}>
            Visão geral
          </button>
          <button className={'rel-tab' + (tab === 'explorar' ? ' rel-tab-active' : '')} onClick={() => setTab('explorar')}>
            Explorar dados
          </button>
        </div>

        <div className="rel-period">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              className={'rel-chip' + (periodo === p.id ? ' rel-chip-active' : '')}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </button>
          ))}
          {periodo === 'custom' && (
            <span className="rel-custom-range">
              <input type="date" value={customIni} onChange={(e) => setCustomIni(e.target.value)} />
              <span>até</span>
              <input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} />
            </span>
          )}
        </div>

        {tab === 'visao' && (
          <div className="rel-period" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', alignSelf: 'center' }}>Vendas:</span>
            {[
              { id: '', label: 'Todos' },
              { id: 'lote', label: 'Lotes' },
              { id: 'apartamento', label: 'Apartamentos' },
            ].map((o) => (
              <button
                key={o.id}
                className={'rel-chip' + (filtroOrigem === o.id ? ' rel-chip-active' : '')}
                onClick={() => setFiltroOrigem(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'visao' ? (
        <VisaoGeral calc={calc} data={data} periodoLabel={periodoLabel} filtroOrigem={filtroOrigem} />
      ) : (
        <Explorar
          data={data}
          calc={calc}
          explorar={explorar}
          dataset={dataset}
          setDataset={setDataset}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          filtroVendedor={filtroVendedor}
          setFiltroVendedor={setFiltroVendedor}
          filtroEmpreendimento={filtroEmpreendimento}
          setFiltroEmpreendimento={setFiltroEmpreendimento}
          filtroOrigem={filtroOrigem}
          setFiltroOrigem={setFiltroOrigem}
          busca={busca}
          setBusca={setBusca}
          onExport={handleExport}
          onExportPdf={handleExportPdf}
          periodoLabel={periodoLabel}
        />
      )}
    </div>
  );
}

function RelHeader({ user, onRefresh }) {
  return (
    <header className="dash-header">
      <div>
        <div className="dash-eyebrow">INTELIGÊNCIA DO NEGÓCIO</div>
        <h1 className="dash-title">Resultados &amp; Relatórios</h1>
        <p className="dash-sub">
          Faturamento, desempenho da equipe e indicadores de vendas e aluguéis em um só lugar.
        </p>
      </div>
      {onRefresh && (
        <div className="dash-quick">
          <button className="sec-tool-btn" onClick={onRefresh} title="Atualizar dados">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76L14 2v4h-4l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Atualizar
          </button>
        </div>
      )}
    </header>
  );
}

// ════════════════════════════ Aba: Visão geral ════════════════════════════

function VisaoGeral({ calc, data, periodoLabel, filtroOrigem }) {
  const origemLabel = filtroOrigem === 'lote' ? ' · Lotes' : filtroOrigem === 'apartamento' ? ' · Apartamentos' : '';
  const estoque = data.estoque || { lotes: {}, apartamentos: {} };
  const ticketMedio = calc.vendasP.length ? calc.faturamentoVendas / calc.vendasP.length : 0;

  return (
    <>
      <section className="metric-grid rel-metric-grid">
        <div className="metric-card metric-card-big">
          <div className="mc-top">
            <span className="mc-label">Faturamento em vendas{origemLabel}</span>
            <span className="mc-delta" style={{ color: 'var(--accent)' }}>{periodoLabel}</span>
          </div>
          <div className="mc-value">{fmtBRLShort(calc.faturamentoVendas)}</div>
          <div className="mc-sub">{calc.vendasP.length} {calc.vendasP.length === 1 ? 'venda' : 'vendas'} · ticket médio {fmtBRLShort(ticketMedio)}</div>
          <div className="mc-rail" style={{ background: 'var(--accent)' }} />
        </div>

        <div className="metric-card">
          <div className="mc-top">
            <span className="mc-label">Receita mensal de aluguéis</span>
            <span className="mc-delta" style={{ color: '#8b5cf6' }}>{calc.ativas.length} ativos</span>
          </div>
          <div className="mc-value">{fmtBRLShort(calc.receitaMensalAluguel)}</div>
          <div className="mc-sub">contratos vigentes hoje</div>
          <div className="mc-rail" style={{ background: '#8b5cf6' }} />
        </div>

        <div className="metric-card">
          <div className="mc-top">
            <span className="mc-label">Novos contratos de aluguel</span>
            <span className="mc-delta" style={{ color: '#8b5cf6' }}>{periodoLabel}</span>
          </div>
          <div className="mc-value">{calc.novasLocacoes.length}</div>
          <div className="mc-sub">{fmtBRLShort(calc.novosContratosValor)}/mês adicionados · {calc.encerradasP.length} encerrados</div>
          <div className="mc-rail" style={{ background: '#8b5cf6' }} />
        </div>

        <div className="metric-card">
          <div className="mc-top">
            <span className="mc-label">Estoque disponível</span>
            <span className="mc-delta" style={{ color: 'var(--blue)' }}>
              {(estoque.lotes.disponiveis || 0) + (estoque.apartamentos.disponiveis || 0)} unid.
            </span>
          </div>
          <div className="mc-value">{fmtBRLShort(estoque.lotes.vgv_disponivel || 0)}</div>
          <div className="mc-sub">{estoque.lotes.disponiveis || 0} lotes · {estoque.apartamentos.disponiveis || 0} apartamentos à venda</div>
          <div className="mc-rail" style={{ background: 'var(--blue)' }} />
        </div>

        <div className="metric-card">
          <div className="mc-top">
            <span className="mc-label">Cancelamentos</span>
            <span className="mc-delta" style={{ color: 'var(--red)' }}>{periodoLabel}</span>
          </div>
          <div className="mc-value">{calc.cancelamentosP.length}</div>
          <div className="mc-sub">{fmtBRLShort(calc.cancelamentosValor)} em vendas desfeitas</div>
          <div className="mc-rail" style={{ background: 'var(--red)' }} />
        </div>
      </section>

      <section className="rel-card">
        <header className="sec-header">
          <h2 className="sec-title">Evolução do faturamento</h2>
          <div className="rel-legend">
            <span><i style={{ background: 'var(--accent)' }} /> Vendas</span>
            <span><i style={{ background: '#8b5cf6' }} /> Novos aluguéis (valor mensal)</span>
          </div>
        </header>
        <div className="rel-chart">
          {calc.serie.map((m) => {
            const total = m.vendas + m.aluguel;
            return (
              <div className="rel-chart-col" key={m.key} title={`${m.label}: ${fmtBRL(m.vendas)} em vendas · ${fmtBRL(m.aluguel)} em novos aluguéis`}>
                <div className="rel-chart-value">{total > 0 ? fmtBRLShort(total) : ''}</div>
                <div className="rel-chart-bars">
                  <div className="rel-bar rel-bar-aluguel" style={{ height: `${(m.aluguel / calc.serieMax) * 100}%` }} />
                  <div className="rel-bar rel-bar-vendas" style={{ height: `${(m.vendas / calc.serieMax) * 100}%` }} />
                </div>
                <span className="rel-chart-label">{m.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="rel-split">
        <section className="rel-card">
          <header className="sec-header">
            <h2 className="sec-title">Resultado da equipe</h2>
            <span className="rel-card-note">{periodoLabel}</span>
          </header>
          {calc.ranking.length === 0 ? (
            <p className="rel-empty">Nenhum vendedor ou gerente cadastrado.</p>
          ) : (
            <div className="rel-rank">
              {calc.ranking.map((v, i) => {
                const maxValor = Math.max(1, calc.ranking[0]?.vendas_valor || 0);
                return (
                  <div className="rel-rank-row" key={v.id}>
                    <div className="rel-rank-pos">{i + 1}º</div>
                    <div className="rel-rank-body">
                      <div className="rel-rank-head">
                        <span className="rel-rank-nome">
                          {v.nome}
                          {v.role && <em className="rel-rank-role">{v.role === 'gerente' ? 'Gerente' : 'Vendedor'}</em>}
                        </span>
                        <b>{fmtBRLShort(v.vendas_valor)}</b>
                      </div>
                      <div className="rel-rank-bar">
                        <div style={{ width: `${Math.max(2, (v.vendas_valor / maxValor) * 100)}%` }} />
                      </div>
                      <div className="rel-rank-meta">
                        {v.vendas_qtd} {v.vendas_qtd === 1 ? 'venda' : 'vendas'}
                        {' · '}{v.alugueis_qtd} {v.alugueis_qtd === 1 ? 'aluguel' : 'aluguéis'}
                        {v.alugueis_valor > 0 ? ` (${fmtBRLShort(v.alugueis_valor)}/mês)` : ''}
                        {' · '}{v.reservas_qtd} {v.reservas_qtd === 1 ? 'reserva' : 'reservas'}
                        {v.comissao_valor > 0 && (
                          <span style={{ marginLeft: 6, color: '#15803d', fontWeight: 700 }}>
                            · comissão {fmtBRLShort(v.comissao_valor)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rel-card">
          <header className="sec-header">
            <h2 className="sec-title">Onde o dinheiro entrou</h2>
            <span className="rel-card-note">{periodoLabel}</span>
          </header>
          {calc.empreendimentos.length === 0 ? (
            <p className="rel-empty">Nenhum faturamento registrado no período.</p>
          ) : (
            <div className="rel-emp-list">
              {calc.empreendimentos.map((e) => {
                const share = calc.faturamentoVendas > 0 ? Math.round((e.vendas_valor / calc.faturamentoVendas) * 100) : 0;
                return (
                  <div className="rel-emp-row" key={e.key}>
                    <div className="rel-emp-head">
                      <span className="rel-emp-nome">
                        {e.nome}
                        <em>{e.tipo === 'predio' ? 'Prédio' : 'Loteamento'}{e.local ? ` · ${e.local}` : ''}</em>
                      </span>
                      <b>{fmtBRLShort(e.vendas_valor)}</b>
                    </div>
                    <div className="rel-emp-bar">
                      <div style={{ width: `${Math.max(2, share)}%` }} />
                    </div>
                    <div className="rel-emp-meta">
                      {e.vendas_qtd > 0 && <span>{e.vendas_qtd} {e.vendas_qtd === 1 ? 'venda' : 'vendas'} ({share}% do total)</span>}
                      {e.aluguel_mensal > 0 && <span>{fmtBRLShort(e.aluguel_mensal)}/mês em {e.alugueis_qtd} {e.alugueis_qtd === 1 ? 'aluguel' : 'aluguéis'}</span>}
                      {e.vendas_qtd === 0 && e.aluguel_mensal === 0 && <span>Sem movimento no período</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rel-card">
        <header className="sec-header">
          <h2 className="sec-title">Situação do estoque</h2>
          <span className="rel-card-note">posição atual</span>
        </header>
        <div className="rel-estoque">
          <EstoqueLinha
            titulo="Lotes"
            total={estoque.lotes.total || 0}
            segmentos={[
              { label: 'vendidos', valor: estoque.lotes.vendidos || 0, cor: '#ef4444' },
              { label: 'reservados', valor: estoque.lotes.reservados || 0, cor: '#f59e0b' },
              { label: 'disponíveis', valor: estoque.lotes.disponiveis || 0, cor: '#22c55e' },
            ]}
            extra={`VGV total ${fmtBRLShort(estoque.lotes.vgv_total || 0)} · vendido ${fmtBRLShort(estoque.lotes.vgv_vendido || 0)} · em estoque ${fmtBRLShort(estoque.lotes.vgv_disponivel || 0)}`}
          />
          <EstoqueLinha
            titulo="Apartamentos"
            total={estoque.apartamentos.total || 0}
            segmentos={[
              { label: 'vendidos', valor: estoque.apartamentos.vendidos || 0, cor: '#ef4444' },
              { label: 'alugados', valor: estoque.apartamentos.alugados || 0, cor: '#8b5cf6' },
              { label: 'reservados', valor: estoque.apartamentos.reservados || 0, cor: '#f59e0b' },
              { label: 'disponíveis', valor: estoque.apartamentos.disponiveis || 0, cor: '#22c55e' },
            ]}
            extra={`Valor de venda ${fmtBRLShort(estoque.apartamentos.vgv_total || 0)} · vendido ${fmtBRLShort(estoque.apartamentos.vgv_vendido || 0)}`}
          />
        </div>
      </section>
    </>
  );
}

function EstoqueLinha({ titulo, total, segmentos, extra }) {
  return (
    <div className="rel-estoque-row">
      <div className="rel-estoque-head">
        <span className="rel-estoque-titulo">{titulo}</span>
        <span className="rel-estoque-total">{total} unidades</span>
      </div>
      {total > 0 ? (
        <>
          <div className="rel-estoque-bar">
            {segmentos.filter((s) => s.valor > 0).map((s) => (
              <div key={s.label} style={{ flex: s.valor, background: s.cor }} title={`${s.valor} ${s.label}`} />
            ))}
          </div>
          <div className="rel-estoque-legend">
            {segmentos.map((s) => (
              <span key={s.label}><i style={{ background: s.cor }} /> {s.valor} {s.label}</span>
            ))}
          </div>
          <div className="rel-estoque-extra">{extra}</div>
        </>
      ) : (
        <div className="rel-estoque-extra">Nenhuma unidade cadastrada.</div>
      )}
    </div>
  );
}

// ════════════════════════════ Aba: Explorar ════════════════════════════

function Explorar({
  data, explorar, dataset, setDataset, groupBy, setGroupBy,
  filtroVendedor, setFiltroVendedor, filtroEmpreendimento, setFiltroEmpreendimento,
  filtroOrigem, setFiltroOrigem, busca, setBusca, onExport, onExportPdf, periodoLabel,
}) {
  const [showFiltrosModal, setShowFiltrosModal] = useState(false);
  const equipe = (data.equipe || []).filter((u) => u.role === 'vendedor' || u.role === 'gerente');

  const empOptions = useMemo(() => {
    const map = new Map();
    for (const v of data.vendas || []) map.set(`${v.empreendimento_tipo}-${v.empreendimento_id}`, v.empreendimento);
    for (const r of data.reservas || []) map.set(`${r.empreendimento_tipo}-${r.empreendimento_id}`, r.empreendimento);
    for (const l of data.locacoes || []) map.set(`predio-${l.predio_id}`, l.predio);
    return [...map.entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || '', 'pt-BR'));
  }, [data]);

  const valorHeader = dataset === 'locacoes' ? 'Valor mensal' : 'Valor';

  const activeFilters = [
    dataset !== 'vendas',
    filtroOrigem !== '',
    groupBy !== 'vendedor',
    !!filtroVendedor,
    !!filtroEmpreendimento,
    !!busca,
  ].filter(Boolean).length;

  function clearFilters() {
    setDataset('vendas');
    setFiltroOrigem('');
    setGroupBy('vendedor');
    setFiltroVendedor('');
    setFiltroEmpreendimento('');
    setBusca('');
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <button
          onClick={() => setShowFiltrosModal(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Filtros
          {activeFilters > 0 && (
            <span style={{
              background: '#3b82f6', color: '#fff', borderRadius: 99,
              fontSize: 11, fontWeight: 700, padding: '1px 6px', lineHeight: '1.6',
            }}>
              {activeFilters}
            </span>
          )}
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="qa-btn rel-export" onClick={onExport} disabled={!explorar?.rows.length}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            title="Baixar planilha CSV">
            Exportar CSV
          </button>
          <button className="qa-btn qa-btn-primary rel-export" onClick={onExportPdf} disabled={!explorar?.rows.length}
            title="Abrir relatório formatado para salvar como PDF">
            Exportar PDF
          </button>
        </div>
      </div>

      {explorar && (
        <>
          <div className="rel-result-line">
            <b>{explorar.rows.length}</b> {explorar.rows.length === 1 ? 'registro' : 'registros'} no período "{periodoLabel}"
            {dataset === 'vendas' && filtroOrigem && <span> · {filtroOrigem === 'lote' ? 'apenas lotes' : 'apenas apartamentos'}</span>}
            {' · '}total <b>{fmtBRL(explorar.total)}</b>
            {dataset === 'locacoes' ? ' em valor mensal contratado' : ''}
          </div>

          {explorar.grupos && explorar.grupos.length > 0 && (
            <section className="rel-card">
              <table className="lot-table rel-table">
                <thead>
                  <tr>
                    <th>{groupBy === 'vendedor' ? 'Responsável' : groupBy === 'empreendimento' ? 'Empreendimento' : 'Mês'}</th>
                    <th>Registros</th>
                    <th>{valorHeader} total</th>
                    <th>Ticket médio</th>
                    <th>% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {explorar.grupos.map((g) => (
                    <tr key={g.key}>
                      <td><b>{groupBy === 'mes' ? mesLabel(g.key) : g.key}</b></td>
                      <td>{g.qtd}</td>
                      <td>{fmtBRL(g.valor)}</td>
                      <td>{fmtBRL(g.qtd ? g.valor / g.qtd : 0)}</td>
                      <td>{explorar.total > 0 ? Math.round((g.valor / explorar.total) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="rel-card">
            {explorar.rows.length === 0 ? (
              <p className="rel-empty">Nenhum registro encontrado com os filtros atuais.</p>
            ) : (
              <table className="lot-table rel-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Unidade</th>
                    <th>Empreendimento</th>
                    <th>Responsável</th>
                    <th>{dataset === 'cancelamentos' ? 'Motivo' : 'Cliente'}</th>
                    <th>{valorHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {explorar.rows.map((r, i) => (
                    <tr key={i}>
                      <td>{fmtData(r.data)}</td>
                      <td><b className="lot-code">{r.codigo}</b><div className="table-sub">{r.extra}</div></td>
                      <td>{r.empreendimento}</td>
                      <td>{r.responsavel}</td>
                      <td>{r.cliente}</td>
                      <td>{fmtBRL(r.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {showFiltrosModal && (
        <div className="sale-modal-backdrop" onClick={() => setShowFiltrosModal(false)}>
          <section className="sale-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <header className="sale-modal-head">
              <div>
                <div className="dash-eyebrow">EXPLORAR DADOS</div>
                <h2>Filtros</h2>
                <p>Configure o que analisar e como agrupar os dados.</p>
              </div>
              <button className="sale-modal-close" onClick={() => setShowFiltrosModal(false)} aria-label="Fechar">
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="rel-config-field">
                <span>O que analisar</span>
                <div className="rel-seg">
                  {DATASETS.map((d) => (
                    <button key={d.id} className={'rel-seg-btn' + (dataset === d.id ? ' rel-seg-btn-active' : '')} onClick={() => setDataset(d.id)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {dataset === 'vendas' && (
                <div className="rel-config-field">
                  <span>Tipo de venda</span>
                  <div className="rel-seg">
                    {[{ id: '', label: 'Todos' }, { id: 'lote', label: 'Lotes' }, { id: 'apartamento', label: 'Apartamentos' }].map((o) => (
                      <button key={o.id} className={'rel-seg-btn' + (filtroOrigem === o.id ? ' rel-seg-btn-active' : '')} onClick={() => setFiltroOrigem(o.id)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rel-config-field">
                <span>Agrupar por</span>
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                  {AGRUPAMENTOS.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>

              <div className="rel-config-field">
                <span>Responsável</span>
                <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}>
                  <option value="">Todos</option>
                  {equipe.map((u) => (
                    <option key={u.id} value={String(u.id)}>{u.nome}</option>
                  ))}
                </select>
              </div>

              <div className="rel-config-field">
                <span>Empreendimento</span>
                <select value={filtroEmpreendimento} onChange={(e) => setFiltroEmpreendimento(e.target.value)}>
                  <option value="">Todos</option>
                  {empOptions.map(([key, nome]) => (
                    <option key={key} value={key}>{nome}</option>
                  ))}
                </select>
              </div>

              <div className="rel-config-field rel-config-busca">
                <span>Buscar</span>
                <input
                  placeholder="Unidade, cliente, vendedor..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <footer className="sale-modal-actions">
              {activeFilters > 0 && (
                <button className="qa-btn" onClick={clearFilters} style={{ color: 'var(--text-muted)' }}>
                  Limpar filtros
                </button>
              )}
              <button className="qa-btn qa-btn-primary" onClick={() => setShowFiltrosModal(false)}>
                Aplicar
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
