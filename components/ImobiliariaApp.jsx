"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header, Sidebar } from "./Chrome";
import { Dashboard } from "./Dashboard";
import { LotCard } from "./LotCard";
import { MapEditor } from "./MapEditor";
import { MapView, STATUS_COLORS } from "./MapView";
import { ClienteManagement, formatCpfCnpj } from "./ClienteManagement";
import { SaleDialog } from "./SaleDialog";
import { AdminPanel } from "./AdminPanel";
import {
  TweakColor,
  TweakRadio,
  TweakSection,
  TweakToggle,
  TweaksPanel,
  useTweaks,
} from "./TweaksPanel";
import {
  createCliente,
  createMotivoCancelamento,
  createUser,
  cancelarVenda,
  createLoteamento,
  computeMetrics,
  flattenLots,
  getCancelamentosLog,
  getClientes,
  getMotivosCancelamento,
  getUsers,
  getLoteamentos,
  getLoteamento,
  saveEditor,
  updateMotivoCancelamento,
  updateLoteStatus,
} from "../lib/api";
import { fmtBRL, fmtBRLShort, statusLabel } from "../lib/data";
import { useAuth } from "../context/AuthContext";

const TWEAK_DEFAULTS = {
  mapTheme: "claro",
  cardVariant: "detalhado",
  accent: "#3288e0",
  showPrices: true,
  compactSidebar: false,
};

const canCreateLoteamentoByRole = (role) => role === "admin";
const canEditLoteamentoByRole = (role) => role === "admin" || role === "gerente";
const canSellByRole = (role) => ["admin", "gerente", "vendedor"].includes(role);

