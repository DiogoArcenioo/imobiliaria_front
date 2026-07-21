"use client";

import { useMemo, useState } from "react";
import { toggleUserAtivo } from "../lib/api";
import { APP_MODULES, DEFAULT_VENDEDOR_MODULES, normalizeModules } from "../lib/modules";

const ROLE_LABELS = {
  admin: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
};

const initialForm = {
  nome: "",
  login: "",
  email: "",
  telefone: "",
  role: "vendedor",
  modulos_permitidos: DEFAULT_VENDEDOR_MODULES,
  senha: "",
  confirmar: "",
};

function maskPhone(value) {
  const n = value.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 10) {
    return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

function formatPhone(value) {
  if (!value) return "-";
  return maskPhone(value);
}

function initials(user) {
  if (user?.nome) {
    return user.nome
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return user?.email?.[0]?.toUpperCase() || "?";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

export function UserManagement({
  users = [],
  loading,
  onRefresh,
  onCreate,
  onUpdate,
  currentUser,
  planoInfo = null,   // { max_usuarios, nome } — vindo da empresa/plano
  somenteLeitura = false,
}) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formStep, setFormStep] = useState("info");
  const [togglingId, setTogglingId] = useState(null);
  const [filtroAtivo, setFiltroAtivo] = useState('ativo');
  const [roleFilter, setRoleFilter] = useState('todos');

  const visibleUsers = useMemo(() => users.filter((u) => u.role !== "admin"), [users]);
  const activeUsers  = useMemo(() => visibleUsers.filter((u) => u.ativo !== false), [visibleUsers]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = visibleUsers;
    if (filtroAtivo === 'ativo') list = list.filter((u) => u.ativo !== false);
    else if (filtroAtivo === 'inativo') list = list.filter((u) => u.ativo === false);
    if (roleFilter !== 'todos') list = list.filter((u) => u.role === roleFilter);
    if (!q) return list;
    return list.filter((user) => {
      const moduleLabels = normalizeModules(user.modulos_permitidos, DEFAULT_VENDEDOR_MODULES)
        .map((id) => APP_MODULES.find((module) => module.id === id)?.label)
        .filter(Boolean);
      return [user.nome, user.login, user.email, user.telefone, ROLE_LABELS[user.role], ...moduleLabels]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [query, visibleUsers, filtroAtivo, roleFilter]);

  const counts = useMemo(() => {
    return visibleUsers.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.ativo !== false) acc.ativos += 1;
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      },
      { total: 0, ativos: 0, gerente: 0, vendedor: 0 }
    );
  }, [visibleUsers]);

  // Limite de plano atingido?
  const limitePlanAtingido = planoInfo?.max_usuarios != null
    && activeUsers.length >= planoInfo.max_usuarios;

  function setField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "role" && value === "vendedor" && normalizeModules(prev.modulos_permitidos).length === 0
        ? { modulos_permitidos: DEFAULT_VENDEDOR_MODULES }
        : {}),
    }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setApiError("");
  }

  function toggleModulo(moduleId) {
    setForm((prev) => {
      const current = normalizeModules(prev.modulos_permitidos);
      const next = current.includes(moduleId)
        ? (current.length > 1 ? current.filter((id) => id !== moduleId) : current)
        : [...current, moduleId];
      return { ...prev, modulos_permitidos: next };
    });
    setApiError("");
  }

  function startEdit(user) {
    setEditingUser(user);
    setFormStep("info");
    setForm({
      nome: user.nome || "",
      login: user.login || "",
      email: user.email || "",
      telefone: user.telefone ? maskPhone(user.telefone) : "",
      role: user.role || "vendedor",
      modulos_permitidos: normalizeModules(user.modulos_permitidos, DEFAULT_VENDEDOR_MODULES),
      senha: "",
      confirmar: "",
    });
    setErrors({});
    setApiError("");
  }

  function cancelEdit() {
    setEditingUser(null);
    setForm(initialForm);
    setFormStep("info");
    setErrors({});
    setApiError("");
  }

  function validate() {
    const nextErrors = {};

    if (!form.nome.trim()) nextErrors.nome = "Informe o nome";
    if (!form.login.trim()) {
      nextErrors.login = "Informe o login";
    } else if (!/^[a-zA-Z0-9._-]+$/.test(form.login)) {
      nextErrors.login = "Use letras, numeros, ponto, underline ou hifen";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Informe o e-mail";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = "E-mail invalido";
    }

    if (!editingUser) {
      if (!form.senha) {
        nextErrors.senha = "Informe a senha";
      } else if (form.senha.length < 8) {
        nextErrors.senha = "Minimo de 8 caracteres";
      }
    } else if (form.senha) {
      if (form.senha.length < 8) {
        nextErrors.senha = "Minimo de 8 caracteres";
      }
    }

    if (form.senha && form.senha !== form.confirmar) {
      nextErrors.confirmar = "As senhas nao conferem";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveUserForm() {
    if (!validate()) return;

    setSaving(true);
    setApiError("");

    try {
      if (editingUser) {
        const data = {
          nome: form.nome.trim(),
          login: form.login.trim().toLowerCase(),
          email: form.email.trim().toLowerCase(),
          telefone: form.telefone.replace(/\D/g, "") || undefined,
          role: form.role,
          modulos_permitidos: form.role === "vendedor" ? normalizeModules(form.modulos_permitidos) : [],
        };
        if (form.senha) data.senha = form.senha;
        await onUpdate(editingUser.id, data);
        setEditingUser(null);
        setForm(initialForm);
        setFormStep("info");
        setErrors({});
      } else {
        await onCreate({
          nome: form.nome.trim(),
          login: form.login.trim().toLowerCase(),
          email: form.email.trim().toLowerCase(),
          telefone: form.telefone.replace(/\D/g, "") || undefined,
          role: form.role,
          modulos_permitidos: form.role === "vendedor" ? normalizeModules(form.modulos_permitidos) : [],
          senha: form.senha,
        });
        setForm(initialForm);
        setFormStep("info");
        setErrors({});
      }
    } catch (err) {
      setApiError(err.message || (editingUser ? "Erro ao atualizar usuario" : "Erro ao cadastrar usuario"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await saveUserForm();
  }

  function goToAccessStep() {
    if (!validate()) return;
    setFormStep("access");
  }

  async function handleEditPrimaryAction() {
    if (form.role === "vendedor") {
      goToAccessStep();
      return;
    }
    await saveUserForm();
  }

  async function handleToggleAtivo(user) {
    if (togglingId) return;
    const novoAtivo = user.ativo === false ? true : false;
    setTogglingId(user.id);
    try {
      await toggleUserAtivo(user.id, novoAtivo);
      await onRefresh();
    } catch (err) {
      alert(err.message || "Erro ao alterar status do usuario");
    } finally {
      setTogglingId(null);
    }
  }

  const canWrite = !somenteLeitura;

  return (
    <section className="list-page users-page">
      <header className="list-page-head users-head">
        <div>
          <div className="dash-eyebrow">USUARIOS</div>
          <h1 className="list-page-title">Cadastro de usuarios</h1>
          <p className="dash-sub">
            {loading
              ? "Carregando usuarios..."
              : `${counts.total} usuarios vinculados · ${counts.ativos} ativos.`}
          </p>
        </div>
        <button className="sec-tool-btn" onClick={onRefresh} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76L14 2v4h-4l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Atualizar
        </button>
      </header>

      {/* Banner de somente leitura */}
      {!canWrite && (
        <div style={{
          background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10,
          padding: "12px 16px", marginBottom: "1rem",
          display: "flex", alignItems: "center", gap: 10,
          color: "#c2410c", fontSize: "0.875rem",
        }}>
          🔒 <strong>Modo somente leitura:</strong>&nbsp;Renove sua assinatura para cadastrar ou editar usuarios.
        </div>
      )}

      {/* Aviso de limite de plano */}
      {canWrite && limitePlanAtingido && (
        <div style={{
          background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 10,
          padding: "12px 16px", marginBottom: "1rem",
          display: "flex", alignItems: "center", gap: 10,
          color: "#dc2626", fontSize: "0.875rem",
        }}>
          ⚠️ Limite de usuarios do plano <strong>{planoInfo?.nome}</strong> atingido&nbsp;
          ({activeUsers.length}/{planoInfo.max_usuarios}). Desative usuarios inativos ou faça upgrade.
        </div>
      )}

      <section className="users-metrics">
        <UserMetric label="Total" value={counts.total} />
        <UserMetric label="Ativos" value={counts.ativos} />
        <UserMetric label="Gerentes" value={counts.gerente} />
        <UserMetric label="Vendedores" value={counts.vendedor} />
        {planoInfo?.max_usuarios != null && (
          <UserMetric
            label="Limite plano"
            value={`${activeUsers.length}/${planoInfo.max_usuarios}`}
            warn={limitePlanAtingido}
          />
        )}
      </section>

      <div className="users-layout">
        <form className="user-form-panel" onSubmit={handleSubmit}>
          <div className="user-form-head">
            <div>
              <h2>Novo usuario</h2>
              <p>Cadastre primeiro os dados de acesso e depois libere os módulos.</p>
            </div>
          </div>

          <UserFormSteps step={formStep} />

          {formStep === "info" && (
            <>
              <UserInfoFields
                form={form}
                errors={errors}
                setField={setField}
                canWrite={canWrite}
                currentUser={currentUser}
                editing={false}
              />
              {apiError && <div className="form-alert">{apiError}</div>}
              <button
                className="qa-btn qa-btn-primary user-submit"
                type="button"
                disabled={!canWrite || (!editingUser && limitePlanAtingido)}
                onClick={goToAccessStep}
              >
                Continuar para liberacao
              </button>
            </>
          )}

          {formStep === "access" && (
            <>
              {form.role === "vendedor" ? (
                <ModuleAccessPanel
                  selected={form.modulos_permitidos}
                  onToggle={toggleModulo}
                  disabled={!canWrite}
                />
              ) : (
                <FullAccessNotice role={form.role} />
              )}

              {apiError && <div className="form-alert">{apiError}</div>}

              <div className="user-form-actions">
                <button className="sec-tool-btn" type="button" onClick={() => setFormStep("info")}>
                  Voltar
                </button>
                <button
                  className="qa-btn qa-btn-primary user-submit"
                  type="submit"
                  disabled={saving || !canWrite || limitePlanAtingido}
                  title={!canWrite ? "Conta em modo somente leitura" : limitePlanAtingido ? "Limite de plano atingido" : ""}
                >
                  {saving ? "Cadastrando..." : "Cadastrar usuario"}
                </button>
              </div>
            </>
          )}
        </form>

        <section className="users-list-panel">
          <div className="users-list-tools">
            <div>
              <h2>Usuarios cadastrados</h2>
              <p>{filteredUsers.length} registros exibidos</p>
            </div>
            <div className="users-search">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar usuario..."
              />
            </div>
          </div>
          <div className="users-filter-row">
            <div className="users-filter-group">
              <span>Status</span>
              {[['ativo','Ativos'],['inativo','Inativos'],['todos','Todos']].map(([v, l]) => (
                <button key={v} type="button" className={filtroAtivo === v ? "active" : ""} onClick={() => setFiltroAtivo(v)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="users-filter-group">
              <span>Funcao</span>
              {[['todos','Todas'],['gerente','Gerentes'],['vendedor','Vendedores']].map(([v, l]) => (
                <button key={v} type="button" className={roleFilter === v ? "active" : ""} onClick={() => setRoleFilter(v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="list-empty">Carregando usuarios...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="list-empty">Nenhum usuario encontrado.</div>
          ) : (
            <div className="lot-table-wrap users-table-wrap">
              <table className="lot-table users-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Login</th>
                    <th>Telefone</th>
                    <th>Funcao</th>
                    <th>Módulos</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr
                      key={item.id}
                      className={editingUser?.id === item.id ? "users-row-editing" : ""}
                      style={{ opacity: item.ativo === false ? 0.55 : 1 }}
                    >
                      <td>
                        <div className="user-cell">
                          <span className="user-avatar-sm">{initials(item)}</span>
                          <span>
                            <b>{item.nome || item.email}</b>
                            <small>{item.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="user-login">{item.login || "-"}</span>
                        {item.id === currentUser?.id && <span className="user-self-pill">voce</span>}
                      </td>
                      <td>{formatPhone(item.telefone)}</td>
                      <td><RolePill role={item.role} /></td>
                      <td>
                        <ModuleSummary user={item} />
                      </td>
                      <td>
                        <AtivoTag ativo={item.ativo !== false} />
                      </td>
                      <td>
                        <div className="table-actions">
                          {canWrite && (currentUser?.role === "admin" || item.role !== "admin") && (
                            <>
                              <button
                                type="button"
                                className="table-action table-action-ghost"
                                onClick={() => startEdit(item)}
                              >
                                Editar
                              </button>
                              {/* Não permite desativar a si mesmo */}
                              {item.id !== currentUser?.id && (
                                <button
                                  type="button"
                                  className="table-action table-action-ghost"
                                  style={{ color: item.ativo === false ? "#15803d" : "#dc2626" }}
                                  onClick={() => handleToggleAtivo(item)}
                                  disabled={togglingId === item.id}
                                >
                                  {togglingId === item.id
                                    ? "..."
                                    : item.ativo === false ? "Ativar" : "Desativar"}
                                </button>
                              )}
                            </>
                          )}
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

      {editingUser && (
        <div className="user-edit-backdrop">
          <div
            className="user-edit-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="user-edit-head">
              <div>
                <div className="dash-eyebrow">EDITAR USUARIO</div>
                <h2>{editingUser.nome || editingUser.email}</h2>
                <p>{editingUser.email}</p>
              </div>
              <button type="button" className="modal-close" onClick={cancelEdit} aria-label="Fechar">
                ×
              </button>
            </div>

            {form.role === "vendedor" && <UserFormSteps step={formStep} />}

            {formStep === "info" ? (
              <>
                <UserInfoFields
                  form={form}
                  errors={errors}
                  setField={setField}
                  canWrite={canWrite}
                  currentUser={currentUser}
                  editing
                />
                {apiError && <div className="form-alert">{apiError}</div>}
                <div className="user-form-actions">
                  <button className="sec-tool-btn" type="button" onClick={cancelEdit}>Cancelar</button>
                  <button
                    className="qa-btn qa-btn-primary"
                    type="button"
                    onClick={handleEditPrimaryAction}
                    disabled={saving || !canWrite}
                  >
                    {form.role === "vendedor"
                      ? "Continuar"
                      : saving ? "Salvando..." : "Salvar alteracoes"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {form.role === "vendedor" ? (
                  <ModuleAccessPanel
                    selected={form.modulos_permitidos}
                    onToggle={toggleModulo}
                    disabled={!canWrite}
                  />
                ) : (
                  <FullAccessNotice role={form.role} />
                )}
                {apiError && <div className="form-alert">{apiError}</div>}
                <div className="user-form-actions">
                  <button className="sec-tool-btn" type="button" onClick={() => setFormStep("info")}>Voltar</button>
                  <button
                    className="qa-btn qa-btn-primary"
                    type="button"
                    onClick={saveUserForm}
                    disabled={saving || !canWrite}
                  >
                    {saving ? "Salvando..." : "Salvar alteracoes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function UserFormSteps({ step }) {
  return (
    <div className="user-stepper" aria-label="Etapas do cadastro">
      <span className={step === "info" ? "active" : "done"}>
        <b>1</b>
        Informacoes
      </span>
      <i />
      <span className={step === "access" ? "active" : ""}>
        <b>2</b>
        Liberacao
      </span>
    </div>
  );
}

function UserInfoFields({ form, errors, setField, canWrite, currentUser, editing }) {
  return (
    <>
      <Field label="Nome completo" error={errors.nome}>
        <input
          value={form.nome}
          onChange={(event) => setField("nome", event.target.value)}
          placeholder="Joao da Silva"
          maxLength={200}
          disabled={!canWrite}
        />
      </Field>

      <div className="user-form-grid">
        <Field label="Login" error={errors.login}>
          <input
            value={form.login}
            onChange={(event) =>
              setField("login", event.target.value.replace(/\s/g, "").toLowerCase())
            }
            placeholder="joaosilva"
            maxLength={100}
            disabled={!canWrite}
          />
        </Field>

        <Field label="Funcao">
          <select
            value={form.role}
            onChange={(event) => setField("role", event.target.value)}
            disabled={!canWrite}
          >
            <option value="vendedor">Vendedor</option>
            <option value="gerente">Gerente</option>
            {currentUser?.role === "admin" && (
              <option value="admin">Administrador</option>
            )}
          </select>
        </Field>
      </div>

      <Field label="E-mail" error={errors.email}>
        <input
          type="email"
          value={form.email}
          onChange={(event) => setField("email", event.target.value)}
          placeholder="usuario@empresa.com.br"
          maxLength={255}
          disabled={!canWrite}
        />
      </Field>

      <Field label="Telefone">
        <input
          value={form.telefone}
          onChange={(event) => setField("telefone", maskPhone(event.target.value))}
          placeholder="(00) 00000-0000"
          disabled={!canWrite}
        />
      </Field>

      <div className="user-form-grid">
        <Field label={editing ? "Nova senha (opcional)" : "Senha"} error={errors.senha}>
          <input
            type="password"
            value={form.senha}
            onChange={(event) => setField("senha", event.target.value)}
            placeholder={editing ? "Deixe em branco para nao alterar" : "Minimo 8 caracteres"}
            maxLength={72}
            disabled={!canWrite}
          />
        </Field>

        <Field label="Confirmar senha" error={errors.confirmar}>
          <input
            type="password"
            value={form.confirmar}
            onChange={(event) => setField("confirmar", event.target.value)}
            placeholder="Repita a senha"
            maxLength={72}
            disabled={!canWrite}
          />
        </Field>
      </div>
    </>
  );
}

function FullAccessNotice({ role }) {
  return (
    <div className="full-access-notice">
      <strong>{ROLE_LABELS[role] || "Usuario"} com acesso completo</strong>
      <span>Gerentes e administradores acessam todos os módulos operacionais permitidos para sua função.</span>
    </div>
  );
}

function ModuleAccessPanel({ selected, onToggle, disabled }) {
  const modules = normalizeModules(selected, DEFAULT_VENDEDOR_MODULES);

  return (
    <div className="module-access-panel">
      <div className="module-access-head">
        <div>
          <strong>Módulos liberados</strong>
          <span>Escolha quais telas aparecem para este vendedor.</span>
        </div>
        <span>{modules.length}/{APP_MODULES.length}</span>
      </div>
      <div className="module-access-grid">
        {APP_MODULES.map((module) => {
          const checked = modules.includes(module.id);
          return (
            <button
              key={module.id}
              type="button"
              className={"module-access-item" + (checked ? " active" : "")}
              onClick={() => onToggle(module.id)}
              disabled={disabled}
            >
              <span className="module-access-check">{checked ? "✓" : ""}</span>
              <span>
                <b>{module.label}</b>
                <small>{module.description}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModuleSummary({ user }) {
  if (user.role === "admin" || user.role === "gerente") {
    return <span className="module-summary-all">Acesso completo</span>;
  }
  const modules = normalizeModules(user.modulos_permitidos, DEFAULT_VENDEDOR_MODULES);
  const first = modules
    .slice(0, 2)
    .map((id) => APP_MODULES.find((module) => module.id === id)?.label)
    .filter(Boolean);
  return (
    <span className="module-summary">
      {modules.length === 0 ? "Nenhum módulo" : `${modules.length} módulos`}
      {first.length > 0 && <small>{first.join(", ")}{modules.length > first.length ? "..." : ""}</small>}
    </span>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="user-field">
      <span>{label}</span>
      {children}
      {error && <small>{error}</small>}
    </label>
  );
}

function RolePill({ role }) {
  return <span className={`role-pill role-${role || "vendedor"}`}>{ROLE_LABELS[role] || role}</span>;
}

function AtivoTag({ ativo }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 12, fontSize: "0.72rem", fontWeight: 600,
      background: ativo ? "#f0fdf4" : "#f9fafb",
      color: ativo ? "#15803d" : "#9ca3af",
      border: `1px solid ${ativo ? "#86efac" : "#e5e7eb"}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: ativo ? "#22c55e" : "#d1d5db" }} />
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

function UserMetric({ label, value, warn = false }) {
  return (
    <div className="user-metric" style={warn ? { borderColor: "#fca5a5" } : {}}>
      <span style={warn ? { color: "#dc2626" } : {}}>{label}</span>
      <b style={warn ? { color: "#dc2626" } : {}}>{value}</b>
    </div>
  );
}
