"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAdminClientes,
  atualizarAssinatura,
  renovarAssinatura,
  getPagamentos,
  registrarPagamento,
  cancelarPagamento,
  getEventosAssinatura,
  getAdminPlanos,
} from "../lib/api";
import { fmtBRL } from "../lib/data";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ativo:    { label: "Ativo",          color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
  trial:    { label: "Trial",          color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  gracia:   { label: "Carência",       color: "#d97706", bg: "#fffbeb", border: "#fbbf24" },
  vencido:  { label: "Vencido",        color: "#dc2626", bg: "#fff0f0", border: "#fca5a5" },
  inativo:  { label: "Inativo",        color: "#6b7280", bg: "#f9fafb", border: "#d1d5db" },
};

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.inativo;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function daysLeft(date) {
  if (!date) return null;
  const diff = Math.ceil((new Date(date) - new Date()) / 86400000);
  return diff;
}

function DaysLeft({ date, status }) {
  const d = daysLeft(date);
  if (d === null || status === "inativo") return <span style={{ color: "#9ca3af" }}>—</span>;
  if (status === "gracia") {
    // Mostra os dias de carência restantes (10 dias a partir do vencimento)
    const graceLeft = d + 10; // d é negativo (vencido), carência = 10 + d
    const cor = graceLeft <= 3 ? "#dc2626" : "#d97706";
    return (
      <span style={{ color: cor, fontWeight: 600, fontSize: "0.8rem" }}>
        Carência: {Math.max(0, graceLeft)}d
      </span>
    );
  }
  if (d < 0) return <span style={{ color: "#dc2626", fontSize: "0.8rem" }}>Vencido há {Math.abs(d)}d</span>;
  const color = d <= 5 ? "#dc2626" : d <= 15 ? "#d97706" : "#15803d";
  return <span style={{ color, fontWeight: 600, fontSize: "0.8rem" }}>{d}d restantes</span>;
}

// ── Modal de Pagamento ────────────────────────────────────────────────────────

function PagamentoModal({ cliente, onClose, onSuccess }) {
  const [form, setForm] = useState({
    valor: "",
    meses_cobertos: "1",
    metodo: "manual",
    observacao: "",
    data_inicio_cobertura: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Data de fim calculada
  const dataFim = useMemo(() => {
    if (!form.data_inicio_cobertura || !form.meses_cobertos) return null;
    const d = new Date(form.data_inicio_cobertura);
    d.setMonth(d.getMonth() + Number(form.meses_cobertos));
    return d.toLocaleDateString("pt-BR");
  }, [form.data_inicio_cobertura, form.meses_cobertos]);

  async function handleSubmit(e) {
    e.preventDefault();
    const valor = Number(form.valor);
    if (!valor || valor <= 0) { setError("Informe um valor válido."); return; }
    setSaving(true); setError("");
    try {
      await registrarPagamento(cliente.id, {
        valor,
        meses_cobertos: Number(form.meses_cobertos),
        metodo: form.metodo,
        observacao: form.observacao || undefined,
        data_inicio_cobertura: form.data_inicio_cobertura,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao registrar pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(13,27,62,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: "1rem",
        backdropFilter: "blur(2px)",
      }}>
      <div style={{
        width: "100%", maxWidth: 440, background: "#fff",
        borderRadius: 14, border: "1px solid #e5e7eb",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)", padding: "1.75rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ margin: 0, color: "#0d1b3e", fontSize: "1rem", fontWeight: 700 }}>
              Registrar Pagamento
            </h3>
            <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: "0.8125rem" }}>{cliente.nome}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Valor (R$)</span>
              <input
                type="number" min="0" step="0.01" required
                value={form.valor}
                onChange={(e) => setForm(p => ({ ...p, valor: e.target.value }))}
                placeholder="200,00"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Meses cobertos</span>
              <select
                value={form.meses_cobertos}
                onChange={(e) => setForm(p => ({ ...p, meses_cobertos: e.target.value }))}
                style={inputStyle}
              >
                {[1, 2, 3, 6, 12].map(m => (
                  <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Início cobertura</span>
              <input
                type="date"
                value={form.data_inicio_cobertura}
                onChange={(e) => setForm(p => ({ ...p, data_inicio_cobertura: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Método</span>
              <select
                value={form.metodo}
                onChange={(e) => setForm(p => ({ ...p, metodo: e.target.value }))}
                style={inputStyle}
              >
                <option value="manual">Manual</option>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
              </select>
            </label>
          </div>

          {dataFim && (
            <div style={{
              background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
              padding: "8px 12px", marginBottom: 12, fontSize: "0.8125rem", color: "#15803d",
            }}>
              ✓ Acesso liberado até <strong>{dataFim}</strong>
            </div>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Observação (opcional)</span>
            <textarea
              value={form.observacao}
              onChange={(e) => setForm(p => ({ ...p, observacao: e.target.value }))}
              rows={2} placeholder="Comprovante #123, pix confirmado..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          {error && <div style={errorStyle}>{error}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={btnSecStyle}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ ...btnPrimStyle, flex: 2, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Registrando..." : "Confirmar pagamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de Renovação de Assinatura ─────────────────────────────────────────

function RenovarModal({ cliente, onClose, onSuccess }) {
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [planoId, setPlanoId] = useState(null);
  const [meses, setMeses] = useState(1);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminPlanos()
      .then((data) => {
        const ativos = data.filter((p) => p.ativo);
        setPlanos(ativos);
        // Pré-seleciona o plano atual do cliente se disponível
        const atual = ativos.find((p) => p.slug === cliente.plano || String(p.id) === String(cliente.plano_id));
        if (atual) setPlanoId(atual.id);
        else if (ativos.length > 0) setPlanoId(ativos[0].id);
      })
      .finally(() => setLoadingPlanos(false));
  }, [cliente.plano, cliente.plano_id]);

  const planoSelecionado = planos.find((p) => p.id === planoId);
  const total = planoSelecionado ? planoSelecionado.preco_mensal * meses : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!planoId) { setError("Selecione um plano."); return; }
    setSaving(true); setError("");
    try {
      await renovarAssinatura(cliente.id, { plano_id: planoId, meses, observacao: observacao || undefined });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Erro ao renovar assinatura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(13,27,62,0.6)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: "1rem",
        backdropFilter: "blur(3px)",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 520, background: "#fff",
        borderRadius: 16, border: "1px solid #e5e7eb",
        boxShadow: "0 24px 48px rgba(0,0,0,0.18)", padding: "1.75rem",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ margin: 0, color: "#0d1b3e", fontSize: "1.0625rem", fontWeight: 700 }}>
              🔄 Renovar assinatura
            </h3>
            <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: "0.8125rem" }}>{cliente.nome}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20 }}>✕</button>
        </div>

        {loadingPlanos ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>Carregando planos...</div>
        ) : planos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>Nenhum plano ativo disponível.</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Seletor de plano */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 8, display: "block" }}>
                Selecione o plano
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {planos.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      border: planoId === p.id ? `2px solid ${p.cor || "#3288e0"}` : "1px solid #e5e7eb",
                      borderRadius: 10, cursor: "pointer",
                      background: planoId === p.id ? `${p.cor || "#3288e0"}0d` : "#fafafa",
                      transition: "all 0.12s",
                    }}
                  >
                    <input
                      type="radio"
                      name="plano"
                      value={p.id}
                      checked={planoId === p.id}
                      onChange={() => setPlanoId(p.id)}
                      style={{ accentColor: p.cor || "#3288e0" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "#0d1b3e", fontSize: "0.9375rem" }}>{p.nome}</span>
                        <span style={{ fontWeight: 700, color: p.cor || "#3288e0", fontSize: "0.9375rem" }}>
                          {fmtBRL(p.preco_mensal)}<span style={{ fontWeight: 400, color: "#9ca3af", fontSize: "0.75rem" }}>/mês</span>
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 3, display: "flex", gap: 10 }}>
                        <span>👤 {p.max_usuarios ?? "∞"} usuários</span>
                        <span>🏘️ {p.max_loteamentos ?? "∞"} loteamentos</span>
                        <span>📅 {p.duracao_dias}d/ciclo</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Quantidade de meses */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Quantidade de meses</span>
                <select
                  value={meses}
                  onChange={(e) => setMeses(Number(e.target.value))}
                  style={inputStyle}
                >
                  {[1, 2, 3, 6, 12].map((m) => (
                    <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Total a pagar</span>
                <div style={{
                  ...inputStyle, display: "flex", alignItems: "center",
                  fontWeight: 700, fontSize: "1rem", color: "#0d1b3e",
                  background: "#f0fdf4", borderColor: "#86efac",
                }}>
                  {fmtBRL(total)}
                </div>
              </label>
            </div>

            {/* Resumo da cobertura */}
            {planoSelecionado && (
              <div style={{
                background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
                padding: "10px 14px", marginBottom: 14, fontSize: "0.8125rem", color: "#15803d",
              }}>
                ✓ Renovação de <strong>{meses} {meses === 1 ? "mês" : "meses"}</strong> no plano{" "}
                <strong>{planoSelecionado.nome}</strong> · {planoSelecionado.duracao_dias * meses} dias de acesso
              </div>
            )}

            {/* Observação */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Observação (opcional)</span>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                placeholder="Renovação referente ao mês de..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>

            {error && (
              <div style={{
                background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 7,
                padding: "8px 12px", color: "#dc2626", fontSize: "0.875rem", marginBottom: 12,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
              <button type="submit" disabled={saving || !planoId} style={{ ...btnPrimStyle, flex: 2, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Renovando..." : "Confirmar renovação"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Drawer de detalhes do cliente ─────────────────────────────────────────────

function ClienteDrawer({ cliente, onClose, onRefresh }) {
  const [tab, setTab] = useState("pagamentos");
  const [pagamentos, setPagamentos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [vencInput, setVencInput] = useState(
    cliente.venc_mensalidade ? new Date(cliente.venc_mensalidade).toISOString().slice(0, 10) : ""
  );

  const carregarPagamentos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPagamentos(cliente.id);
      setPagamentos(data);
    } finally { setLoading(false); }
  }, [cliente.id]);

  const carregarEventos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEventosAssinatura(cliente.id);
      setEventos(data);
    } finally { setLoading(false); }
  }, [cliente.id]);

  useEffect(() => {
    if (tab === "pagamentos") carregarPagamentos();
    else carregarEventos();
  }, [tab, carregarPagamentos, carregarEventos]);

  async function toggleAtivo() {
    setAtualizando(true);
    try {
      await atualizarAssinatura(cliente.id, { ativo: !cliente.ativo });
      onRefresh();
    } finally { setAtualizando(false); }
  }

  async function salvarVencimento() {
    if (!vencInput) return;
    setAtualizando(true);
    try {
      await atualizarAssinatura(cliente.id, { venc_mensalidade: vencInput });
      onRefresh();
    } finally { setAtualizando(false); }
  }

  async function handleCancelarPagamento(pagId) {
    if (!confirm("Cancelar este pagamento?")) return;
    setCancelingId(pagId);
    try {
      await cancelarPagamento(cliente.id, pagId);
      carregarPagamentos();
      onRefresh();
    } finally { setCancelingId(null); }
  }

  const STATUS_EVENTO = {
    trial_iniciado: { icon: "🧪", label: "Trial iniciado" },
    trial_expirado: { icon: "⏰", label: "Trial expirado" },
    ativado:        { icon: "✅", label: "Ativado" },
    desativado:     { icon: "🔒", label: "Desativado" },
    pagamento_registrado: { icon: "💰", label: "Pagamento registrado" },
    pagamento_cancelado:  { icon: "❌", label: "Pagamento cancelado" },
    renovado:        { icon: "🔄", label: "Renovado" },
    plano_alterado:  { icon: "📋", label: "Plano alterado" },
    vencimento_alterado: { icon: "📅", label: "Vencimento alterado" },
  };

  return (
    <>
      {showPagamentoModal && (
        <PagamentoModal
          cliente={cliente}
          onClose={() => setShowPagamentoModal(false)}
          onSuccess={() => { carregarPagamentos(); onRefresh(); }}
        />
      )}

      {showRenovarModal && (
        <RenovarModal
          cliente={cliente}
          onClose={() => setShowRenovarModal(false)}
          onSuccess={() => { carregarPagamentos(); onRefresh(); }}
        />
      )}

      <div onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(13,27,62,0.4)",
          backdropFilter: "blur(1px)",
        }}>
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: "100%", maxWidth: 520,
          background: "#fff", boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Cabeçalho do drawer */}
          <div style={{ padding: "1.5rem", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: 0, color: "#0d1b3e", fontSize: "1.125rem", fontWeight: 700 }}>
                  {cliente.nome}
                </h2>
                <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.8125rem" }}>
                  {cliente.usuario_principal?.nome || "—"} · {cliente.usuario_principal?.email || "—"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusPill status={cliente.status} />
                <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20, padding: 4 }}>✕</button>
              </div>
            </div>

            {/* Informações de assinatura */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <InfoCard label="Trial até" value={fmt(cliente.trial_ends_at)} />
              <InfoCard label="Assinatura até" value={fmt(cliente.venc_mensalidade)} />
              <InfoCard label="Plano" value={cliente.plano || "basico"} />
              <InfoCard label="Cadastro" value={fmt(cliente.criado_em)} />
            </div>

            {/* Ações rápidas */}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                onClick={toggleAtivo}
                disabled={atualizando}
                style={{
                  ...btnSecStyle,
                  borderColor: cliente.ativo ? "#fca5a5" : "#86efac",
                  color: cliente.ativo ? "#dc2626" : "#15803d",
                }}
              >
                {atualizando ? "..." : cliente.ativo ? "🔒 Desativar conta" : "✅ Ativar conta"}
              </button>
              <button
                onClick={() => setShowPagamentoModal(true)}
                style={{ ...btnPrimStyle, fontSize: "0.8125rem", padding: "6px 14px" }}
              >
                💰 Registrar pagamento
              </button>
              <button
                onClick={() => setShowRenovarModal(true)}
                style={{ ...btnPrimStyle, fontSize: "0.8125rem", padding: "6px 14px", background: "#8b5cf6" }}
              >
                🔄 Renovar plano
              </button>
            </div>

            {/* Ajuste manual de vencimento */}
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <input
                type="date"
                value={vencInput}
                onChange={(e) => setVencInput(e.target.value)}
                style={{ ...inputStyle, flex: 1, fontSize: "0.8125rem", padding: "6px 10px" }}
              />
              <button onClick={salvarVencimento} disabled={atualizando || !vencInput} style={{ ...btnSecStyle, fontSize: "0.8125rem" }}>
                Salvar vencimento
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
            {["pagamentos", "eventos"].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "10px", border: "none", cursor: "pointer",
                background: "none", fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "#3288e0" : "#6b7280", fontSize: "0.875rem",
                borderBottom: tab === t ? "2px solid #3288e0" : "2px solid transparent",
              }}>
                {t === "pagamentos" ? "Pagamentos" : "Histórico"}
              </button>
            ))}
          </div>

          {/* Conteúdo da tab */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
            {loading ? (
              <div style={{ color: "#9ca3af", textAlign: "center", padding: "2rem" }}>Carregando...</div>
            ) : tab === "pagamentos" ? (
              pagamentos.length === 0 ? (
                <div style={{ color: "#9ca3af", textAlign: "center", padding: "2rem" }}>
                  Nenhum pagamento registrado.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pagamentos.map((p) => (
                    <div key={p.id} style={{
                      border: "1px solid #f3f4f6", borderRadius: 10, padding: "12px 14px",
                      opacity: p.status === "cancelado" ? 0.5 : 1,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "#0d1b3e", fontSize: "1rem" }}>
                            {fmtBRL(p.valor)}
                          </span>
                          <span style={{
                            marginLeft: 8, fontSize: "0.75rem", fontWeight: 600,
                            color: p.status === "pago" ? "#15803d" : p.status === "cancelado" ? "#6b7280" : "#b45309",
                            background: p.status === "pago" ? "#f0fdf4" : "#f9fafb",
                            padding: "1px 7px", borderRadius: 10,
                          }}>
                            {p.status}
                          </span>
                        </div>
                        {p.status !== "cancelado" && (
                          <button
                            onClick={() => handleCancelarPagamento(p.id)}
                            disabled={cancelingId === p.id}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "0.75rem" }}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                      <div style={{ marginTop: 6, fontSize: "0.8rem", color: "#6b7280", display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span>📅 {fmt(p.pago_em)}</span>
                        <span>🗓️ {p.meses_cobertos}m cobertura</span>
                        <span>📋 {p.metodo}</span>
                        {p.data_fim_cobertura && <span>→ até {fmt(p.data_fim_cobertura)}</span>}
                      </div>
                      {p.observacao && <div style={{ marginTop: 4, fontSize: "0.8rem", color: "#374151" }}>{p.observacao}</div>}
                    </div>
                  ))}
                </div>
              )
            ) : (
              eventos.length === 0 ? (
                <div style={{ color: "#9ca3af", textAlign: "center", padding: "2rem" }}>
                  Nenhum evento registrado.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {eventos.map((ev) => {
                    const cfg = STATUS_EVENTO[ev.tipo] ?? { icon: "•", label: ev.tipo };
                    return (
                      <div key={ev.id} style={{
                        display: "flex", gap: 10, padding: "10px 12px",
                        background: "#f9fafb", borderRadius: 8, fontSize: "0.8125rem",
                      }}>
                        <span style={{ fontSize: 16, lineHeight: 1.4 }}>{cfg.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#374151" }}>{cfg.label}</div>
                          {ev.descricao && <div style={{ color: "#6b7280", marginTop: 2 }}>{ev.descricao}</div>}
                          <div style={{ color: "#9ca3af", marginTop: 2 }}>{fmt(ev.criado_em)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoCard({ label, value }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>{value || "—"}</div>
    </div>
  );
}

// ── Painel principal ──────────────────────────────────────────────────────────

export function AssinaturaPanel() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [selected, setSelected] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminClientes();
      setClientes(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clientes.filter((c) => {
      if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
      if (!q) return true;
      return [c.nome, c.cnpj, c.cidade, c.estado, c.usuario_principal?.nome, c.usuario_principal?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [clientes, query, filtroStatus]);

  const counts = useMemo(() => {
    return clientes.reduce(
      (acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; acc.total++; return acc; },
      { total: 0, ativo: 0, trial: 0, gracia: 0, vencido: 0, inativo: 0 }
    );
  }, [clientes]);

  const refreshCliente = useCallback(async () => {
    const fresh = await getAdminClientes();
    setClientes(fresh);
    if (selected) {
      setSelected(fresh.find((c) => c.id === selected.id) ?? null);
    }
  }, [selected]);

  return (
    <section className="list-page">
      {selected && (
        <ClienteDrawer
          cliente={selected}
          onClose={() => setSelected(null)}
          onRefresh={refreshCliente}
        />
      )}

      <header className="list-page-head" style={{ marginBottom: "1rem" }}>
        <div>
          <div className="dash-eyebrow">CLIENTES</div>
          <h1 className="list-page-title">Gestão de assinaturas</h1>
          <p className="dash-sub">Controle de acesso, pagamentos e histórico por empresa.</p>
        </div>
        <button className="sec-tool-btn" onClick={carregar} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76L14 2v4h-4l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Atualizar
        </button>
      </header>

      {/* Métricas */}
      <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {[
          { key: "todos", label: "Total", value: counts.total },
          { key: "ativo", label: "Ativos", value: counts.ativo },
          { key: "trial", label: "Em trial", value: counts.trial },
          { key: "gracia", label: "Carência", value: counts.gracia },
          { key: "vencido", label: "Vencidos", value: counts.vencido },
          { key: "inativo", label: "Inativos", value: counts.inativo },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setFiltroStatus(m.key)}
            style={{
              background: filtroStatus === m.key ? "#3288e0" : "#fff",
              border: filtroStatus === m.key ? "1px solid #3288e0" : "1px solid #e5e7eb",
              borderRadius: 10, padding: "10px 16px", cursor: "pointer",
              textAlign: "left", minWidth: 90,
            }}
          >
            <div style={{ fontSize: "0.7rem", color: filtroStatus === m.key ? "rgba(255,255,255,0.8)" : "#9ca3af", marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: filtroStatus === m.key ? "#fff" : "#0d1b3e" }}>{m.value}</div>
          </button>
        ))}
      </div>

      {/* Busca */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", marginBottom: "1rem" }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="#9ca3af" strokeWidth="1.5" />
          <path d="M10.5 10.5l3 3" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por empresa, CNPJ, usuário..."
          style={{ border: "none", background: "none", outline: "none", flex: 1, fontSize: "0.875rem", color: "#374151" }}
        />
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="list-empty">Carregando clientes...</div>
      ) : filtered.length === 0 ? (
        <div className="list-empty">Nenhum cliente encontrado.</div>
      ) : (
        <div className="lot-table-wrap">
          <table className="lot-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Vencimento</th>
                <th>Prazo</th>
                <th>Plano</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const vencDate = c.venc_mensalidade || (c.status === "trial" ? c.trial_ends_at : null);
                return (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setSelected(c)}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <b style={{ color: "#0d1b3e" }}>{c.nome}</b>
                        <small style={{ color: "#9ca3af" }}>{c.cidade}{c.estado ? `/${c.estado}` : ""}</small>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.8125rem" }}>
                        <div style={{ color: "#374151" }}>{c.usuario_principal?.nome || "—"}</div>
                        <div style={{ color: "#9ca3af" }}>{c.usuario_principal?.email || "—"}</div>
                      </div>
                    </td>
                    <td><StatusPill status={c.status} /></td>
                    <td style={{ fontSize: "0.8125rem", color: "#374151" }}>{fmt(vencDate)}</td>
                    <td><DaysLeft date={vencDate} status={c.status} /></td>
                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{c.plano || "basico"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="table-action table-action-ghost"
                          onClick={(e) => { e.stopPropagation(); setSelected(c); }}
                        >
                          Gerenciar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Estilos compartilhados ────────────────────────────────────────────────────

const inputStyle = {
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 7,
  fontSize: "0.875rem",
  outline: "none",
  background: "#f9fafb",
  color: "#374151",
  width: "100%",
  boxSizing: "border-box",
};

const btnPrimStyle = {
  flex: 1,
  padding: "8px 14px",
  background: "#3288e0",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.875rem",
};

const btnSecStyle = {
  flex: 1,
  padding: "8px 14px",
  background: "#fff",
  color: "#374151",
  border: "1px solid #e5e7eb",
  borderRadius: 7,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.875rem",
};

const errorStyle = {
  background: "#fff0f0",
  border: "1px solid #fca5a5",
  borderRadius: 7,
  padding: "8px 12px",
  color: "#dc2626",
  fontSize: "0.875rem",
  marginBottom: 12,
};