export default function ImobiliariaApp() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState("dashboard");
  const [activeLoteamentoId, setActiveLoteamentoId] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [editorLoteamento, setEditorLoteamento] = useState(null);

  // Dados reais do banco
  const [loteamentos, setLoteamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [motivosCancelamento, setMotivosCancelamento] = useState([]);
  const [motivosLoading, setMotivosLoading] = useState(false);
  const [cancelamentosLog, setCancelamentosLog] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saleDraft, setSaleDraft] = useState(null);
  const [clienteReturnSale, setClienteReturnSale] = useState(null);

  const mapContainerRef = useRef(null);

  // Ouve evento de sessão expirada emitido pelo api.js
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      router.replace("/?login=1");
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [logout, router]);

  // ── Fetch inicial e refresh ─────────────────────────────────────────────

  const fetchLoteamentos = useCallback(async () => {
    try {
      const data = await getLoteamentos();
      setLoteamentos(data);
    } catch (err) {
      showToast("Erro ao carregar loteamentos: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoteamentos();
  }, [fetchLoteamentos]);

  const fetchUsers = useCallback(async () => {
    if (user?.role !== "admin") {
      setUsuarios([]);
      return;
    }

    setUsersLoading(true);
    try {
      const data = await getUsers();
      setUsuarios(data);
    } catch (err) {
      showToast("Erro ao carregar usuarios: " + err.message, "error");
    } finally {
      setUsersLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchClientes = useCallback(async (search = "") => {
    setClientesLoading(true);
    try {
      const data = await getClientes(search);
      setClientes(data);
      return data;
    } catch (err) {
      showToast("Erro ao carregar clientes: " + err.message, "error");
      return [];
    } finally {
      setClientesLoading(false);
    }
  }, []);

  const fetchMotivosCancelamento = useCallback(async () => {
    if (user?.role !== "admin") {
      setMotivosCancelamento([]);
      return [];
    }

    setMotivosLoading(true);
    try {
      const data = await getMotivosCancelamento();
      setMotivosCancelamento(data);
      return data;
    } catch (err) {
      showToast("Erro ao carregar motivos: " + err.message, "error");
      return [];
    } finally {
      setMotivosLoading(false);
    }
  }, [user?.role]);

  const fetchCancelamentosLog = useCallback(async () => {
    if (user?.role !== "admin") {
      setCancelamentosLog([]);
      return [];
    }

    setLogsLoading(true);
    try {
      const data = await getCancelamentosLog();
      setCancelamentosLog(data);
      return data;
    } catch (err) {
      showToast("Erro ao carregar cancelamentos: " + err.message, "error");
      return [];
    } finally {
      setLogsLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchMotivosCancelamento();
    fetchCancelamentosLog();
  }, [fetchMotivosCancelamento, fetchCancelamentosLog]);

  // Recarrega um loteamento específico e atualiza a lista local
  const refreshLoteamento = useCallback(async (id) => {
    try {
      const updated = await getLoteamento(id);
      setLoteamentos((prev) =>
        prev.map((l) => (l.id === id ? updated : l))
      );
      return updated;
    } catch (err) {
      showToast("Erro ao atualizar: " + err.message, "error");
    }
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const onCreateUser = async (data) => {
    const created = await createUser(data);
    setUsuarios((prev) =>
      [created, ...prev].sort((a, b) =>
        (a.nome || a.email || "").localeCompare(b.nome || b.email || "", "pt-BR")
      )
    );
    showToast("Usuario cadastrado com sucesso");
    return created;
  };

  const onCreateCliente = async (data) => {
    const created = await createCliente(data);
    setClientes((prev) =>
      [created, ...prev].sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR")
      )
    );
    showToast("Cliente cadastrado com sucesso");
    return created;
  };

  const onCreateMotivoCancelamento = async (data) => {
    const created = await createMotivoCancelamento(data);
    setMotivosCancelamento((prev) =>
      [created, ...prev].sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR")
      )
    );
    showToast("Motivo cadastrado com sucesso");
    return created;
  };

  const onUpdateMotivoCancelamento = async (id, data) => {
    const updated = await updateMotivoCancelamento(id, data);
    setMotivosCancelamento((prev) =>
      prev
        .map((item) => (item.id === updated.id ? updated : item))
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"))
    );
    showToast("Motivo atualizado");
    return updated;
  };

  const onCancelarVenda = async (data) => {
    const result = await cancelarVenda(data);
    const loteamentoId = result?.lote?.loteamento_id;
    if (loteamentoId) {
      await refreshLoteamento(loteamentoId);
    } else {
      await fetchLoteamentos();
    }
    await fetchCancelamentosLog();
    showToast("Venda cancelada e removida dos indicadores");
    return result;
  };

  // ── Navegação ───────────────────────────────────────────────────────────

  const loteamento = activeLoteamentoId
    ? loteamentos.find((l) => l.id === activeLoteamentoId) || null
    : null;
  const metrics = computeMetrics(loteamentos);
  const canCreateLoteamento = canCreateLoteamentoByRole(user?.role);
  const canEditLoteamento = canEditLoteamentoByRole(user?.role);
  const canSellLot = canSellByRole(user?.role);

  useEffect(() => {
    if (view === "admin" && user?.role !== "admin") {
      setView("dashboard");
    }
  }, [view, user?.role]);

  const onOpenLoteamento = (id) => {
    setActiveLoteamentoId(id);
    setSelectedLot(null);
    setView("map");
  };

  const onBackToDash = () => {
    setView("dashboard");
    setSelectedLot(null);
  };

  // ── Editor ──────────────────────────────────────────────────────────────

  const onOpenEditor = (existing) => {
    if (!existing && !canCreateLoteamento) {
      showToast("Apenas administradores podem criar loteamentos", "error");
      return;
    }

    if (existing && !canEditLoteamento) {
      showToast("Seu usuario pode apenas visualizar e vender lotes", "error");
      return;
    }

    setEditorLoteamento(existing || null);
    setView("editor");
  };

  const onSaveEditor = async (shapes, meta) => {
    if (!editorLoteamento?.id && !canCreateLoteamento) {
      showToast("Apenas administradores podem criar loteamentos", "error");
      return;
    }

    if (editorLoteamento?.id && !canEditLoteamento) {
      showToast("Seu usuario nao pode editar loteamentos", "error");
      return;
    }

    setSaving(true);
    try {
      let targetId = editorLoteamento?.id;

      // Novo loteamento — cria no banco primeiro
      if (!targetId) {
        const created = await createLoteamento({ nome: meta.nome || "Novo Loteamento" });
        targetId = created.id;
      }

      const result = await saveEditor(targetId, shapes, meta);

      // Atualiza a lista local com o loteamento salvo
      setLoteamentos((prev) => {
        const exists = prev.find((l) => l.id === result.id);
        return exists
          ? prev.map((l) => (l.id === result.id ? result : l))
          : [...prev, result];
      });

      const lotCount = (result.lots || []).length;
      showToast(`"${result.nome}" salvo com ${lotCount} lotes`);
      setActiveLoteamentoId(result.id);
      setView("map");
    } catch (err) {
      showToast("Erro ao salvar: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const onNavigate = (id) => {
    if (id === "admin" && user?.role !== "admin") {
      showToast("Apenas administradores podem acessar o Admin", "error");
      return;
    }

    if (id === "dashboard" || id === "loteamentos") {
      setView(id);
      setSelectedLot(null);
    } else {
      setView(id);
      setSelectedLot(null);
    }
  };

  // Ações nos lotes

  const openSaleDialog = (lot, loteamentoId = activeLoteamentoId, targetStatus = "vendido") => {
    if (!lot.db_id) return;
    if (!canSellLot) {
      showToast("Seu usuario nao pode vender lotes", "error");
      return;
    }
    setSaleDraft({ lot, loteamentoId, returnView: view, cliente: null, targetStatus });
    fetchClientes("");
  };

  const confirmLotStatus = async (cliente) => {
    if (!saleDraft?.lot?.db_id || !cliente?.id) return;
    try {
      const { lot, loteamentoId, targetStatus = "vendido" } = saleDraft;
      await updateLoteStatus(lot.db_id, targetStatus, cliente.id);
      const updated = await refreshLoteamento(loteamentoId);
      if (updated && selectedLot && loteamentoId === activeLoteamentoId) {
        const updatedLot = (updated.lots || []).find((l) => l.db_id === lot.db_id);
        if (updatedLot) setSelectedLot((prev) => ({ ...prev, lot: updatedLot }));
      }
      setSaleDraft(null);
      showToast(
        targetStatus === "reservado"
          ? `Lote ${lot.id} reservado para ${cliente.nome}`
          : `Lote ${lot.id} vendido para ${cliente.nome}`
      );
    } catch (err) {
      showToast("Erro: " + err.message, "error");
    }
  };

  const goToClienteCadastroFromSale = () => {
    setClienteReturnSale(saleDraft);
    setSaleDraft(null);
    setView("clientes");
    fetchClientes("");
  };

  const finishClienteCadastroFromSale = (cliente) => {
    if (!clienteReturnSale) return;
    const nextSaleDraft = { ...clienteReturnSale, cliente };
    if (nextSaleDraft.loteamentoId) setActiveLoteamentoId(nextSaleDraft.loteamentoId);
    setView(nextSaleDraft.returnView || "lotes");
    setSaleDraft(nextSaleDraft);
    setClienteReturnSale(null);
    fetchClientes("");
  };

  // ── Click no lote (posicionamento do card flutuante) ──────────────────

  const onLotClick = (lot) => {
    const container = mapContainerRef.current;
    if (!container) return setSelectedLot({ lot, position: null });

    const svg = container.querySelector("svg");
    if (!svg) return setSelectedLot({ lot, position: null });

    const pt = svg.createSVGPoint();
    pt.x = lot.center[0];
    pt.y = lot.center[1];
    const screenCtm = svg.getScreenCTM();
    if (!screenCtm) return setSelectedLot({ lot, position: null });
    const transformed = pt.matrixTransform(screenCtm);
    const containerRect = container.getBoundingClientRect();

    const px = transformed.x - containerRect.left;
    const py = transformed.y - containerRect.top;

    const cardWidth =
      t.cardVariant === "premium" ? 340 : t.cardVariant === "detalhado" ? 320 : 260;
    const placeLeft = px > containerRect.width - cardWidth - 60;
    const offset = 28;
    const left = placeLeft ? px - cardWidth - offset : px + offset;
    const top = Math.min(Math.max(20, py - 60), containerRect.height - 380);

    setSelectedLot({
      lot,
      position: { left: `${left}px`, top: `${top}px`, transform: "none" },
    });
  };

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
  }, [t.accent]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className={
        "app" +
        (t.compactSidebar ? " app-compact" : "") +
        (view === "editor" ? " app-editor" : "")
      }
    >
      <Sidebar
        view={view}
        onNavigate={onNavigate}
        counts={{
          loteamentos: loteamentos.length,
          lotes: metrics.total,
          vendas: metrics.ven,
          clientes: clientes.length,
          usuarios: usuarios.length,
        }}
        user={user}
        onLogout={() => { logout(); router.replace('/'); }}
      />
      <main className="main">
        {view !== "editor" && (
          <Header
            view={view}
            loteamentoNome={loteamento?.nome}
            onBack={onBackToDash}
          />
        )}
        <div className="content">
          {(view === "dashboard" || view === "loteamentos") && (
            <Dashboard
              loteamentos={loteamentos}
              loading={loading}
              onOpenLoteamento={onOpenLoteamento}
              onOpenEditor={onOpenEditor}
              onRefresh={fetchLoteamentos}
              canCreateLoteamento={canCreateLoteamento}
              canEditLoteamento={canEditLoteamento}
            />
          )}

          {view === "lotes" && (
            <LotsView
              loteamentos={loteamentos}
              loading={loading}
              onOpenLoteamento={onOpenLoteamento}
              onStatusAction={(lot, status) => openSaleDialog(lot, lot.loteamentoId, status)}
              onOpenEditor={onOpenEditor}
              canCreateLoteamento={canCreateLoteamento}
            />
          )}

          {view === "vendas" && (
            <SalesView
              loteamentos={loteamentos}
              loading={loading}
              onOpenLoteamento={onOpenLoteamento}
            />
          )}

          {view === "clientes" && (
            <ClienteManagement
              clientes={clientes}
              loading={clientesLoading}
              onRefresh={fetchClientes}
              onCreate={onCreateCliente}
              saleContext={clienteReturnSale}
              onCancelSaleContext={(createdCliente) => {
                if (createdCliente) {
                  finishClienteCadastroFromSale(createdCliente);
                  return;
                }
                if (clienteReturnSale) {
                  setSaleDraft(clienteReturnSale);
                  setView(clienteReturnSale.returnView || "lotes");
                  setClienteReturnSale(null);
                }
              }}
            />
          )}

          {view === "admin" && user?.role === "admin" && (
            <AdminPanel
              user={user}
              users={usuarios}
              usersLoading={usersLoading}
              onRefreshUsers={fetchUsers}
              onCreateUser={onCreateUser}
              loteamentos={loteamentos}
              motivos={motivosCancelamento}
              motivosLoading={motivosLoading}
              onRefreshMotivos={fetchMotivosCancelamento}
              onCreateMotivo={onCreateMotivoCancelamento}
              onUpdateMotivo={onUpdateMotivoCancelamento}
              cancelamentosLog={cancelamentosLog}
              logsLoading={logsLoading}
              onRefreshLogs={fetchCancelamentosLog}
              onCancelarVenda={onCancelarVenda}
            />
          )}

          {view === "map" && loteamento && (
            <div className="map-container" ref={mapContainerRef}>
              <MapView
                loteamento={loteamento}
                mapTheme={t.mapTheme}
                onLotClick={onLotClick}
                selectedLotId={selectedLot?.lot?.id}
              />
              {selectedLot && (
                <LotCard
                  lot={selectedLot.lot}
                  loteamento={loteamento}
                  variant={t.cardVariant}
                  position={selectedLot.position}
                  onClose={() => setSelectedLot(null)}
                  onStatusChange={(status) => openSaleDialog(selectedLot.lot, activeLoteamentoId, status)}
                />
              )}
              <LoteamentoSwitcher
                loteamentos={loteamentos}
                current={loteamento}
                onSwitch={(id) => onOpenLoteamento(id)}
                onEdit={() => onOpenEditor(loteamento)}
                canEditLoteamento={canEditLoteamento}
              />
            </div>
          )}

          {view === "editor" && (
            <MapEditor
              initialLoteamento={editorLoteamento}
              onBack={() =>
                setView(editorLoteamento ? "map" : "dashboard")
              }
              onSave={onSaveEditor}
              saving={saving}
            />
          )}

          {view !== "dashboard" &&
            view !== "loteamentos" &&
            view !== "map" &&
            view !== "lotes" &&
            view !== "vendas" &&
            view !== "clientes" &&
            view !== "admin" &&
            view !== "editor" && <EmptyState view={view} />}
        </div>
      </main>

      {saleDraft && (
        <SaleDialog
          lot={saleDraft.lot}
          loteamento={loteamentos.find((item) => item.id === saleDraft.loteamentoId)}
          actionStatus={saleDraft.targetStatus}
          clientes={clientes}
          loading={clientesLoading}
          initialClient={saleDraft.cliente}
          onSearch={fetchClientes}
          onClose={() => setSaleDraft(null)}
          onCreateClient={goToClienteCadastroFromSale}
          onConfirm={confirmLotStatus}
        />
      )}

      {toast && (
        <div className={"toast" + (toast.type === "error" ? " toast-error" : "")}>
          {toast.type !== "error" ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#3288e0" />
              <path
                d="M5 8l2 2 4-4"
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#ef4444" />
              <path
                d="M5 5l6 6M11 5l-6 6"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
          {toast.msg}
        </div>
      )}

      <TweaksPanel>
        <TweakSection label="Mapa" />
        <TweakRadio
          label="Estilo do mapa"
          value={t.mapTheme}
          options={["claro", "escuro", "satélite"]}
          onChange={(v) =>
            setTweak("mapTheme", v === "satélite" ? "satelite" : v)
          }
        />
        <TweakSection label="Card de detalhe do lote" />
        <TweakRadio
          label="Variação"
          value={t.cardVariant}
          options={["compacto", "detalhado", "premium"]}
          onChange={(v) => setTweak("cardVariant", v)}
        />
        <TweakSection label="Interface" />
        <TweakColor
          label="Cor de destaque"
          value={t.accent}
          options={[
            "#3288e0",
            "#2563eb",
            "#a16207",
            "#9333ea",
            "#0d9488",
          ]}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakToggle
          label="Sidebar compacta"
          value={t.compactSidebar}
          onChange={(v) => setTweak("compactSidebar", v)}
        />
      </TweaksPanel>
    </div>
  );
}

function LotsView({ loteamentos, loading, onOpenLoteamento, onStatusAction, onOpenEditor, canCreateLoteamento }) {
  const lots = flattenLots(loteamentos);

  return (
    <section className="list-page">
      <header className="list-page-head">
        <div>
          <div className="dash-eyebrow">LOTES</div>
          <h1 className="list-page-title">Lotes cadastrados</h1>
          <p className="dash-sub">Controle o estoque e registre vendas a partir dos lotes cadastrados.</p>
        </div>
        {canCreateLoteamento && (
          <button className="qa-btn qa-btn-primary" onClick={() => onOpenEditor?.(null)}>
            <span className="qa-ic" style={{ color: '#ffffff' }}>✎</span>
            Novo loteamento
          </button>
        )}
      </header>

      {loading ? (
        <div className="list-empty">Carregando lotes...</div>
      ) : lots.length === 0 ? (
        <div className="list-empty">
          <p>Nenhum lote cadastrado.</p>
          {canCreateLoteamento && (
            <button className="qa-btn qa-btn-primary" onClick={() => onOpenEditor?.(null)}>Criar loteamento</button>
          )}
        </div>
      ) : (
        <LotTable lots={lots} onOpenLoteamento={onOpenLoteamento} onStatusAction={onStatusAction} />
      )}
    </section>
  );
}

function SalesView({ loteamentos, loading, onOpenLoteamento }) {
  const lots = flattenLots(loteamentos);
  const soldLots = lots.filter((lot) => lot.status === "vendido");
  const total = soldLots.reduce((sum, lot) => sum + (Number(lot.preco) || 0), 0);

  return (
    <section className="list-page">
      <header className="list-page-head">
        <div>
          <div className="dash-eyebrow">VENDAS</div>
          <h1 className="list-page-title">Lotes vendidos</h1>
          <p className="dash-sub">{soldLots.length} vendas registradas · {fmtBRLShort(total)} em VGV realizado.</p>
        </div>
      </header>

      {loading ? (
        <div className="list-empty">Carregando vendas...</div>
      ) : soldLots.length === 0 ? (
        <div className="list-empty">Nenhuma venda registrada nos loteamentos carregados.</div>
      ) : (
        <LotTable lots={soldLots} onOpenLoteamento={onOpenLoteamento} salesOnly />
      )}
    </section>
  );
}

function LotTable({ lots, onOpenLoteamento, onStatusAction, salesOnly = false }) {
  return (
    <div className="lot-table-wrap">
      <table className="lot-table">
        <thead>
          <tr>
            <th>Lote</th>
            <th>Loteamento</th>
            <th>Quadra</th>
            <th>Área</th>
            <th>Valor</th>
            <th>Status</th>
            {salesOnly && <th>id_cliente</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot.db_id || `${lot.loteamentoId}-${lot.id}`}>
              <td><b className="lot-code">{lot.id}</b></td>
              <td>
                <button className="link-button" onClick={() => onOpenLoteamento?.(lot.loteamentoId)}>
                  {lot.loteamentoNome}
                </button>
                <div className="table-sub">{[lot.cidade, lot.estado].filter(Boolean).join('/') || 'Local não informado'}</div>
              </td>
              <td>{lot.quadra || '—'}</td>
              <td>{lot.area ? `${lot.area} m²` : '—'}</td>
              <td>{fmtBRL(lot.preco)}</td>
              <td><StatusBadge status={lot.status} /></td>
              {salesOnly && (
                <td>
                  <b className="lot-code">{lot.cliente_id || '-'}</b>
                  <div className="table-sub">
                    {lot.cliente ? `${lot.cliente.nome} - ${formatCpfCnpj(lot.cliente.cpf_cnpj)}` : 'Cliente nao vinculado'}
                  </div>
                </td>
              )}
              <td>
                <div className="table-actions">
                  <button className="table-action table-action-ghost" onClick={() => onOpenLoteamento?.(lot.loteamentoId)}>Mapa</button>
                  {!salesOnly && (
                    <>
                      {lot.status === "disponivel" && (
                        <button
                          className="table-action table-action-ghost"
                          disabled={!lot.db_id}
                          onClick={() => onStatusAction?.(lot, "reservado")}
                        >
                          Reservar
                        </button>
                      )}
                      <button
                        className="table-action"
                        disabled={lot.status === "vendido" || !lot.db_id}
                        onClick={() => onStatusAction?.(lot, "vendido")}
                      >
                        {lot.status === "vendido" ? "Vendido" : "Vender"}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.disponivel;
  return (
    <span className="status-pill" style={{ color: colors.label, background: colors.glow }}>
      <span style={{ background: colors.fill }} />
      {statusLabel(status)}
    </span>
  );
}

function LoteamentoSwitcher({ loteamentos, current, onSwitch, onEdit, canEditLoteamento }) {
  return (
    <div className="lt-switcher">
      <div className="lts-label">LOTEAMENTOS</div>
      {loteamentos.map((l) => (
        <button
          key={l.id}
          className={"lts-item" + (l.id === current.id ? " lts-item-active" : "")}
          onClick={() => l.id !== current.id && onSwitch(l.id)}
        >
          <span className="lts-dot" />
          <div className="lts-body">
            <div className="lts-name">{l.nome}</div>
            <div className="lts-meta">
              {(l.lots || []).length} lotes{[l.cidade, l.estado].filter(Boolean).length > 0 ? ` · ${[l.cidade, l.estado].filter(Boolean).join('/')}` : ''}
            </div>
          </div>
        </button>
      ))}
      {canEditLoteamento && (
        <>
          <div className="lts-divider" />
          <button className="lts-edit" onClick={onEdit}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M11 2l3 3-8 8H3v-3l8-8z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            Editar mapa do loteamento
          </button>
        </>
      )}
    </div>
  );
}

function EmptyState({ view }) {
  return (
    <div className="empty-state">
      <div className="empty-card">
        <div className="empty-eyebrow">INDISPONÍVEL</div>
        <h2>Seção "{view}"</h2>
        <p>
          O front está focado no cadastro de loteamentos, cadastro de lotes e vendas.
        </p>
      </div>
    </div>
  );
}
