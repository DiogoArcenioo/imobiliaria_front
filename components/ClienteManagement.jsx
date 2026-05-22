"use client";

import { useEffect, useMemo, useState } from "react";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const initialForm = {
  nome: "",
  cpf_cnpj: "",
  celular: "",
  tipo: "pessoa_fisica",
  email: "",
  telefone: "",
  rg_ie: "",
  data_nascimento: "",
  profissao: "",
  estado_civil: "",
  conjuge_nome: "",
  renda_mensal: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  observacoes: "",
};

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function formatCpfCnpj(value) {
  const n = onlyDigits(value).slice(0, 14);
  if (n.length <= 11) {
    return n
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatPhone(value) {
  const n = onlyDigits(value).slice(0, 11);
  if (n.length <= 10) {
    return n.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return n.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

function maskCep(value) {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d{0,3})/, "$1-$2");
}

function moneyToNumber(value) {
  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  return normalized ? Number(normalized) : undefined;
}

function initials(cliente) {
  return (cliente?.nome || "?")
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ClienteManagement({
  clientes = [],
  loading = false,
  onRefresh,
  onCreate,
  saleContext,
  onCancelSaleContext,
}) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onRefresh?.("");
  }, [onRefresh]);

  const filteredClientes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = onlyDigits(q);
    if (!q) return clientes;
    return clientes.filter((cliente) =>
      [cliente.nome, cliente.cpf_cnpj, cliente.celular, cliente.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q) || String(value).includes(digits))
    );
  }, [clientes, query]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setApiError("");
  }

  function validate() {
    const next = {};
    const doc = onlyDigits(form.cpf_cnpj);
    const celular = onlyDigits(form.celular);

    if (!form.nome.trim()) next.nome = "Nome obrigatorio";
    if (![11, 14].includes(doc.length)) next.cpf_cnpj = "Informe CPF ou CNPJ valido";
    if (celular.length < 10) next.celular = "Informe o celular";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "E-mail invalido";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setApiError("");
    try {
      const payload = {
        ...form,
        cpf_cnpj: onlyDigits(form.cpf_cnpj),
        celular: onlyDigits(form.celular),
        telefone: onlyDigits(form.telefone) || undefined,
        cep: onlyDigits(form.cep) || undefined,
        renda_mensal: moneyToNumber(form.renda_mensal),
      };
      const created = await onCreate(payload);
      setForm(initialForm);
      setErrors({});
      setQuery("");
      onRefresh?.("");
      if (saleContext) onCancelSaleContext?.(created);
    } catch (err) {
      setApiError(err.message || "Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="list-page clientes-page">
      <header className="list-page-head clientes-head">
        <div>
          <div className="dash-eyebrow">CLIENTES</div>
          <h1 className="list-page-title">Cadastro de clientes</h1>
          <p className="dash-sub">
            {saleContext
              ? `Cadastre o cliente para vender o lote ${saleContext.lot?.id}.`
              : "Mantenha os dados dos compradores prontos para vincular nas vendas."}
          </p>
        </div>
        {saleContext && (
          <button className="sec-tool-btn" onClick={() => onCancelSaleContext?.()}>
            Voltar para venda
          </button>
        )}
      </header>

      <div className="clientes-layout">
        <form className="cliente-form-panel" onSubmit={handleSubmit}>
          <div className="cliente-form-head">
            <div>
              <h2>Novo cliente</h2>
              <p>Nome, CPF/CNPJ e celular sao obrigatorios.</p>
            </div>
          </div>

          <div className="cliente-form-grid">
            <Field label="Nome / Razao social" error={errors.nome} span>
              <input value={form.nome} onChange={(e) => setField("nome", e.target.value)} maxLength={200} />
            </Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={(e) => setField("tipo", e.target.value)}>
                <option value="pessoa_fisica">Pessoa fisica</option>
                <option value="pessoa_juridica">Pessoa juridica</option>
              </select>
            </Field>
            <Field label="CPF/CNPJ" error={errors.cpf_cnpj}>
              <input value={form.cpf_cnpj} onChange={(e) => setField("cpf_cnpj", formatCpfCnpj(e.target.value))} />
            </Field>
            <Field label="Celular" error={errors.celular}>
              <input value={form.celular} onChange={(e) => setField("celular", formatPhone(e.target.value))} />
            </Field>
            <Field label="Telefone">
              <input value={form.telefone} onChange={(e) => setField("telefone", formatPhone(e.target.value))} />
            </Field>
            <Field label="E-mail" error={errors.email} span>
              <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </Field>
            <Field label="RG / IE">
              <input value={form.rg_ie} onChange={(e) => setField("rg_ie", e.target.value)} maxLength={30} />
            </Field>
            <Field label="Nascimento / abertura">
              <input type="date" value={form.data_nascimento} onChange={(e) => setField("data_nascimento", e.target.value)} />
            </Field>
            <Field label="Profissao">
              <input value={form.profissao} onChange={(e) => setField("profissao", e.target.value)} maxLength={120} />
            </Field>
            <Field label="Estado civil">
              <input value={form.estado_civil} onChange={(e) => setField("estado_civil", e.target.value)} maxLength={40} />
            </Field>
            <Field label="Conjuge">
              <input value={form.conjuge_nome} onChange={(e) => setField("conjuge_nome", e.target.value)} maxLength={200} />
            </Field>
            <Field label="Renda mensal">
              <input value={form.renda_mensal} onChange={(e) => setField("renda_mensal", e.target.value)} placeholder="0,00" />
            </Field>
          </div>

          <div className="cliente-form-section">Endereco</div>
          <div className="cliente-form-grid">
            <Field label="CEP">
              <input value={form.cep} onChange={(e) => setField("cep", maskCep(e.target.value))} />
            </Field>
            <Field label="Endereco" span>
              <input value={form.endereco} onChange={(e) => setField("endereco", e.target.value)} maxLength={255} />
            </Field>
            <Field label="Numero">
              <input value={form.numero} onChange={(e) => setField("numero", e.target.value)} maxLength={20} />
            </Field>
            <Field label="Complemento">
              <input value={form.complemento} onChange={(e) => setField("complemento", e.target.value)} maxLength={100} />
            </Field>
            <Field label="Bairro">
              <input value={form.bairro} onChange={(e) => setField("bairro", e.target.value)} maxLength={200} />
            </Field>
            <Field label="Cidade">
              <input value={form.cidade} onChange={(e) => setField("cidade", e.target.value)} maxLength={200} />
            </Field>
            <Field label="UF">
              <select value={form.estado} onChange={(e) => setField("estado", e.target.value)}>
                <option value="">UF</option>
                {ESTADOS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </Field>
            <Field label="Observacoes" span>
              <textarea value={form.observacoes} onChange={(e) => setField("observacoes", e.target.value)} rows={3} />
            </Field>
          </div>

          {apiError && <div className="form-alert">{apiError}</div>}
          <button className="qa-btn qa-btn-primary cliente-submit" type="submit" disabled={saving}>
            {saving ? "Salvando..." : saleContext ? "Salvar e voltar para venda" : "Cadastrar cliente"}
          </button>
        </form>

        <section className="clientes-list-panel">
          <div className="clientes-list-tools">
            <div>
              <h2>Clientes cadastrados</h2>
              <p>{filteredClientes.length} registros exibidos</p>
            </div>
            <div className="users-search">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, CPF ou CNPJ..."
              />
            </div>
          </div>

          {loading ? (
            <div className="list-empty">Carregando clientes...</div>
          ) : filteredClientes.length === 0 ? (
            <div className="list-empty">Nenhum cliente encontrado.</div>
          ) : (
            <div className="lot-table-wrap clientes-table-wrap">
              <table className="lot-table clientes-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>CPF/CNPJ</th>
                    <th>Celular</th>
                    <th>Cidade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td>
                        <div className="cliente-cell">
                          <span className="user-avatar-sm">{initials(cliente)}</span>
                          <span>
                            <b>{cliente.nome}</b>
                            <small>ID {cliente.id}{cliente.email ? ` - ${cliente.email}` : ""}</small>
                          </span>
                        </div>
                      </td>
                      <td><span className="user-login">{formatCpfCnpj(cliente.cpf_cnpj)}</span></td>
                      <td>{formatPhone(cliente.celular)}</td>
                      <td>{[cliente.cidade, cliente.estado].filter(Boolean).join("/") || "-"}</td>
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

function Field({ label, error, span, children }) {
  return (
    <label className={"cliente-field" + (span ? " cliente-field-span" : "")}>
      <span>{label}</span>
      {children}
      {error && <small>{error}</small>}
    </label>
  );
}
