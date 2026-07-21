'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createAgendaItem, deleteAgendaItem, getAgendaItems, updateAgendaItem } from '../lib/api';

const TIPO_LABEL = {
  tarefa: 'Tarefa',
  visita: 'Visita',
  atendimento: 'Atendimento',
};

const TIPO_COLOR = {
  tarefa: '#3288e0',
  visita: '#16a34a',
  atendimento: '#8b5cf6',
};

const STATUS_LABEL = {
  pendente: 'Pendente',
  concluido: 'Concluido',
  cancelado: 'Cancelado',
};

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthRange(date) {
  const start = monthStart(date);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateTimeBR(value) {
  if (!value) return 'Sem horario';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function userLabel(user, fallback = 'Usuario') {
  return user?.nome || user?.login || user?.email || fallback;
}

function AgendaForm({ user, usuarios, scopeUserId, selectedDate, editingItem, onSaved, onCancel }) {
  const canChooseUser = user?.role === 'admin' || user?.role === 'gerente';
  const defaultStart = useMemo(() => {
    const base = selectedDate ? new Date(`${selectedDate}T09:00:00`) : new Date();
    return toDateTimeLocal(base);
  }, [selectedDate]);

  const [tipo, setTipo] = useState(editingItem?.tipo || 'tarefa');
  const [titulo, setTitulo] = useState(editingItem?.titulo || '');
  const [descricao, setDescricao] = useState(editingItem?.descricao || '');
  const [dataInicio, setDataInicio] = useState(editingItem ? toDateTimeLocal(editingItem.data_inicio) : defaultStart);
  const [dataFim, setDataFim] = useState(editingItem?.data_fim ? toDateTimeLocal(editingItem.data_fim) : '');
  const [local, setLocal] = useState(editingItem?.local || '');
  const [status, setStatus] = useState(editingItem?.status || 'pendente');
  const [usuarioId, setUsuarioId] = useState(String(editingItem?.usuario_id || scopeUserId || user?.id || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = titulo.trim() && dataInicio && usuarioId;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        data_inicio: new Date(dataInicio).toISOString(),
        data_fim: dataFim ? new Date(dataFim).toISOString() : undefined,
        local: local.trim() || undefined,
      };
      if (canChooseUser) payload.usuario_id = Number(usuarioId);
      if (editingItem) payload.status = status;

      const saved = editingItem
        ? await updateAgendaItem(editingItem.id, payload)
        : await createAgendaItem(payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Nao foi possivel salvar o item da agenda.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rental-table-card agenda-form-card">
      <header>
        <div>
          <h3>{editingItem ? 'Editar agenda' : 'Novo compromisso'}</h3>
          <p>{editingItem ? 'Atualize os dados do compromisso.' : 'Cadastre tarefa, visita ou atendimento.'}</p>
        </div>
      </header>
      <div className="agenda-form-body">
        {canChooseUser && (
          <label className="field-label">
            Agenda de
            <select className="field-input" value={usuarioId} onChange={(event) => setUsuarioId(event.target.value)}>
              {usuarios.map((item) => (
                <option key={item.id} value={item.id}>{userLabel(item)}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field-label">
          Tipo
          <select className="field-input" value={tipo} onChange={(event) => setTipo(event.target.value)}>
            <option value="tarefa">Tarefa</option>
            <option value="visita">Visita</option>
            <option value="atendimento">Atendimento</option>
          </select>
        </label>
        <label className="field-label">
          Titulo
          <input className="field-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex: Visita ao cliente Ronaldo" />
        </label>
        <div className="agenda-form-dates">
          <label className="field-label">
            Inicio
            <input className="field-input" type="datetime-local" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} />
          </label>
          <label className="field-label">
            Fim
            <input className="field-input" type="datetime-local" value={dataFim} min={dataInicio || undefined} onChange={(event) => setDataFim(event.target.value)} />
          </label>
        </div>
        <label className="field-label">
          Local
          <input className="field-input" value={local} onChange={(event) => setLocal(event.target.value)} placeholder="Endereco, loteamento, predio..." />
        </label>
        <label className="field-label">
          Observacoes
          <textarea className="field-input" rows={3} value={descricao} onChange={(event) => setDescricao(event.target.value)} />
        </label>
        {editingItem && (
          <label className="field-label">
            Status
            <select className="field-input" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="pendente">Pendente</option>
              <option value="concluido">Concluido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
        )}
        {error && <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>}
        <div className="agenda-form-actions">
          {editingItem && <button className="table-action table-action-ghost" type="button" onClick={onCancel}>Cancelar</button>}
          <button className="table-action" type="button" disabled={!canSubmit || saving} onClick={handleSubmit}>
            {saving ? 'Salvando...' : editingItem ? 'Salvar alteracoes' : 'Adicionar agenda'}
          </button>
        </div>
      </div>
    </section>
  );
}

export function AgendaPanel({ user, usuarios = [], onToast }) {
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('minha');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  const canChooseScope = user?.role === 'admin' || user?.role === 'gerente';
  const people = useMemo(() => {
    const map = new Map();
    if (user?.id) map.set(user.id, user);
    usuarios
      .filter((item) => item?.ativo !== false && item.role !== 'admin')
      .forEach((item) => map.set(item.id, item));
    return [...map.values()].sort((a, b) => userLabel(a).localeCompare(userLabel(b), 'pt-BR'));
  }, [usuarios, user]);

  const effectiveUserId = canChooseScope && scope === 'usuario' ? selectedUserId : '';

  const loadItems = useCallback(async () => {
    const { start, end } = monthRange(month);
    setLoading(true);
    setError('');
    try {
      const data = await getAgendaItems({
        inicio: start.toISOString(),
        fim: end.toISOString(),
        escopo: canChooseScope ? scope : 'minha',
        usuarioId: effectiveUserId || undefined,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }, [month, scope, effectiveUserId, canChooseScope]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const days = useMemo(() => {
    const start = monthStart(month);
    const first = new Date(start);
    first.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, [month]);

  const itemsByDate = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = isoDate(new Date(item.data_inicio));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [items]);

  const selectedItems = itemsByDate.get(selectedDate) || [];
  const today = isoDate(new Date());
  const title = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const currentScopeUserId = canChooseScope && scope === 'usuario'
    ? Number(selectedUserId || user?.id)
    : user?.id;

  async function handleDelete(item) {
    if (!window.confirm('Remover este item da agenda?')) return;
    await deleteAgendaItem(item.id);
    setEditingItem(null);
    onToast?.('Item removido da agenda');
    loadItems();
  }

  function handleSaved() {
    setEditingItem(null);
    onToast?.('Agenda salva');
    loadItems();
  }

  return (
    <section className="list-page agenda-page">
      <header className="list-page-head">
        <div>
          <div className="dash-eyebrow">AGENDA</div>
          <h1 className="list-page-title">Agenda comercial</h1>
          <p className="dash-sub">Organize tarefas, visitas e atendimentos do dia.</p>
        </div>
      </header>

      {canChooseScope && (
        <section className="rental-table-card" style={{ marginBottom: 18 }}>
          <div className="agenda-scope-controls">
            <label className="field-label">
              Visualizacao
              <select className="field-input" value={scope} onChange={(event) => setScope(event.target.value)}>
                <option value="minha">Minha agenda</option>
                <option value="todos">Todos</option>
                <option value="usuario">Usuario especifico</option>
              </select>
            </label>
            <label className="field-label">
              Usuario
              <select
                className="field-input"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                disabled={scope !== 'usuario'}
              >
                <option value="">Selecione</option>
                {people.map((item) => (
                  <option key={item.id} value={item.id}>{userLabel(item)}</option>
                ))}
              </select>
            </label>
            <button className="table-action table-action-ghost" type="button" onClick={loadItems}>
              Atualizar
            </button>
          </div>
        </section>
      )}

      <div className="agenda-layout">
        <div className="agenda-main-column">
          <section className="rental-table-card">
            <header>
              <div>
                <h3 style={{ textTransform: 'capitalize' }}>{title}</h3>
                <p>{loading ? 'Carregando agenda...' : `${items.length} item${items.length === 1 ? '' : 's'} no mes`}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="table-action table-action-ghost" type="button" onClick={() => setMonth((current) => addMonths(current, -1))}>Anterior</button>
                <button className="table-action table-action-ghost" type="button" onClick={() => { const now = new Date(); setMonth(monthStart(now)); setSelectedDate(isoDate(now)); }}>Hoje</button>
                <button className="table-action table-action-ghost" type="button" onClick={() => setMonth((current) => addMonths(current, 1))}>Proximo</button>
              </div>
            </header>
            {error && <div className="rental-empty" style={{ color: '#dc2626' }}>{error}</div>}
            <div className="agenda-calendar-scroll">
              <div className="agenda-calendar-content">
              <div className="agenda-weekdays">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => (
                  <div key={day} style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{day}</div>
                ))}
              </div>
              <div className="agenda-calendar-grid">
                {days.map((day) => {
                  const key = isoDate(day);
                  const dayItems = itemsByDate.get(key) || [];
                  const outside = day.getMonth() !== month.getMonth();
                  const selected = key === selectedDate;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setSelectedDate(key); setEditingItem(null); }}
                      style={{
                        minHeight: 112,
                        border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 8,
                        background: selected ? '#eef6ff' : '#fff',
                        padding: 8,
                        textAlign: 'left',
                        opacity: outside ? 0.45 : 1,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <strong style={{ color: key === today ? 'var(--accent)' : 'var(--text)' }}>{day.getDate()}</strong>
                        {dayItems.length > 0 && <span className="sb-item-badge">{dayItems.length}</span>}
                      </div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        {dayItems.slice(0, 3).map((item) => (
                          <span
                            key={item.id}
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              borderLeft: `3px solid ${TIPO_COLOR[item.tipo] || '#3288e0'}`,
                              background: '#f3f6fb',
                              borderRadius: 5,
                              padding: '3px 5px',
                              fontSize: 11,
                              color: item.status === 'cancelado' ? '#9ca3af' : 'var(--text)',
                            }}
                          >
                            {new Date(item.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {item.titulo}
                          </span>
                        ))}
                        {dayItems.length > 3 && <small style={{ color: 'var(--text-muted)' }}>+{dayItems.length - 3} itens</small>}
                      </div>
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
          </section>

          <section className="rental-table-card">
            <header>
              <div>
                <h3>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h3>
                <p>{selectedItems.length} compromisso{selectedItems.length === 1 ? '' : 's'}</p>
              </div>
            </header>
            {selectedItems.length === 0 ? (
              <div className="rental-empty">Nenhum item para este dia.</div>
            ) : (
              <div className="rental-table-wrap">
                <table className="rental-table">
                  <thead>
                    <tr>
                      <th>Horario</th>
                      <th>Tipo</th>
                      <th>Titulo</th>
                      <th>Responsavel</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item) => (
                      <tr key={item.id}>
                        <td><b>{dateTimeBR(item.data_inicio)}</b>{item.data_fim && <small>ate {dateTimeBR(item.data_fim)}</small>}</td>
                        <td><span className="status-pill" style={{ color: TIPO_COLOR[item.tipo], background: `${TIPO_COLOR[item.tipo]}18` }}>{TIPO_LABEL[item.tipo]}</span></td>
                        <td><b>{item.titulo}</b><small>{[item.local, item.descricao].filter(Boolean).join(' · ')}</small></td>
                        <td>{userLabel(item.usuario)}</td>
                        <td>{STATUS_LABEL[item.status] || item.status}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="table-action table-action-ghost" type="button" onClick={() => setEditingItem(item)}>Editar</button>
                            <button className="table-action table-action-ghost" type="button" onClick={() => handleDelete(item)}>Remover</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <AgendaForm
          user={user}
          usuarios={people}
          scopeUserId={currentScopeUserId}
          selectedDate={selectedDate}
          editingItem={editingItem}
          onSaved={handleSaved}
          onCancel={() => setEditingItem(null)}
        />
      </div>
    </section>
  );
}
