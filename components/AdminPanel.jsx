"use client";

import { useMemo, useState } from "react";
import { formatCpfCnpj } from "./ClienteManagement";
import { UserManagement } from "./UserManagement";
import { flattenLots } from "../lib/api";
import { fmtBRL } from "../lib/data";

const ADMIN_TABS = [
  { id: "usuarios", label: "Usuarios" },
  { id: "cancelamentos", label: "Cancelamentos" },
  { id: "motivos", label: "Motivos" },
];

const TIPO_LABELS = {
  venda: "Venda",
  reserva: "Reserva",
  loteamento: "Loteamento",
  geral: "Geral",
};

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
  loteamentos,
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
  const [tab, setTab] = useState("usuarios");

  if (user?.role !== "admin") {
    return (
      <section className="list-page admin-page">
        <div className="list-empty">Apenas administradores podem acessar esta area.</div>
      </section>
    );
  }

  return (
    <section className="list-page admin-page">
      <header className="list-page-head admin-head">
        <div>
          <div className="dash-eyebrow">ADMIN</div>
          <h1 className="list-page-title">Painel administrativo</h1>
          <p className="dash-sub">Controle de usuarios, cancelamentos e motivos padrao.</p>
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
            {item.label}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {tab === "usuarios" && (
          <UserManagement
            users={users}
            loading={usersLoading}
            onRefresh={onRefreshUsers}
            onCreate={onCreateUser}
            currentUser={user}
          />
        )}

        {tab === "cancelamentos" && (
          <CancelamentoAdmin
            loteamentos={loteamentos}
            motivos={motivos}
            loading={logsLoading}
            onCancelarVenda={onCancelarVenda}
            onRefreshLogs={onRefreshLogs}
            onRefreshMotivos={onRefreshMotivos}
            logs={cancelamentosLog}
          />
        )}

        {tab === "motivos" && (
          <MotivosAdmin
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

function CancelamentoAdmin({
  loteamentos = [],
  motivos = [],
  logs = [],
  loading,
  onCancelarVenda,
  onRefreshLogs,
  onRefreshMotivos,
}) {
  const [tipo, setTipo] = useState("venda");
  const [loteId, setLoteId] = useState("");
  const [motivoId, setMotivoId] = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const soldLots = useMemo(() => {
    return flattenLots(loteamentos).filter((lot) => lot.status === "vendido");
  }, [loteamentos]);

  const activeMotivos = useMemo(() => {
    return motivos.filter((motivo) => motivo.ativo && ["venda", "geral"].includes(motivo.tipo || "venda"));
  }, [motivos]);

  const selectedLot = soldLots.find((lot) => String(lot.db_id) === String(loteId));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (tipo !== "venda") {
      setError("Por enquanto somente cancelamento de venda esta disponivel.");
      return;
    }

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
          <button type="button" className="sec-tool-btn" onClick={() => { onRefreshLogs?.(); onRefreshMotivos?.(); }}>
            Atualizar
          </button>
        </div>

        <label className="admin-field">
          <span>O que deseja cancelar</span>
          <select value={tipo} onChange={(event) => setTipo(event.target.value)}>
            <option value="venda">Cancelar venda</option>
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
          <span>Motivo padrao</span>
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

        <button className="qa-btn qa-btn-primary admin-submit" type="submit" disabled={saving || soldLots.length === 0}>
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
                  <th>Operacao</th>
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
                    <td>{log.tipo_cancelamento}</td>
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

function MotivosAdmin({ motivos = [], loading, onRefresh, onCreate, onUpdate }) {
  const [form, setForm] = useState({ nome: "", tipo: "venda", descricao: "", ativo: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

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
        tipo: form.tipo,
        descricao: form.descricao.trim() || undefined,
        ativo: form.ativo,
      });
      setForm({ nome: "", tipo: "venda", descricao: "", ativo: true });
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
            <p>Motivos ativos aparecem no cancelamento de venda.</p>
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

        <label className="admin-field">
          <span>Tipo</span>
          <select value={form.tipo} onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}>
            <option value="venda">Venda</option>
            <option value="reserva">Reserva</option>
            <option value="loteamento">Loteamento</option>
            <option value="geral">Geral</option>
          </select>
        </label>

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
                  <th>Tipo</th>
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
                    <td>{TIPO_LABELS[motivo.tipo] || motivo.tipo}</td>
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
