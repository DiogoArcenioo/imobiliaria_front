"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtBRL } from "../lib/data";
import { formatCpfCnpj, formatPhone } from "./ClienteManagement";

function clientLabel(cliente) {
  if (!cliente) return "";
  return `${cliente.nome} - ${formatCpfCnpj(cliente.cpf_cnpj)}`;
}

export function SaleDialog({
  lot,
  loteamento,
  actionStatus = "vendido",
  clientes = [],
  loading = false,
  initialClient,
  onSearch,
  onClose,
  onCreateClient,
  onConfirm,
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialClient || null);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const isReserva = actionStatus === "reservado";
  const actionLabel = isReserva ? "reserva" : "venda";
  const actionTitle = isReserva ? "RESERVAR LOTE" : "VENDER LOTE";
  const confirmLabel = isReserva ? "Confirmar reserva" : "Confirmar venda";

  useEffect(() => {
    setSelected(initialClient || null);
    setQuery(initialClient ? clientLabel(initialClient) : "");
  }, [initialClient]);

  useEffect(() => {
    const timeout = setTimeout(() => onSearch?.(query), 220);
    return () => clearTimeout(timeout);
  }, [query, onSearch]);

  const options = useMemo(() => {
    if (!query.trim()) return clientes.slice(0, 8);
    const q = query.toLowerCase();
    const digits = query.replace(/\D/g, "");
    return clientes.filter((cliente) =>
      [cliente.nome, cliente.cpf_cnpj, cliente.celular]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q) || String(value).includes(digits))
    ).slice(0, 8);
  }, [clientes, query]);

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await onConfirm(selected, isReserva ? observacao : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (!lot) return null;

  return (
    <div className="sale-modal-backdrop">
      <section className="sale-modal">
        <header className="sale-modal-head">
          <div>
            <div className="dash-eyebrow">{actionTitle}</div>
            <h2>Lote {lot.id}</h2>
            <p>{loteamento?.nome || "Loteamento"} - {fmtBRL(lot.preco)}</p>
          </div>
          <button className="sale-modal-close" onClick={onClose} aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="sale-client-search-row">
          <label className="sale-client-search">
            <span>Cliente</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
              }}
              placeholder="Buscar por nome, CPF ou CNPJ"
            />
          </label>
          <button className="qa-btn qa-btn-primary sale-new-client" onClick={onCreateClient}>
            Cadastrar cliente
          </button>
        </div>

        <div className="sale-client-results">
          {loading ? (
            <div className="sale-client-empty">Buscando clientes...</div>
          ) : options.length === 0 ? (
            <div className="sale-client-empty">Nenhum cliente encontrado.</div>
          ) : (
            options.map((cliente) => (
              <button
                key={cliente.id}
                className={"sale-client-option" + (selected?.id === cliente.id ? " sale-client-option-active" : "")}
                onClick={() => {
                  setSelected(cliente);
                  setQuery(clientLabel(cliente));
                }}
              >
                <span>
                  <b>{cliente.nome}</b>
                  <small>ID {cliente.id} - {formatCpfCnpj(cliente.cpf_cnpj)}</small>
                </span>
                <span>{formatPhone(cliente.celular)}</span>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="sale-selected-client">
            {isReserva ? "Reserva" : "Venda"} vinculada ao cliente <b>ID {selected.id}</b> - {selected.nome}
          </div>
        )}

        {isReserva && (
          <label className="sale-observacao-label">
            <span>Observação da negociação <small>(visível apenas para você, gerente e admin)</small></span>
            <textarea
              className="sale-observacao-textarea"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: cliente aguarda aprovação de financiamento, retorno em 30 dias..."
              rows={3}
              maxLength={2000}
            />
            <span className="sale-observacao-count">{observacao.length}/2000</span>
          </label>
        )}

        <footer className="sale-modal-actions">
          <button className="table-action table-action-ghost" onClick={onClose}>Cancelar</button>
          <button className="table-action" disabled={!selected || saving} onClick={handleConfirm}>
            {saving ? `Registrando ${actionLabel}...` : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
