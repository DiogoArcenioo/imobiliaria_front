"use client";

import { useMemo, useState } from "react";

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

export function UserManagement({ users = [], loading, onRefresh, onCreate, currentUser }) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.nome, user.login, user.email, user.telefone, ROLE_LABELS[user.role]]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [query, users]);

  const counts = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      },
      { total: 0, admin: 0, gerente: 0, vendedor: 0 }
    );
  }, [users]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
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

    if (!form.senha) {
      nextErrors.senha = "Informe a senha";
    } else if (form.senha.length < 8) {
      nextErrors.senha = "Minimo de 8 caracteres";
    }

    if (form.senha !== form.confirmar) {
      nextErrors.confirmar = "As senhas nao conferem";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setApiError("");

    try {
      await onCreate({
        nome: form.nome.trim(),
        login: form.login.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.replace(/\D/g, "") || undefined,
        role: form.role,
        senha: form.senha,
      });
      setForm(initialForm);
      setErrors({});
    } catch (err) {
      setApiError(err.message || "Erro ao cadastrar usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="list-page users-page">
      <header className="list-page-head users-head">
        <div>
          <div className="dash-eyebrow">USUARIOS</div>
          <h1 className="list-page-title">Cadastro de usuarios</h1>
          <p className="dash-sub">
            {loading
              ? "Carregando usuarios..."
              : `${counts.total} usuarios vinculados a esta empresa.`}
          </p>
        </div>
        <button className="sec-tool-btn" onClick={onRefresh} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76L14 2v4h-4l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Atualizar
        </button>
      </header>

      <section className="users-metrics">
        <UserMetric label="Total" value={counts.total} />
        <UserMetric label="Administradores" value={counts.admin} />
        <UserMetric label="Gerentes" value={counts.gerente} />
        <UserMetric label="Vendedores" value={counts.vendedor} />
      </section>

      <div className="users-layout">
        <form className="user-form-panel" onSubmit={handleSubmit}>
          <div className="user-form-head">
            <div>
              <h2>Novo usuario</h2>
              <p>O acesso criado entra automaticamente na empresa atual.</p>
            </div>
          </div>

          <Field label="Nome completo" error={errors.nome}>
            <input
              value={form.nome}
              onChange={(event) => setField("nome", event.target.value)}
              placeholder="Joao da Silva"
              maxLength={200}
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
              />
            </Field>

            <Field label="Funcao">
              <select value={form.role} onChange={(event) => setField("role", event.target.value)}>
                <option value="vendedor">Vendedor</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Administrador</option>
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
            />
          </Field>

          <Field label="Telefone">
            <input
              value={form.telefone}
              onChange={(event) => setField("telefone", maskPhone(event.target.value))}
              placeholder="(00) 00000-0000"
            />
          </Field>

          <div className="user-form-grid">
            <Field label="Senha" error={errors.senha}>
              <input
                type="password"
                value={form.senha}
                onChange={(event) => setField("senha", event.target.value)}
                placeholder="Minimo 8 caracteres"
                maxLength={72}
              />
            </Field>

            <Field label="Confirmar senha" error={errors.confirmar}>
              <input
                type="password"
                value={form.confirmar}
                onChange={(event) => setField("confirmar", event.target.value)}
                placeholder="Repita a senha"
                maxLength={72}
              />
            </Field>
          </div>

          {apiError && <div className="form-alert">{apiError}</div>}

          <button className="qa-btn qa-btn-primary user-submit" type="submit" disabled={saving}>
            {saving ? "Cadastrando..." : "Cadastrar usuario"}
          </button>
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
                    <th>Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.id}>
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
                      <td>{formatDate(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
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

function UserMetric({ label, value }) {
  return (
    <div className="user-metric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
