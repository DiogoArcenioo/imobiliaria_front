"use client";

import { useMemo, useState } from "react";
import { formatCpfCnpj } from "./ClienteManagement";
import { UserManagement } from "./UserManagement";
import { AssinaturaPanel } from "./AssinaturaPanel";
import { PlanosAdmin } from "./PlanosAdmin";
import { flattenLots } from "../lib/api";
import { fmtBRL } from "../lib/data";

const ADMIN_TABS = [
  { id: "clientes",      label: "Clientes",      icon: "🏢" },
  { id: "planos",        label: "Planos",         icon: "📦" },
  { id: "usuarios",      label: "Usuários",       icon: "👥" },
  { id: "cancelamentos", label: "Cancelamentos",  icon: "↩️" },
  { id: "motivos",       label: "Motivos",        icon: "📋" },
];

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clientLabel(cliente) {
  if (!cliente) return "Cliente nao vinculado";
  return `${cliente.nome} - ${formatCpfCnpj(cliente.cpf_cnpj)}`;
}

export function AdminPanel({
  user,
  users,
  usersLoading,
  onRefreshUsers,
  onCreateUser,
  onUpdateUser,
  loteamentos,
  tipos,
  tiposLoading,
  onRefreshTipos,
  motivos,
  motivosLoading,
  onRefreshMotivos,
  onCreateMotivo,
  onUpdateMotivo,
  cancelamentosLog,
  logsLoading,
  onRefreshLogs,
  onCancelarVenda,
}) {
  const [tab, setTab] = useState("clientes");

  if (user?.role !== "admin") {
    return (
      <section className="list-page admin-page">
        <div className="list-empty">Apenas administradores podem acessar esta area.</div>
      </section>
    );
  }

  // Métricas calculadas a partir das props disponíveis
  const allLots = useMemo(() => flattenLots(loteamentos), [loteamentos]);
  const metrics = useMemo(() => ({
    usuarios:    users.length,
    loteamentos: loteamentos.length,
    lotes:       allLots.length,
    vgv:         allLots.reduce((s, l) => s + (Number(l.preco) || 0), 0),
    vendidos:    allLots.filter((l) => l.status === "vendido").length,
  }), [users, loteamentos, allLots]);

  return (
    <section className="list-page admin-page">
      <header className="list-page-head admin-head" style={{ marginBottom: "1rem" }}>
        <div style={{ flex: 1 }}>
          <div className="dash-eyebrow">SISTEMA · ADMIN</div>
          <h1 className="list-page-title">Painel gerencial</h1>
          <p className="dash-sub">Clientes, planos, usuários, cancelamentos e configurações do sistema.</p>
        </div>

        {/* Cards de métricas rápidas */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Usuários",    value: metrics.usuarios,    icon: "👥" },
            { label: "Loteamentos", value: metrics.loteamentos, icon: "🏘️" },
            { label: "Lotes",       value: metrics.lotes,       icon: "📐" },
            { label: "VGV Total",   value: fmtBRL(metrics.vgv), icon: "💰" },
          ].map((m) => (
            <div key={m.label} style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
              padding: "8px 14px", minWidth: 90, textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: 2 }}>
                {m.icon} {m.label}
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0d1b3e" }}>{m.value}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="admin-tabs" role="tablist" aria-label="Administracao">
        {ADMIN_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={"admin-tab" + (tab === item.id ? " admin-tab-active" : "")}
            onClick={() => setTab(item.id)}
          >
            <span style={{ marginRight: 5 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {tab === "clientes" && <AssinaturaPanel />}

        {tab === "planos" && <PlanosAdmin />}

        {tab === "usuarios" && (
          <UserManagement
            users={users}
            loading={usersLoading}
            onRefresh={onRefreshUsers}
            onCreate={onCreateUser}
            onUpdate={onUpdateUser}
            currentUser={user}
          />
        )}

        {tab === "cancelamentos" && (
          <CancelamentoAdmin
            loteamentos={loteamentos}
            tipos={tipos}
            motivos={motivos}
            loading={logsLoading}
            onCancelarVenda={onCancelarVenda}
            onRefreshLogs={onRefreshLogs}
            onRefreshMotivos={onRefreshMotivos}
            onRefreshTipos={onRefreshTipos}
            logs={cancelamentosLog}
          />
        )}

        {tab === "motivos" && (
          <MotivosAdmin
            tipos={tipos}
            motivos={motivos}
            loading={motivosLoading}
            onRefresh={onRefreshMotivos}
            onCreate={onCreateMotivo}
            onUpdate={onUpdateMotivo}
          />
        )}
      </div>
    </section>
  );
}

// ── Cancelamentos ──────────────────────────────────────────────────────────────

function CancelamentoAdmin({
  loteamentos = [],
  tipos = [],
  motivos = [],
  logs = [],
  loading,
  onCancelarVenda,
  onRefreshLogs,
  onRefreshMotivos,
  onRefreshTipos,
}) {
  const tiposAtivos = useMemo(() => tipos.filter((t) => t.ativo), [tipos]);

  const [tipoId, setTipoId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [motivoId, setMotivoId] = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const soldLots = useMemo(() => {
    return flattenLots(loteamentos).filter((lot) => lot.status === "vendido");
  }, [loteamentos]);

  const activeMotivos = useMemo(() => {
    if (!tipoId) return motivos.filter((m) => m.ativo);
    return motivos.filter(
      (m) => m.ativo && m.tipos?.some((t) => String(t.id) === String(tipoId))
    );
  }, [motivos, tipoId]);

  const selectedLot = soldLots.find((lot) => String(lot.db_id) === String(loteId));

  function handleTipoChange(event) {
    setTipoId(event.target.value);
    setMotivoId("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!loteId) {
      setError("Selecione uma venda para cancelar.");
      return;
    }

    if (!motivoId && !motivoTexto.trim()) {
      setError("Selecione um motivo ou informe uma observacao.");
      return;
    }

    setSaving(true);
    try {
      await onCancelarVenda({
        lote_id: Number(loteId),
        motivo_id: motivoId ? Number(motivoId) : undefined,
        motivo_texto: motivoTexto.trim() || undefined,
        tipo_id: tipoId ? Number(tipoId) : undefined,
      });
      setLoteId("");
      setMotivoId("");
      setMotivoTexto("");
    } catch (err) {
      setError(err.message || "Erro ao cancelar venda");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-grid">
      <form className="admin-form-panel" onSubmit={handleSubmit}>
        <div className="admin-panel-head">
          <div>
            <h2>Cancelamento</h2>
            <p>A venda cancelada volta para disponivel e sai dos indicadores.</p>
          </div>
          <button
            type="button"
            className="sec-tool-btn"
            onClick={() => { onRefreshLogs?.(); onRefreshMotivos?.(); onRefreshTipos?.(); }}
          >
            Atualizar
          </button>
        </div>

        <label className="admin-field">
          <span>Tipo de cancelamento</span>
          <select value={tipoId} onChange={handleTipoChange}>
            <option value="">Todos os tipos</option>
            {tiposAtivos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Venda</span>
          <select value={loteId} onChange={(event) => setLoteId(event.target.value)}>
            <option value="">Selecione uma venda</option>
            {soldLots.map((lot) => (
              <option key={lot.db_id} value={lot.db_id}>
                {lot.id} - {lot.loteamentoNome} - {clientLabel(lot.cliente)}
              </option>
            ))}
          </select>
        </label>

        {selectedLot && (
          <div className="cancel-sale-preview">
            <b>{selectedLot.id} - {selectedLot.loteamentoNome}</b>
            <span>{clientLabel(selectedLot.cliente)}</span>
            <span>{fmtBRL(selectedLot.preco)}</span>
          </div>
        )}

        <label className="admin-field">
          <span>
            Motivo padrao
            {tipoId && activeMotivos.length === 0 && (
              <span className="table-sub"> — nenhum motivo vinculado a este tipo</span>
            )}
          </span>
          <select value={motivoId} onChange={(event) => setMotivoId(event.target.value)}>
            <option value="">Selecionar motivo</option>
            {activeMotivos.map((motivo) => (
              <option key={motivo.id} value={motivo.id}>{motivo.nome}</option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Complemento do motivo</span>
          <textarea
            value={motivoTexto}
            onChange={(event) => setMotivoTexto(event.target.value)}
            rows={4}
            placeholder="Detalhe a autorizacao, protocolo ou observacao interna."
          />
        </label>

        {error && <div className="form-alert">{error}</div>}

        <button
          className="qa-btn qa-btn-primary admin-submit"
          type="submit"
          disabled={saving || soldLots.length === 0}
        >
          {saving ? "Cancelando..." : "Cancelar venda"}
        </button>
      </form>

      <section className="admin-list-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Log de cancelamentos</h2>
            <p>{logs.length} registros auditaveis</p>
          </div>
        </div>

        {loading ? (
          <div className="list-empty">Carregando logs...</div>
        ) : logs.length === 0 ? (
          <div className="list-empty">Nenhum cancelamento registrado.</div>
        ) : (
          <div className="lot-table-wrap admin-table-wrap">
            <table className="lot-table admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Item</th>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th>Cancelado por</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.created_at)}</td>
                    <td>{log.tipo_cancelamento || "-"}</td>
                    <td>
                      <b className="lot-code">{log.entidade_codigo || log.entidade_id}</b>
                      <div className="table-sub">{log.loteamento?.nome || log.dados_antes?.loteamento_nome || "-"}</div>
                    </td>
                    <td>{clientLabel(log.cliente || log.dados_antes?.cliente)}</td>
                    <td>
                      <b>{log.motivo?.nome || log.motivo_descricao}</b>
                      <div className="table-sub">{log.status_anterior} para {log.status_novo}</div>
                    </td>
                    <td>
                      {log.cancelado_por_usuario?.nome || log.cancelado_por_usuario?.login || "Usuario"}
                      <div className="table-sub">ID {log.cancelado_por || "-"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

// ── Motivos ────────────────────────────────────────────────────────────────────

function MotivosAdmin({ tipos = [], motivos = [], loading, onRefresh, onCreate, onUpdate }) {
  const [form, setForm] = useState({ nome: "", tipo_ids: [], descricao: "", ativo: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const tiposAtivos = useMemo(() => tipos.filter((t) => t.ativo), [tipos]);

  function toggleTipoId(id) {
    setForm((prev) => {
      const exists = prev.tipo_ids.includes(id);
      return {
        ...prev,
        tipo_ids: exists ? prev.tipo_ids.filter((x) => x !== id) : [...prev.tipo_ids, id],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.nome.trim().length < 3) {
      setError("Informe um motivo com pelo menos 3 caracteres.");
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        nome: form.nome.trim(),
        tipo_ids: form.tipo_ids,
        descricao: form.descricao.trim() || undefined,
        ativo: form.ativo,
      });
      setForm({ nome: "", tipo_ids: [], descricao: "", ativo: true });
    } catch (err) {
      setError(err.message || "Erro ao cadastrar motivo");
    } finally {
      setSaving(false);
    }
  }

  async function toggleMotivo(motivo) {
    setUpdatingId(motivo.id);
    setError("");
    try {
      await onUpdate(motivo.id, { ativo: !motivo.ativo });
    } catch (err) {
      setError(err.message || "Erro ao atualizar motivo");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="admin-grid">
      <form className="admin-form-panel" onSubmit={handleSubmit}>
        <div className="admin-panel-head">
          <div>
            <h2>Novo motivo</h2>
            <p>Motivos ativos aparecem no cancelamento conforme o tipo selecionado.</p>
          </div>
          <button type="button" className="sec-tool-btn" onClick={onRefresh} disabled={loading}>
            Atualizar
          </button>
        </div>

        <label className="admin-field">
          <span>Nome do motivo</span>
          <input
            value={form.nome}
            onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
            maxLength={200}
            placeholder="Distrato solicitado pelo cliente"
          />
        </label>

        <div className="admin-field">
          <span>Tipos vinculados</span>
          {tiposAtivos.length === 0 ? (
            <p className="table-sub">Nenhum tipo cadastrado. Crie tipos na aba Tipos.</p>
          ) : (
            <div className="admin-check-group">
              {tiposAtivos.map((tipo) => (
                <label key={tipo.id} className="admin-check">
                  <input
                    type="checkbox"
                    checked={form.tipo_ids.includes(tipo.id)}
                    onChange={() => toggleTipoId(tipo.id)}
                  />
                  {tipo.nome}
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="admin-field">
          <span>Descricao</span>
          <textarea
            value={form.descricao}
            onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
            rows={4}
            maxLength={1000}
          />
        </label>

        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(event) => setForm((prev) => ({ ...prev, ativo: event.target.checked }))}
          />
          Motivo ativo
        </label>

        {error && <div className="form-alert">{error}</div>}

        <button className="qa-btn qa-btn-primary admin-submit" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Cadastrar motivo"}
        </button>
      </form>

      <section className="admin-list-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Motivos cadastrados</h2>
            <p>{motivos.length} registros</p>
          </div>
        </div>

        {loading ? (
          <div className="list-empty">Carregando motivos...</div>
        ) : motivos.length === 0 ? (
          <div className="list-empty">Nenhum motivo cadastrado.</div>
        ) : (
          <div className="lot-table-wrap admin-table-wrap">
            <table className="lot-table admin-table">
              <thead>
                <tr>
                  <th>Motivo</th>
                  <th>Tipos</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {motivos.map((motivo) => (
                  <tr key={motivo.id}>
                    <td>
                      <b>{motivo.nome}</b>
                      <div className="table-sub">{motivo.descricao || "Sem descricao"}</div>
                    </td>
                    <td>
                      {motivo.tipos?.length > 0
                        ? motivo.tipos.map((t) => t.nome).join(", ")
                        : <span className="table-sub">Sem tipo</span>}
                    </td>
                    <td>
                      <span className={"admin-status-pill" + (motivo.ativo ? " admin-status-active" : "")}>
                        {motivo.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-action table-action-ghost"
                          disabled={updatingId === motivo.id}
                          onClick={() => toggleMotivo(motivo)}
                        >
                          {motivo.ativo ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
