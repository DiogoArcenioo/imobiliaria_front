"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminPlanos, criarPlano, atualizarPlano } from "../lib/api";
import { fmtBRL } from "../lib/data";

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  nome: "",
  slug: "",
  descricao: "",
  preco_mensal: "",
  preco_anual: "",
  duracao_dias: "30",
  duracao_trial_dias: "7",
  max_usuarios: "",
  max_loteamentos: "",
  max_predios: "",
  destaque: false,
  ordem: "0",
  cor: "#3288e0",
  recursos: [],
  ativo: true,
};

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// ── Componente de cor com preview ─────────────────────────────────────────────

function ColorField({ value, onChange }) {
  const presets = ["#3288e0", "#8b5cf6", "#0d9488", "#ea580c", "#dc2626", "#16a34a", "#0891b2", "#9333ea"];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 36, padding: 2, border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer", background: "#fff" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          placeholder="#3288e0"
          style={{ ...inputStyle, flex: 1 }}
        />
        <div style={{ width: 36, height: 36, borderRadius: 7, background: value, border: "1px solid #e5e7eb", flexShrink: 0 }} />
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{
              width: 22, height: 22, borderRadius: 5, background: c, border: "none",
              cursor: "pointer", outline: value === c ? `2px solid ${c}` : "none",
              outlineOffset: 2,
            }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

// ── Campo de recursos (lista dinâmica) ───────────────────────────────────────

function RecursosField({ value = [], onChange }) {
  const [inputVal, setInputVal] = useState("");

  function add() {
    const trimmed = inputVal.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInputVal("");
  }

  function remove(idx) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function handleKey(e) {
    if (e.key === "Enter") { e.preventDefault(); add(); }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ex: Até 10 usuários"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="button" onClick={add} style={btnAddStyle}>+ Adicionar</button>
      </div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {value.map((r, idx) => (
            <div key={idx} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#f9fafb", border: "1px solid #f3f4f6",
              borderRadius: 7, padding: "6px 10px", fontSize: "0.8125rem",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3288e0", flexShrink: 0 }} />
              <span style={{ flex: 1, color: "#374151" }}>{r}</span>
              <button type="button" onClick={() => remove(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card de plano ─────────────────────────────────────────────────────────────

function PlanoCard({ plano, selected, onClick, onToggleAtivo, toggling }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: selected ? `2px solid ${plano.cor || "#3288e0"}` : "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "1rem 1.25rem",
        background: selected ? `${plano.cor}0d` : "#fff",
        cursor: "pointer",
        transition: "all 0.15s ease",
        opacity: plano.ativo ? 1 : 0.55,
        position: "relative",
      }}
    >
      {plano.destaque && (
        <div style={{
          position: "absolute", top: -10, right: 12,
          background: plano.cor || "#3288e0", color: "#fff",
          fontSize: "0.65rem", fontWeight: 700, padding: "2px 10px",
          borderRadius: 20, letterSpacing: "0.05em",
        }}>
          RECOMENDADO
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{
            display: "inline-block", padding: "2px 10px", borderRadius: 20,
            background: `${plano.cor || "#3288e0"}20`, color: plano.cor || "#3288e0",
            fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4,
          }}>
            {plano.nome}
          </div>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0d1b3e" }}>
            {fmtBRL(plano.preco_mensal)}
            <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#9ca3af" }}>/mês</span>
          </div>
          {plano.preco_anual > 0 && (
            <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 1 }}>
              Anual: {fmtBRL(plano.preco_anual)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span style={{
            fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            background: plano.ativo ? "#f0fdf4" : "#f3f4f6",
            color: plano.ativo ? "#15803d" : "#9ca3af",
            border: `1px solid ${plano.ativo ? "#86efac" : "#e5e7eb"}`,
          }}>
            {plano.ativo ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, fontSize: "0.75rem", color: "#6b7280" }}>
        <span title="Usuários">👤 {plano.max_usuarios ?? "∞"} usuários</span>
        <span title="Loteamentos">🏘️ {plano.max_loteamentos ?? "∞"} loteamentos</span>
        <span title="Prédios">🏢 {plano.max_predios ?? "∞"} prédios</span>
        <span title="Duração">📅 {plano.duracao_dias}d</span>
        <span title="Trial">🧪 {plano.duracao_trial_dias}d trial</span>
      </div>

      {plano.recursos?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {plano.recursos.slice(0, 3).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#374151" }}>
              <span style={{ color: plano.cor || "#3288e0", fontWeight: 600 }}>✓</span> {r}
            </div>
          ))}
          {plano.recursos.length > 3 && (
            <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>+{plano.recursos.length - 3} recursos</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleAtivo(plano); }}
          disabled={toggling === plano.id}
          style={{
            fontSize: "0.75rem", padding: "4px 10px",
            background: "none", cursor: "pointer", borderRadius: 6,
            border: `1px solid ${plano.ativo ? "#fca5a5" : "#86efac"}`,
            color: plano.ativo ? "#dc2626" : "#15803d",
          }}
        >
          {toggling === plano.id ? "..." : plano.ativo ? "Desativar" : "Ativar"}
        </button>
        <button
          type="button"
          onClick={onClick}
          style={{
            fontSize: "0.75rem", padding: "4px 10px",
            background: "#f3f4f6", cursor: "pointer", borderRadius: 6,
            border: "1px solid #e5e7eb", color: "#374151",
          }}
        >
          Editar
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function PlanosAdmin() {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = novo plano
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [slugManual, setSlugManual] = useState(false);

  const carregarPlanos = useCallback(async (preferredId = null) => {
    setLoading(true);
    try {
      const data = await getAdminPlanos();
      setPlanos(data);
      if (data.length > 0) {
        const plano = data.find((item) => item.id === preferredId) || data[0];
        setEditingId(plano.id);
        setSlugManual(true);
        setForm({
          nome: plano.nome,
          slug: plano.slug ?? "",
          descricao: plano.descricao ?? "",
          preco_mensal: String(plano.preco_mensal ?? ""),
          preco_anual: String(plano.preco_anual ?? ""),
          duracao_dias: String(plano.duracao_dias ?? 30),
          duracao_trial_dias: String(plano.duracao_trial_dias ?? 7),
          max_usuarios: plano.max_usuarios != null ? String(plano.max_usuarios) : "",
          max_loteamentos: plano.max_loteamentos != null ? String(plano.max_loteamentos) : "",
          max_predios: plano.max_predios != null ? String(plano.max_predios) : "",
          destaque: plano.destaque ?? false,
          ordem: String(plano.ordem ?? 0),
          cor: plano.cor ?? "#3288e0",
          recursos: plano.recursos ?? [],
          ativo: plano.ativo ?? true,
        });
      } else {
        setEditingId(null);
        setSlugManual(false);
        setForm({ ...EMPTY_FORM, recursos: [] });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarPlanos(); }, [carregarPlanos]);

  // Auto-slug from nome (unless manually edited)
  useEffect(() => {
    if (!slugManual && !editingId) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.nome) }));
    }
  }, [form.nome, slugManual, editingId]);

  function loadPlanoForEdit(plano) {
    setEditingId(plano.id);
    setSlugManual(true);
    setError("");
    setSuccess("");
    setForm({
      nome: plano.nome,
      slug: plano.slug ?? "",
      descricao: plano.descricao ?? "",
      preco_mensal: String(plano.preco_mensal ?? ""),
      preco_anual: String(plano.preco_anual ?? ""),
      duracao_dias: String(plano.duracao_dias ?? 30),
      duracao_trial_dias: String(plano.duracao_trial_dias ?? 7),
      max_usuarios: plano.max_usuarios != null ? String(plano.max_usuarios) : "",
      max_loteamentos: plano.max_loteamentos != null ? String(plano.max_loteamentos) : "",
      max_predios: plano.max_predios != null ? String(plano.max_predios) : "",
      destaque: plano.destaque ?? false,
      ordem: String(plano.ordem ?? 0),
      cor: plano.cor ?? "#3288e0",
      recursos: plano.recursos ?? [],
      ativo: plano.ativo ?? true,
    });
  }

  function startNewPlan() {
    setEditingId(null);
    setSlugManual(false);
    setError("");
    setSuccess("");
    setForm({ ...EMPTY_FORM, recursos: [] });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim()) { setError("Informe o nome do plano."); return; }
    setError(""); setSuccess(""); setSaving(true);

    const payload = {
      nome: form.nome.trim(),
      slug: form.slug.trim() || undefined,
      descricao: form.descricao.trim() || undefined,
      preco_mensal: form.preco_mensal !== "" ? Number(form.preco_mensal) : 0,
      preco_anual: form.preco_anual !== "" ? Number(form.preco_anual) : 0,
      duracao_dias: Number(form.duracao_dias) || 30,
      duracao_trial_dias: Number(form.duracao_trial_dias) || 7,
      max_usuarios: form.max_usuarios !== "" ? Number(form.max_usuarios) : null,
      max_loteamentos: form.max_loteamentos !== "" ? Number(form.max_loteamentos) : null,
      max_predios: form.max_predios !== "" ? Number(form.max_predios) : null,
      destaque: form.destaque,
      ordem: Number(form.ordem) || 0,
      cor: form.cor || "#3288e0",
      recursos: form.recursos,
      ativo: form.ativo,
    };

    try {
      if (editingId) {
        await atualizarPlano(editingId, payload);
        setSuccess("Plano atualizado com sucesso!");
        await carregarPlanos(editingId);
      } else {
        const created = await criarPlano(payload);
        setSuccess("Plano criado com sucesso!");
        await carregarPlanos(created?.id);
      }
    } catch (err) {
      setError(err.message || "Erro ao salvar plano.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAtivo(plano) {
    setToggling(plano.id);
    try {
      await atualizarPlano(plano.id, { ativo: !plano.ativo });
      await carregarPlanos();
      if (editingId === plano.id) {
        setForm((prev) => ({ ...prev, ativo: !plano.ativo }));
      }
    } finally {
      setToggling(null);
    }
  }

  const sortedPlanos = useMemo(() => [...planos].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)), [planos]);

  return (
    <section className="list-page">
      <header className="list-page-head" style={{ marginBottom: "1.5rem" }}>
        <div>
          <div className="dash-eyebrow">CONFIGURAÇÕES</div>
          <h1 className="list-page-title">Planos de assinatura</h1>
          <p className="dash-sub">
            {planos.length} plano{planos.length !== 1 ? "s" : ""} cadastrado{planos.length !== 1 ? "s" : ""} ·
            {" "}{planos.filter((p) => p.ativo).length} ativo{planos.filter((p) => p.ativo).length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="sec-tool-btn"
            onClick={startNewPlan}
            disabled={saving}
            style={{ background: "#3288e0", borderColor: "#3288e0", color: "#fff" }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Novo plano
          </button>
          <button className="sec-tool-btn" onClick={() => carregarPlanos(editingId)} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76L14 2v4h-4l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Atualizar
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 2fr) 3fr", gap: "1.5rem", alignItems: "start" }}>
        {/* ── Formulário ── */}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14,
          padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#0d1b3e" }}>
                {editingId ? "Editar plano" : "Novo plano"}
              </h2>
              {editingId && (
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#9ca3af" }}>
                  ID #{editingId}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Nome */}
            <FieldGroup label="Nome do plano">
              <input
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                maxLength={100}
                placeholder="Ex: PROFISSIONAL"
                style={inputStyle}
                required
              />
            </FieldGroup>

            {/* Slug */}
            <FieldGroup label={`Slug (identificador único)`} hint={form.slug || "gerado automaticamente"}>
              <input
                value={form.slug}
                onChange={(e) => { setSlugManual(true); setForm((p) => ({ ...p, slug: e.target.value })); }}
                maxLength={80}
                placeholder="profissional"
                style={inputStyle}
                disabled={!!editingId}
              />
            </FieldGroup>

            {/* Preços */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldGroup label="Preço mensal (R$)">
                <input type="number" min="0" step="0.01" value={form.preco_mensal} onChange={(e) => setForm((p) => ({ ...p, preco_mensal: e.target.value }))} placeholder="199,00" style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="Preço anual (R$)">
                <input type="number" min="0" step="0.01" value={form.preco_anual} onChange={(e) => setForm((p) => ({ ...p, preco_anual: e.target.value }))} placeholder="1990,00" style={inputStyle} />
              </FieldGroup>
            </div>

            {/* Duração */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldGroup label="Duração (dias)" hint="30 = mensal">
                <input type="number" min="1" value={form.duracao_dias} onChange={(e) => setForm((p) => ({ ...p, duracao_dias: e.target.value }))} style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="Trial (dias)">
                <input type="number" min="0" value={form.duracao_trial_dias} onChange={(e) => setForm((p) => ({ ...p, duracao_trial_dias: e.target.value }))} style={inputStyle} />
              </FieldGroup>
            </div>

            {/* Limites */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <FieldGroup label="Max usuários" hint="vazio = ilimitado">
                <input type="number" min="1" value={form.max_usuarios} onChange={(e) => setForm((p) => ({ ...p, max_usuarios: e.target.value }))} placeholder="∞" style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="Max loteamentos" hint="vazio = ilimitado">
                <input type="number" min="1" value={form.max_loteamentos} onChange={(e) => setForm((p) => ({ ...p, max_loteamentos: e.target.value }))} placeholder="∞" style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="Max prédios" hint="vazio = ilimitado">
                <input type="number" min="1" value={form.max_predios} onChange={(e) => setForm((p) => ({ ...p, max_predios: e.target.value }))} placeholder="∞" style={inputStyle} />
              </FieldGroup>
            </div>

            {/* Cor + Ordem */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
              <FieldGroup label="Cor de destaque">
                <ColorField value={form.cor} onChange={(v) => setForm((p) => ({ ...p, cor: v }))} />
              </FieldGroup>
              <FieldGroup label="Ordem">
                <input type="number" min="0" value={form.ordem} onChange={(e) => setForm((p) => ({ ...p, ordem: e.target.value }))} style={inputStyle} />
              </FieldGroup>
            </div>

            {/* Descrição */}
            <FieldGroup label="Descrição">
              <textarea value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} rows={2} maxLength={1000} placeholder="Descrição breve do plano..." style={{ ...inputStyle, resize: "vertical" }} />
            </FieldGroup>

            {/* Recursos */}
            <FieldGroup label="Recursos / Features">
              <RecursosField value={form.recursos} onChange={(v) => setForm((p) => ({ ...p, recursos: v }))} />
            </FieldGroup>

            {/* Checkboxes */}
            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: "0.875rem", color: "#374151" }}>
                <input type="checkbox" checked={form.destaque} onChange={(e) => setForm((p) => ({ ...p, destaque: e.target.checked }))} />
                ⭐ Destaque (recomendado)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: "0.875rem", color: "#374151" }}>
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} />
                Ativo
              </label>
            </div>

            {error && (
              <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 7, padding: "8px 12px", color: "#dc2626", fontSize: "0.875rem" }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 7, padding: "8px 12px", color: "#15803d", fontSize: "0.875rem" }}>
                {success}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={saving} style={{ ...btnPrimStyle, flex: 1, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Salvando..." : editingId ? "Atualizar plano" : "Criar plano"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Lista de planos ── */}
        <div>
          {loading ? (
            <div className="list-empty">Carregando planos...</div>
          ) : sortedPlanos.length === 0 ? (
            <div className="list-empty">Nenhum plano cadastrado.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {sortedPlanos.map((plano) => (
                <PlanoCard
                  key={plano.id}
                  plano={plano}
                  selected={editingId === plano.id}
                  onClick={() => loadPlanoForEdit(plano)}
                  onToggleAtivo={handleToggleAtivo}
                  toggling={toggling}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Sub-componentes auxiliares ────────────────────────────────────────────────

function FieldGroup({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>{label}</span>
        {hint && <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

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
  padding: "9px 16px",
  background: "#3288e0",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.875rem",
};

const btnAddStyle = {
  padding: "8px 12px",
  background: "#f3f4f6",
  color: "#374151",
  border: "1px solid #e5e7eb",
  borderRadius: 7,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
};
