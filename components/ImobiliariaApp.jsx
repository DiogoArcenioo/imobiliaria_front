"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header, Sidebar } from "./Chrome";
import { Dashboard, LoteamentoCard } from "./Dashboard";
import { LotCard } from "./LotCard";
import { NegociacaoDrawer } from "./NegociacaoDrawer";
import { MapEditor } from "./MapEditor";
import { MapView, STATUS_COLORS } from "./MapView";
import { ClienteManagement, formatCpfCnpj } from "./ClienteManagement";
import { SaleDialog } from "./SaleDialog";
import { AdminPanel } from "./AdminPanel";
import { UserManagement } from "./UserManagement";
import { PredioManagement } from "./PredioManagement";
import { PredioWizard } from "./PredioWizard";
import { Building3DView } from "./Building3DView";
import { LocacoesPanel } from "./LocacoesPanel";
import { RelatoriosPanel } from "./RelatoriosPanel";
import { ComercialPanel } from "./ComercialPanel";
import { PlanosPagina } from "./PlanosPagina";
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
  updateUser,
  cancelarVenda,
  createLoteamento,
  toggleLoteamentoAtivo,
  computeMetrics,
  flattenLots,
  getCancelamentosLog,
  getClientes,
  getCurrentEmpresa,
  getEmpresas,
  getMotivosCancelamento,
  getTiposCancelamento,
  getUsers,
  getLoteamentos,
  getLoteamento,
  saveEditor,
  setAdminEmpresaOverride,
  updateEmpresaSettings,
  updateMotivoCancelamento,
  updateLoteStatus,
  updateLote,
  getPredios,
  getPredio,
  createPredio,
  updatePredio,
  saveFloorPlan,
  updateApartamentoStatus,
  updateApartamento,
  getLocacoes,
  getLocacoesResumo,
  encerrarLocacao,
} from "../lib/api";
import { fmtBRL, fmtBRLShort, statusLabel } from "../lib/data";
import { APP_MODULES, userHasModule } from "../lib/modules";
import { useAuth } from "../context/AuthContext";

const TWEAK_DEFAULTS = {
  mapTheme: "claro",
  cardVariant: "detalhado",
  accent: "#3288e0",
  showPrices: true,
  compactSidebar: false,
};

const canCreateLoteamentoByRole = (role) => role === "admin";
const canEditLoteamentoByRole = (role) => role === "admin";
const canSellByRole = (role) => ["admin", "gerente", "vendedor"].includes(role);

const VIEW_MODULE = {
  dashboard: "dashboard",
  loteamentos: "loteamentos",
  map: "loteamentos",
  editor: "loteamentos",
  predios: "predios",
  predio: "predios",
  locacoes: "locacoes",
  comercial: "comercial",
  lotes: "lotes",
  vendas: "vendas",
  clientes: "clientes",
  relatorios: "relatorios",
};

function firstAllowedView(user) {
  if (!user || user.role !== "vendedor") return "dashboard";
  return APP_MODULES.find((module) => userHasModule(user, module.id))?.id || "dashboard";
}

function userHasAnyModule(user, moduleIds) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "gerente") return true;
  return moduleIds.some((moduleId) => userHasModule(user, moduleId));
}

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
  const [tiposCancelamento, setTiposCancelamento] = useState([]);
  const [tiposLoading, setTiposLoading] = useState(false);
  const [motivosCancelamento, setMotivosCancelamento] = useState([]);
  const [motivosLoading, setMotivosLoading] = useState(false);
  const [cancelamentosLog, setCancelamentosLog] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saleDraft, setSaleDraft] = useState(null);
  const [clienteReturnSale, setClienteReturnSale] = useState(null);
  const [drawerLot, setDrawerLot] = useState(null);

  // Prédios
  const [predios, setPredios] = useState([]);
  const [prediosLoading, setPrediosLoading] = useState(false);
  const [activePredioId, setActivePredioId] = useState(null);
  const [showPredioWizard, setShowPredioWizard] = useState(false);
  const [editingAndar, setEditingAndar] = useState(false);
  const [locacoes, setLocacoes] = useState([]);
  const [locacoesResumo, setLocacoesResumo] = useState({});
  const [locacoesLoading, setLocacoesLoading] = useState(false);
  const [locacoesStatusFilter, setLocacoesStatusFilter] = useState('ativa');

  // Estados para seleção de empresa pelo admin
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [currentEmpresa, setCurrentEmpresa] = useState(null);
  const [avisoVencimento, setAvisoVencimento] = useState(null); // { dias, tipo: 'assinatura'|'trial' }

  const mapContainerRef = useRef(null);

  // Ouve evento de sessão expirada emitido pelo api.js
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('admin_empresa_id');
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
    if (
      user?.role !== 'admin' &&
      userHasAnyModule(user, ["dashboard", "loteamentos", "lotes", "vendas", "comercial"])
    ) {
      fetchLoteamentos();
    }
  }, [fetchLoteamentos, user]);

  useEffect(() => {
    if (!user || (user.role === 'admin' && !selectedEmpresa)) {
      setCurrentEmpresa(null);
      return;
    }

    getCurrentEmpresa()
      .then((empresa) => {
        setCurrentEmpresa(empresa);

        // Aviso de vencimento: mostra uma vez por sessão para não-admin
        if (!empresa || user.role === 'admin') return;
        const agora = new Date();
        const DIAS_AVISO = 7;

        const venc = empresa.venc_mensalidade ? new Date(empresa.venc_mensalidade) : null;
        const trial = empresa.trial_ends_at ? new Date(empresa.trial_ends_at) : null;

        const dataReferencia = venc && venc > agora ? venc : (!venc && trial && trial > agora ? trial : null);
        const tipo = (venc && venc > agora) ? 'assinatura' : 'trial';

        if (dataReferencia) {
          const diffMs = dataReferencia - agora;
          const dias = Math.ceil(diffMs / 86_400_000);
          if (dias <= DIAS_AVISO) {
            setAvisoVencimento({ dias, tipo });
          }
        }
      })
      .catch((err) => showToast('Erro ao carregar empresa: ' + err.message, 'error'));
  }, [user, selectedEmpresa]);

  const fetchUsers = useCallback(async () => {
    if (user?.role !== "admin" && user?.role !== "gerente") {
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

  // ── Cancelamentos / Tipos / Motivos (admin-only, escopo por empresa) ────────
  // Declarados ANTES dos hooks que os referenciam nos arrays de dependência
  // para evitar Temporal Dead Zone (TDZ) do JavaScript.

  const fetchTiposCancelamento = useCallback(async () => {
    if (user?.role !== "admin") {
      setTiposCancelamento([]);
      return [];
    }
    setTiposLoading(true);
    try {
      const data = await getTiposCancelamento();
      setTiposCancelamento(data);
      return data;
    } catch (err) {
      showToast("Erro ao carregar tipos: " + err.message, "error");
      return [];
    } finally {
      setTiposLoading(false);
    }
  }, [user?.role]);

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

  const fetchPredios = useCallback(async () => {
    setPrediosLoading(true);
    try {
      const data = await getPredios();
      setPredios(data);
    } catch (err) {
      showToast("Erro ao carregar prédios: " + err.message, "error");
    } finally {
      setPrediosLoading(false);
    }
  }, []);

  const fetchLocacoes = useCallback(async (status = locacoesStatusFilter) => {
    setLocacoesLoading(true);
    try {
      const filters = status === 'todos' ? {} : { status };
      const [list, summary] = await Promise.all([getLocacoes(filters), getLocacoesResumo()]);
      setLocacoes(list);
      setLocacoesResumo(summary);
      return list;
    } catch (err) {
      showToast("Erro ao carregar locações: " + err.message, "error");
      return [];
    } finally {
      setLocacoesLoading(false);
    }
  }, [locacoesStatusFilter]);

  // Admins só carregam esses dados depois de selecionar uma empresa.
  // Sem empresa, o backend retorna 403 (withTenantContext exige empresa_id).
  useEffect(() => {
    if (user?.role === 'admin') return;
    fetchTiposCancelamento();
    fetchMotivosCancelamento();
    fetchCancelamentosLog();
  }, [user?.role, fetchTiposCancelamento, fetchMotivosCancelamento, fetchCancelamentosLog]);

  // Admin: carrega lista de empresas e restaura seleção salva (persiste no F5)
  useEffect(() => {
    if (user?.role !== 'admin') return;
    getEmpresas()
      .then((list) => {
        setEmpresas(list);
        const savedId = localStorage.getItem('admin_empresa_id');
        if (savedId) {
          const saved = list.find((e) => String(e.id) === savedId);
          if (saved) {
            setSelectedEmpresa(saved);
            setAdminEmpresaOverride(saved.id);
            setLoading(true);
            fetchLoteamentos();
            fetchPredios();
            fetchUsers();
            // Carrega dados filtrados pela empresa restaurada do localStorage
            fetchTiposCancelamento();
            fetchMotivosCancelamento();
            fetchCancelamentosLog();
          }
        }
      })
      .catch((err) => showToast('Erro ao carregar empresas: ' + err.message, 'error'));
  }, [user?.role, fetchLoteamentos, fetchPredios, fetchUsers, fetchTiposCancelamento, fetchMotivosCancelamento, fetchCancelamentosLog]);

  const onSelectEmpresa = useCallback((empresa) => {
    setSelectedEmpresa(empresa);
    setAdminEmpresaOverride(empresa?.id ?? null);
    if (empresa?.id) {
      localStorage.setItem('admin_empresa_id', String(empresa.id));
    } else {
      localStorage.removeItem('admin_empresa_id');
    }
    // Limpa TODOS os dados da empresa anterior
    setLoteamentos([]);
    setPredios([]);
    setLocacoes([]);
    setLocacoesResumo({});
    setUsuarios([]);
    setTiposCancelamento([]);
    setMotivosCancelamento([]);
    setCancelamentosLog([]);
    setLoading(true);
    if (empresa?.id) {
      // Recarrega tudo para a nova empresa selecionada
      fetchLoteamentos();
      fetchPredios();
      fetchUsers();
      fetchTiposCancelamento();
      fetchMotivosCancelamento();
      fetchCancelamentosLog();
    }
  }, [fetchLoteamentos, fetchPredios, fetchUsers, fetchTiposCancelamento, fetchMotivosCancelamento, fetchCancelamentosLog]);

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

  useEffect(() => {
    if ((user?.role !== 'admin' || selectedEmpresa) && userHasAnyModule(user, ["predios", "vendas"])) fetchPredios();
  }, [fetchPredios, user, selectedEmpresa]);

  useEffect(() => {
    if ((user?.role !== 'admin' || selectedEmpresa) && userHasAnyModule(user, ["locacoes"])) fetchLocacoes();
  }, [fetchLocacoes, user, selectedEmpresa]);

  useEffect(() => {
    if (view === "clientes" && userHasModule(user, "clientes")) fetchClientes("");
  }, [view, user, fetchClientes]);

  const refreshPredio = useCallback(async (id) => {
    try {
      const updated = await getPredio(id);
      setPredios((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      showToast("Erro ao atualizar prédio: " + err.message, "error");
    }
  }, []);

  const onCreatePredio = async (data) => {
    if (user?.somente_leitura) {
      showToast("Conta em modo somente leitura.", "error");
      return;
    }
    try {
      const created = await createPredio(data);
      setPredios((prev) => [created, ...prev]);
      setActivePredioId(created.id);
      setShowPredioWizard(false);
      setView("predio");
      showToast(
        `O prédio "${created.nome}" e seus ${created.num_andares} andares já estão prontos para receber a planta baixa.`,
        "success",
        "Prédio criado com sucesso"
      );
    } catch (err) {
      showToast("Erro ao criar prédio: " + err.message, "error");
    }
  };

  const onSaveFloorPlan = async (predioId, andarNumero, shapes, aps, meta) => {
    try {
      await saveFloorPlan(predioId, andarNumero, shapes, aps, meta);
      await refreshPredio(predioId);
      showToast("Planta baixa salva com sucesso");
    } catch (err) {
      showToast("Erro ao salvar planta: " + err.message, "error");
    }
  };

  const onUpdateApStatus = async (apId, status, clienteId, observacao, dataVenda) => {
    try {
      await updateApartamentoStatus(apId, status, clienteId, observacao, dataVenda);
      if (activePredioId) await refreshPredio(activePredioId);
    } catch (err) {
      showToast("Erro: " + err.message, "error");
    }
  };

  const onEndLocacao = async (locacao, encerramentoData) => {
    try {
      await encerrarLocacao(locacao.id, encerramentoData || { motivo: "Encerrada pelo painel geral de locações" });
      await Promise.all([fetchLocacoes(), fetchPredios()]);
      showToast("Locação encerrada com sucesso");
    } catch (err) {
      showToast("Erro ao encerrar locação: " + err.message, "error");
    }
  };

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

  const showToast = (msg, type = "success", title) => {
    setToast({ msg, type, title });
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

  const onUpdateUser = async (id, data) => {
    const updated = await updateUser(id, data);
    setUsuarios((prev) =>
      prev
        .map((item) => (item.id === updated.id ? updated : item))
        .sort((a, b) => (a.nome || a.email || "").localeCompare(b.nome || b.email || "", "pt-BR"))
    );
    showToast("Usuario atualizado com sucesso");
    return updated;
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

  const onSaveSettings = async (data) => {
    const updated = await updateEmpresaSettings(data);
    setCurrentEmpresa(updated);
    if (selectedEmpresa?.id === updated?.id) {
      setSelectedEmpresa((current) => ({ ...current, ...updated }));
      setEmpresas((prev) => prev.map((empresa) => (empresa.id === updated.id ? { ...empresa, ...updated } : empresa)));
    }
    showToast("Configurações salvas");
    return updated;
  };

  // ── Navegação ───────────────────────────────────────────────────────────

  const loteamento = activeLoteamentoId
    ? loteamentos.find((l) => l.id === activeLoteamentoId) || null
    : null;
  const metrics = computeMetrics(loteamentos);

  // Modo somente leitura: assinatura vencida/inativa — pode ver mas não modificar
  const somenteLeitura = !!(user?.somente_leitura);

  const canCreateLoteamento = canCreateLoteamentoByRole(user?.role) && !somenteLeitura;
  const canEditLoteamento   = canEditLoteamentoByRole(user?.role)   && !somenteLeitura;
  const canSellLot          = canSellByRole(user?.role)             && !somenteLeitura;
  const settingsEmpresa = currentEmpresa || selectedEmpresa;

  // Info do plano para UserManagement
  const planoInfo = settingsEmpresa?.plano_id
    ? { max_usuarios: settingsEmpresa.max_usuarios ?? null, nome: settingsEmpresa.plano ?? "—" }
    : null;
  const defaultPricePerM2 = Number(settingsEmpresa?.valor_m2_padrao) || 700;
  const defaultApM2 = Number(settingsEmpresa?.ap_valor_m2_padrao) || 700;

  useEffect(() => {
    if (view === "admin" && user?.role !== "admin") setView("dashboard");
    if (view === "usuarios" && user?.role !== "gerente" && user?.role !== "admin") setView("dashboard");
    if (view === "settings" && user?.role !== "gerente" && user?.role !== "admin") setView("dashboard");
    if (view === "relatorios" && user?.role !== "gerente" && user?.role !== "admin" && !userHasModule(user, "relatorios")) setView("dashboard");
    const requiredModule = VIEW_MODULE[view];
    if (user?.role === "vendedor" && requiredModule && !userHasModule(user, requiredModule)) {
      setView(firstAllowedView(user));
      setSelectedLot(null);
      setActivePredioId(null);
    }
    // Pré-carrega clientes ao abrir gerenciamento de prédios
    if (view === "predio" && clientes.length === 0) fetchClientes('');
  }, [view, user]);

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
    if (somenteLeitura) {
      showToast("Conta em modo somente leitura. Renove sua assinatura para editar loteamentos.", "error");
      return;
    }

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

    const requiredModule = VIEW_MODULE[id];
    if (user?.role === "vendedor" && requiredModule && !userHasModule(user, requiredModule)) {
      showToast("Seu acesso nao possui esse modulo liberado.", "error");
      return;
    }

    if (user?.role === "admin" && !selectedEmpresa && id !== "dashboard") {
      showToast("Selecione uma empresa antes de navegar", "error");
      return;
    }

    setView(id);
    setSelectedLot(null);
    if (id === "predios") {
      setActivePredioId(null);
    }
  };

  // Ações nos lotes

  const openSaleDialog = (lot, loteamentoId = activeLoteamentoId, targetStatus = "vendido") => {
    if (!lot.db_id) return;
    if (somenteLeitura) {
      showToast("Conta em modo somente leitura. Renove sua assinatura para registrar vendas.", "error");
      return;
    }
    if (!canSellLot) {
      showToast("Seu usuario nao pode vender lotes", "error");
      return;
    }
    setSaleDraft({ lot, loteamentoId, returnView: view, cliente: null, targetStatus });
    fetchClientes("");
  };

  const confirmLotStatus = async (cliente, observacao, dataVenda) => {
    if (!saleDraft?.lot?.db_id || !cliente?.id) return;
    try {
      const { lot, loteamentoId, targetStatus = "vendido" } = saleDraft;
      const patchedLot = await updateLoteStatus(lot.db_id, targetStatus, cliente.id, observacao, dataVenda);
      // Apply the PATCH response immediately to avoid waiting for the full refresh
      if (patchedLot) {
        setLoteamentos((prev) =>
          prev.map((l) => {
            if (l.id !== loteamentoId) return l;
            return { ...l, lots: (l.lots || []).map((lotItem) => lotItem.db_id === lot.db_id ? patchedLot : lotItem) };
          })
        );
        if (selectedLot?.lot?.db_id === lot.db_id) {
          setSelectedLot((prev) => ({ ...prev, lot: patchedLot }));
        }
      }
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

  const onUltimaEtapaChange = useCallback((loteDbId, loteamentoId, ultimaEtapa) => {
    const valorNovo = ultimaEtapa?.valor_novo;
    const shouldUpdatePreco = valorNovo !== null && valorNovo !== undefined;
    setLoteamentos((prev) =>
      prev.map((l) => {
        if (l.id !== loteamentoId) return l;
        return {
          ...l,
          lots: (l.lots || []).map((lot) =>
            lot.db_id === loteDbId
              ? {
                ...lot,
                ultima_etapa: ultimaEtapa,
                ...(shouldUpdatePreco ? { preco: Number(valorNovo) } : {}),
              }
              : lot
          ),
        };
      })
    );
    setSelectedLot((prev) =>
      prev?.lot?.db_id === loteDbId
        ? {
          ...prev,
          lot: {
            ...prev.lot,
            ultima_etapa: ultimaEtapa,
            ...(shouldUpdatePreco ? { preco: Number(valorNovo) } : {}),
          },
        }
        : prev
    );
    setDrawerLot((prev) =>
      prev?.db_id === loteDbId
        ? {
          ...prev,
          ultima_etapa: ultimaEtapa,
          ...(shouldUpdatePreco ? { preco: Number(valorNovo) } : {}),
        }
        : prev
    );
  }, []);

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
        (view === "editor" || editingAndar ? " app-editor" : "")
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
          predios: predios.length,
          locacoes: locacoesResumo.total_ativas || 0,
        }}
        user={user}
        onLogout={() => { localStorage.removeItem('admin_empresa_id'); logout(); router.replace('/'); }}
        empresas={empresas}
        selectedEmpresa={selectedEmpresa}
        currentEmpresa={currentEmpresa}
        onSelectEmpresa={onSelectEmpresa}
      />
      <main className="main">
        {/* Cabeçalho global só na view de mapa (Voltar + breadcrumb); as demais telas têm cabeçalho próprio */}
        {view === "map" && (
          <Header
            view={view}
            loteamentoNome={loteamento?.nome}
            onBack={onBackToDash}
          />
        )}
        <div className="content">
          {/* Banner de assinatura vencida/inativa — somente leitura */}
          {somenteLeitura && user?.role !== "admin" && (
            <div style={{
              background: "linear-gradient(90deg,#fff7ed,#fff0f0)",
              border: "1px solid #fed7aa",
              borderRadius: 10,
              padding: "12px 18px",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "0.875rem",
              color: "#c2410c",
              boxShadow: "0 1px 4px rgba(194,65,12,0.08)",
            }}>
              🔒&nbsp;
              <span>
                <strong>Conta em modo somente leitura.</strong> Sua assinatura está vencida ou a conta foi desativada.
                Você pode visualizar os dados, mas não criar ou alterar registros.
                {" "}Entre em contato com o administrador do sistema para renovar.
              </span>
            </div>
          )}

          {view === "dashboard" && (
            <Dashboard
              loteamentos={loteamentos}
              predios={predios}
              locacoesResumo={locacoesResumo}
              loading={loading}
              onOpenLoteamento={onOpenLoteamento}
              onOpenEditor={onOpenEditor}
              onRefresh={fetchLoteamentos}
              onOpenPredios={() => setView("predios")}
              onOpenLoteamentos={() => setView("loteamentos")}
              canCreateLoteamento={canCreateLoteamento}
              canEditLoteamento={canEditLoteamento}
              user={user}
              empresas={empresas}
              selectedEmpresa={selectedEmpresa}
              onSelectEmpresa={onSelectEmpresa}
            />
          )}

          {view === "loteamentos" && (
            <LoteamentosView
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
              predios={predios}
              loading={loading}
              onOpenLoteamento={onOpenLoteamento}
              onOpenPredios={() => { setView("predios"); setActivePredioId(null); }}
              user={user}
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

          {view === "relatorios" && (user?.role === "gerente" || user?.role === "admin" || userHasModule(user, "relatorios")) && (
            <RelatoriosPanel user={user} />
          )}

          {view === "comercial" && (
            <ComercialPanel user={user} />
          )}

          {view === "settings" && (user?.role === "gerente" || user?.role === "admin") && (
            <SettingsView
              empresa={settingsEmpresa}
              onSave={onSaveSettings}
              onAssinarPlano={async () => {
                const updated = await getCurrentEmpresa();
                setCurrentEmpresa(updated);
              }}
            />
          )}

          {view === "planos" && (
            <PlanosPagina
              currentEmpresa={settingsEmpresa}
              onAssinar={async () => {
                const updated = await getCurrentEmpresa();
                setCurrentEmpresa(updated);
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
              onUpdateUser={onUpdateUser}
              loteamentos={loteamentos}
              tipos={tiposCancelamento}
              tiposLoading={tiposLoading}
              onRefreshTipos={fetchTiposCancelamento}
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

          {view === "usuarios" && (user?.role === "gerente" || user?.role === "admin") && (
            <UserManagement
              users={usuarios}
              loading={usersLoading}
              onRefresh={fetchUsers}
              onCreate={onCreateUser}
              onUpdate={onUpdateUser}
              currentUser={user}
              planoInfo={planoInfo}
              somenteLeitura={somenteLeitura}
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
                  onOpenDrawer={(lot) => setDrawerLot(lot)}
                  onUpdatePrice={async (novoPreco) => {
                    const lot = selectedLot.lot;
                    if (!lot?.db_id) return;
                    const updated = await updateLote(lot.db_id, { preco: novoPreco });
                    setLoteamentos((prev) =>
                      prev.map((lt) =>
                        lt.id !== activeLoteamentoId
                          ? lt
                          : {
                              ...lt,
                              lots: (lt.lots || []).map((l) =>
                                l.db_id === lot.db_id ? { ...l, preco: updated?.preco ?? novoPreco } : l
                              ),
                            }
                      )
                    );
                    setSelectedLot((prev) =>
                      prev ? { ...prev, lot: { ...prev.lot, preco: updated?.preco ?? novoPreco } } : prev
                    );
                  }}
                  user={user}
                />
              )}
              {!drawerLot && (
                <LoteamentoSwitcher
                  loteamentos={loteamentos}
                  current={loteamento}
                  onSwitch={(id) => onOpenLoteamento(id)}
                  onEdit={() => onOpenEditor(loteamento)}
                  canEditLoteamento={canEditLoteamento}
                />
              )}
            </div>
          )}

          {view === "editor" && (
            <MapEditor
              initialLoteamento={editorLoteamento}
              defaultPricePerM2={defaultPricePerM2}
              onBack={() =>
                setView(editorLoteamento ? "map" : "dashboard")
              }
              onSave={onSaveEditor}
              saving={saving}
            />
          )}

          {view === "predios" && (
            <PrediosListView
              predios={predios}
              loading={prediosLoading}
              canCreate={canCreateLoteamento}
              canEdit={canEditLoteamento}
              onOpenPredio={(id) => { setActivePredioId(id); setView("predio"); }}
              onNewPredio={() => setShowPredioWizard(true)}
              onToggleAtivo={async (p) => {
                const updated = await updatePredio(p.id, { ativo: !p.ativo });
                setPredios((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
              }}
            />
          )}

          {view === "locacoes" && (
            <div className="list-page rentals-list-page">
              <header className="list-page-head">
                <div>
                  <div className="dash-eyebrow">GESTÃO DE CONTRATOS</div>
                  <h1 className="list-page-title">Locações</h1>
                  <p className="dash-sub">Acompanhe contratos ativos, receita mensal e histórico de aluguéis.</p>
                </div>
              </header>
              <LocacoesPanel
                locacoes={locacoes}
                resumo={locacoesResumo}
                loading={locacoesLoading}
                user={user}
                onEnd={onEndLocacao}
                onLocacoesRefresh={fetchLocacoes}
                statusFilter={locacoesStatusFilter}
                onStatusFilterChange={(status) => {
                  setLocacoesStatusFilter(status);
                  fetchLocacoes(status);
                }}
              />
            </div>
          )}

          {view === "predio" && activePredioId && (
            <PredioManagement
              predio={predios.find((p) => p.id === activePredioId) || null}
              onBack={() => { setView("predios"); setEditingAndar(false); }}
              onSaveFloorPlan={onSaveFloorPlan}
              onUpdateApStatus={onUpdateApStatus}
              onUpdateAp={async (apId, data) => {
                const updated = await updateApartamento(apId, data);
                await refreshPredio(activePredioId);
                return updated;
              }}
              defaultApM2={defaultApM2}
              clientes={clientes}
              user={user}
              onRefresh={() => Promise.all([refreshPredio(activePredioId), fetchLocacoes()])}
              onStartEditingAndar={() => setEditingAndar(true)}
              onStopEditingAndar={() => setEditingAndar(false)}
            />
          )}

          {view !== "dashboard" &&
            view !== "loteamentos" &&
            view !== "map" &&
            view !== "lotes" &&
            view !== "vendas" &&
            view !== "clientes" &&
            view !== "admin" &&
            view !== "settings" &&
            view !== "editor" &&
            view !== "predios" &&
            view !== "predio" &&
            view !== "locacoes" &&
            view !== "comercial" &&
            view !== "relatorios" &&
            view !== "usuarios" &&
            view !== "planos" && <EmptyState view={view} />}
        </div>
      </main>

      {showPredioWizard && (
        <PredioWizard
          onConfirm={onCreatePredio}
          onCancel={() => setShowPredioWizard(false)}
        />
      )}

      {drawerLot && (
        <NegociacaoDrawer
          lot={drawerLot}
          user={user}
          onClose={() => setDrawerLot(null)}
          onUltimaEtapaChange={onUltimaEtapaChange}
        />
      )}

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
        <div
          className={"toast" + (toast.type === "error" ? " toast-error" : "")}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <div className="toast-icon" aria-hidden="true">
            {toast.type !== "error" ? (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="10" fill="currentColor" />
                <path
                  d="M7 11.2l2.5 2.5L15.4 8"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="10" fill="currentColor" />
                <path
                  d="M7.5 7.5l7 7m0-7l-7 7"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <div className="toast-copy">
            <strong className="toast-title">
              {toast.title || (toast.type === "error" ? "Não foi possível concluir" : "Tudo certo")}
            </strong>
            <span className="toast-message">{toast.msg}</span>
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Fechar mensagem"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8m0-8l-8 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      {avisoVencimento && (
        <ModalAvisoVencimento
          dias={avisoVencimento.dias}
          tipo={avisoVencimento.tipo}
          onClose={() => setAvisoVencimento(null)}
        />
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

function SettingsView({ empresa, onSave, onAssinarPlano }) {
  const [activeTab, setActiveTab] = useState("valores");
  const [valorM2, setValorM2] = useState(() => String(Number(empresa?.valor_m2_padrao) || 700));
  const [apValorM2, setApValorM2] = useState(() => String(Number(empresa?.ap_valor_m2_padrao) || 700));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValorM2(String(Number(empresa?.valor_m2_padrao) || 700));
    setApValorM2(String(Number(empresa?.ap_valor_m2_padrao) || 700));
  }, [empresa?.valor_m2_padrao, empresa?.ap_valor_m2_padrao]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const parsed = Number(String(valorM2).replace(",", "."));
    const parsedAp = Number(String(apValorM2).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isFinite(parsedAp) || parsedAp < 0) {
      setError("Informe valores por metro quadrado válidos.");
      return;
    }

    setSaving(true);
    try {
      await onSave({ valor_m2_padrao: parsed, ap_valor_m2_padrao: parsedAp });
    } catch (err) {
      setError(err.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-head">
        <div>
          <div className="dash-eyebrow">CONFIGURAÇÕES</div>
          <h1 className="list-page-title">Configurações do sistema</h1>
          <p className="dash-sub">{empresa?.nome || "Empresa atual"}</p>
        </div>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="Seções de configuração">
        <button
          type="button"
          className={activeTab === "valores" ? "active" : ""}
          onClick={() => setActiveTab("valores")}
        >
          Configuração de valor
        </button>
        <button
          type="button"
          className={activeTab === "assinatura" ? "active" : ""}
          onClick={() => setActiveTab("assinatura")}
        >
          Assinatura
        </button>
      </div>

      {activeTab === "valores" && (
        <form className="settings-card settings-panel" onSubmit={handleSubmit}>
          <div className="settings-card-head">
            <div>
              <h2>Valores padrão</h2>
              <p>Defina os preços-base usados ao criar novas unidades.</p>
            </div>
          </div>

          <div className="user-form-grid">
            <label className="user-field">
              <span>Valor padrão por m² (lotes)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valorM2}
                onChange={(event) => setValorM2(event.target.value)}
              />
            </label>
            <label className="user-field">
              <span>Valor padrão por m² (apartamentos)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={apValorM2}
                onChange={(event) => setApValorM2(event.target.value)}
              />
            </label>
          </div>

          <div className="settings-card-footer">
            <div>
              <div className="settings-note">
                Esses valores serão usados como referência inicial no editor. O valor final ainda pode ser ajustado em cada lote, apartamento ou negociação.
              </div>
              {error && <div className="form-alert">{error}</div>}
            </div>

            <button className="qa-btn qa-btn-primary settings-submit" type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar configurações"}
            </button>
          </div>
        </form>
      )}

      {activeTab === "assinatura" && (
        <div className="settings-card settings-planos">
          <PlanosPagina
            currentEmpresa={empresa}
            onAssinar={onAssinarPlano}
          />
        </div>
      )}
    </div>
  );
}

function LoteamentosView({ loteamentos, loading, onOpenLoteamento, onOpenEditor, onRefresh, canCreateLoteamento, canEditLoteamento }) {
  const [filtroAtivo, setFiltroAtivo] = useState('ativo');
  const [toggling, setToggling] = useState(null);

  const filtered = loteamentos.filter((lt) => {
    if (filtroAtivo === 'ativo') return lt.ativo !== false;
    if (filtroAtivo === 'inativo') return lt.ativo === false;
    return true;
  });

  const handleToggleAtivo = async (lt) => {
    setToggling(lt.id);
    try {
      await toggleLoteamentoAtivo(lt.id, !lt.ativo);
      onRefresh?.();
    } catch (err) {
      alert(err.message || 'Erro ao arquivar loteamento.');
    } finally {
      setToggling(null);
    }
  };

  return (
    <section className="list-page">
      <header className="list-page-head">
        <div>
          <div className="dash-eyebrow">LOTEAMENTOS</div>
          <h1 className="list-page-title">Loteamentos cadastrados</h1>
          <p className="dash-sub">{filtered.length} de {loteamentos.length} empreendimento{loteamentos.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[['ativo','Ativos'],['inativo','Inativos'],['todos','Todos']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFiltroAtivo(v)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              border: filtroAtivo === v ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: filtroAtivo === v ? 'var(--accent)' : 'none',
              color: filtroAtivo === v ? '#fff' : 'var(--text-muted)',
            }}>{l}</button>
          ))}
          <button className="sec-tool-btn" onClick={onRefresh} title="Atualizar">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M14 8A6 6 0 1 1 8 2a6 6 0 0 1 4.24 1.76L14 2v4h-4l1.5-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Atualizar
          </button>
          {canCreateLoteamento && (
            <button className="qa-btn qa-btn-primary" onClick={() => onOpenEditor?.(null)}>
              <span className="qa-ic" style={{ color: '#ffffff' }}>✎</span>
              Novo loteamento
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="lot-cards-loading">
          <div className="loading-card" />
          <div className="loading-card" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="list-empty">
          <p>{loteamentos.length === 0 ? 'Nenhum loteamento encontrado.' : `Nenhum loteamento ${filtroAtivo === 'ativo' ? 'ativo' : 'inativo'} encontrado.`}</p>
          {canCreateLoteamento && loteamentos.length === 0 && (
            <button className="qa-btn qa-btn-primary" onClick={() => onOpenEditor?.(null)}>Criar loteamento</button>
          )}
        </div>
      ) : (
        <div className="lot-cards">
          {filtered.map((loteamento) => (
            <LoteamentoCard
              key={loteamento.id}
              loteamento={loteamento}
              onClick={() => onOpenLoteamento(loteamento.id)}
              onEdit={canEditLoteamento ? () => onOpenEditor?.(loteamento) : null}
              onToggleAtivo={canEditLoteamento ? () => handleToggleAtivo(loteamento) : null}
              toggling={toggling === loteamento.id}
              canShare={true}
            />
          ))}
        </div>
      )}
    </section>
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

function SalesView({ loteamentos, predios = [], loading, onOpenLoteamento, onOpenPredios, user }) {
  const lots = flattenLots(loteamentos);
  const isVendedor = user?.role === "vendedor";

  const soldLots = lots.filter(
    (lot) => lot.status === "vendido" && (!isVendedor || lot.cliente_vinculado_por === user?.id)
  );

  const soldAps = predios
    .flatMap((p) =>
      (p.andares || []).flatMap((a) =>
        (a.apartamentos || [])
          .filter((ap) => ap.status === "vendido" && (!isVendedor || ap.cliente_vinculado_por === user?.id))
          .map((ap) => ({ ...ap, predioNome: p.nome, predioId: p.id, cidade: p.cidade, estado: p.estado }))
      )
    );

  const totalLotes = soldLots.reduce((s, l) => s + (Number(l.preco) || 0), 0);
  const totalAps = soldAps.reduce((s, a) => s + (Number(a.preco_venda) || 0), 0);
  const total = totalLotes + totalAps;
  const totalCount = soldLots.length + soldAps.length;

  const allSales = [
    ...soldLots.map((lot) => ({ ...lot, _type: 'lote' })),
    ...soldAps.map((ap) => ({ ...ap, _type: 'apartamento' })),
  ].sort((a, b) => new Date(b.vendido_em || b.atualizado_em || 0) - new Date(a.vendido_em || a.atualizado_em || 0));

  return (
    <section className="list-page">
      <header className="list-page-head">
        <div>
          <div className="dash-eyebrow">VENDAS</div>
          <h1 className="list-page-title">{isVendedor ? "Minhas vendas" : "Vendas realizadas"}</h1>
          <p className="dash-sub">
            {totalCount} {totalCount === 1 ? "venda" : "vendas"}{isVendedor ? " realizadas por você" : " registradas"}
            {soldLots.length > 0 && soldAps.length > 0 && ` (${soldLots.length} lotes · ${soldAps.length} aptos)`}
            {" · "}{fmtBRLShort(total)} em total vendido.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="list-empty">Carregando vendas...</div>
      ) : totalCount === 0 ? (
        <div className="list-empty">Nenhuma venda registrada.</div>
      ) : (
        <div className="lot-table-wrap">
          <table className="lot-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Unidade</th>
                <th>Empreendimento</th>
                <th>Área</th>
                <th>Valor</th>
                <th>Data da venda</th>
                <th>Cliente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {allSales.map((item) =>
                item._type === 'lote' ? (
                  <tr key={`lote-${item.db_id || item.id}`}>
                    <td><span className="status-pill" style={{ color: '#3288e0', background: 'rgba(50,136,224,.12)' }}>Lote</span></td>
                    <td><b className="lot-code">{item.id}</b>{item.quadra && <div className="table-sub">Quadra {item.quadra}</div>}</td>
                    <td>
                      <button className="link-button" onClick={() => onOpenLoteamento?.(item.loteamentoId)}>
                        {item.loteamentoNome}
                      </button>
                      <div className="table-sub">{[item.cidade, item.estado].filter(Boolean).join('/') || '—'}</div>
                    </td>
                    <td>{item.area ? `${item.area} m²` : '—'}</td>
                    <td>{fmtBRL(item.preco)}</td>
                    <td>{item.vendido_em ? new Date(item.vendido_em).toLocaleDateString('pt-BR') : <span style={{ color: '#aaa' }}>—</span>}</td>
                    <td>
                      {item.cliente ? (
                        <>
                          <b>{item.cliente.nome}</b>
                          <div className="table-sub">{formatCpfCnpj(item.cliente.cpf_cnpj)}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td>
                      <button className="table-action table-action-ghost" onClick={() => onOpenLoteamento?.(item.loteamentoId)}>Loteamento</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={`ap-${item.id}`}>
                    <td><span className="status-pill" style={{ color: '#8b5cf6', background: 'rgba(139,92,246,.12)' }}>Apartamento</span></td>
                    <td><b className="lot-code">{item.ap_id}</b></td>
                    <td>
                      <button className="link-button" onClick={() => onOpenPredios?.()}>
                        {item.predioNome}
                      </button>
                      <div className="table-sub">{[item.cidade, item.estado].filter(Boolean).join('/') || '—'}</div>
                    </td>
                    <td>{item.area > 0 ? `${item.area} m²` : '—'}</td>
                    <td>{fmtBRL(item.preco_venda)}</td>
                    <td>{item.vendido_em ? new Date(item.vendido_em).toLocaleDateString('pt-BR') : <span style={{ color: '#aaa' }}>—</span>}</td>
                    <td>
                      {item.cliente ? (
                        <>
                          <b>{item.cliente.nome}</b>
                          <div className="table-sub">{formatCpfCnpj(item.cliente.cpf_cnpj)}</div>
                        </>
                      ) : '—'}
                    </td>
                    <td>
                      <button className="table-action table-action-ghost" onClick={() => onOpenPredios?.()}>Prédio</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
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
                  <button className="table-action table-action-ghost" onClick={() => onOpenLoteamento?.(lot.loteamentoId)}>Loteamento</button>
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

function PrediosListView({ predios, loading, canCreate, canEdit, onOpenPredio, onNewPredio, onToggleAtivo }) {
  const [filtroAtivo, setFiltroAtivo] = useState('ativo');
  const [toggling, setToggling] = useState(null);

  const AP_STATUS_COLORS = {
    disponivel: '#22c55e',
    reservado: '#f59e0b',
    vendido: '#ef4444',
    alugado: '#8b5cf6',
  };

  const filtered = predios.filter((p) => {
    if (filtroAtivo === 'ativo') return p.ativo !== false;
    if (filtroAtivo === 'inativo') return p.ativo === false;
    return true;
  });

  const handleToggle = async (e, p) => {
    e.stopPropagation();
    setToggling(p.id);
    try {
      await onToggleAtivo?.(p);
    } catch (err) {
      alert(err.message || 'Erro ao arquivar prédio.');
    } finally {
      setToggling(null);
    }
  };

  return (
    <section className="list-page">
      <header className="list-page-head">
        <div>
          <div className="dash-eyebrow">PRÉDIOS</div>
          <h1 className="list-page-title">Prédios cadastrados</h1>
          <p className="dash-sub">{filtered.length} de {predios.length} prédio{predios.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[['ativo','Ativos'],['inativo','Inativos'],['todos','Todos']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFiltroAtivo(v)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              border: filtroAtivo === v ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: filtroAtivo === v ? 'var(--accent)' : 'none',
              color: filtroAtivo === v ? '#fff' : 'var(--text-muted)',
            }}>{l}</button>
          ))}
          {canCreate && (
            <button className="qa-btn qa-btn-primary" onClick={onNewPredio}>
              <span className="qa-ic" style={{ color: '#ffffff' }}>+</span>
              Novo Prédio
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="list-empty">Carregando prédios...</div>
      ) : filtered.length === 0 ? (
        <div className="list-empty">
          <p>{predios.length === 0 ? 'Nenhum prédio cadastrado.' : `Nenhum prédio ${filtroAtivo === 'ativo' ? 'ativo' : 'inativo'} encontrado.`}</p>
          {canCreate && predios.length === 0 && (
            <button className="qa-btn qa-btn-primary" onClick={onNewPredio}>Criar prédio</button>
          )}
        </div>
      ) : (
        <div className="predios-list">
          {filtered.map((p) => {
            const stats = p.stats || {};
            const total = stats.total || 0;
            const disponiveis = stats.disponivel || 0;
            const reservados = stats.reservado || 0;
            const vendidos = stats.vendido || 0;
            const alugados = stats.alugado || 0;
            const ocupados = total - disponiveis;
            const ocupPct = total > 0 ? Math.round(((total - (stats.disponivel || 0)) / total) * 100) : 0;
            const soldPct = total > 0 ? (vendidos / total) * 100 : 0;
            const rentedPct = total > 0 ? (alugados / total) * 100 : 0;
            const reservedPct = total > 0 ? (reservados / total) * 100 : 0;
            const availablePct = Math.max(0, 100 - soldPct - rentedPct - reservedPct);
            return (
              <article
                key={p.id}
                className="predio-card-row"
                style={{ cursor: 'pointer', opacity: p.ativo === false ? 0.65 : 1 }}
                onClick={() => onOpenPredio(p.id)}
              >
                <div className="predio-card-visual" aria-hidden="true">
                  <Building3DView predio={p} showLegend={false} />
                </div>

                <div className="predio-card-body">
                  <div className="predio-card-head">
                    <div>
                      <div className="lcr-eyebrow">Prédio</div>
                      <div className="predio-card-title">
                        {p.nome}
                        {p.ativo === false && <span className="predio-inactive-badge">INATIVO</span>}
                      </div>
                      <div className="lcr-loc">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <path d="M8 14s4.5-4.3 4.5-7.4A4.5 4.5 0 0 0 3.5 6.6C3.5 9.7 8 14 8 14z" stroke="currentColor" strokeWidth="1.4" />
                          <circle cx="8" cy="6.6" r="1.5" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                        {[p.bairro, p.cidade, p.estado].filter(Boolean).join(' · ') || 'Local não informado'}
                      </div>
                    </div>

                    <div className="predio-card-actions">
                      {canEdit && onToggleAtivo && (
                        <button
                          className={p.ativo === false ? 'predio-toggle predio-toggle-restore' : 'predio-toggle'}
                          onClick={(e) => handleToggle(e, p)}
                          disabled={toggling === p.id}
                          title={p.ativo === false ? 'Reativar prédio' : 'Arquivar prédio'}
                        >
                          {toggling === p.id ? '...' : p.ativo === false ? 'Reativar' : 'Arquivar'}
                        </button>
                      )}
                      <button
                        className="lcr-open"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPredio(p.id);
                        }}
                      >
                        Abrir prédio
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="lcr-stats">
                    <div className="lcr-stat">
                      <span className="lcr-stat-k">Andares</span>
                      <span className="lcr-stat-v">{p.num_andares || 0}</span>
                    </div>
                    <div className="lcr-stat">
                      <span className="lcr-stat-k">Apartamentos</span>
                      <span className="lcr-stat-v">{total}</span>
                    </div>
                    <div className="lcr-stat">
                      <span className="lcr-stat-k">Disponíveis</span>
                      <span className="lcr-stat-v">{disponiveis}</span>
                    </div>
                    <div className="lcr-stat">
                      <span className="lcr-stat-k">Ocupados</span>
                      <span className="lcr-stat-v">{ocupados}</span>
                    </div>
                  </div>

                  <div className="lcr-progress">
                    <div className="lcr-prog-head">
                      <span>Ocupação</span>
                      <b>{ocupPct}%</b>
                    </div>
                    <div className="lcr-prog-bar">
                      <div className="lcr-prog-vendido" style={{ width: `${soldPct}%` }} />
                      <div className="lcr-prog-alugado" style={{ width: `${rentedPct}%` }} />
                      <div className="lcr-prog-reservado" style={{ width: `${reservedPct}%` }} />
                      <div className="lcr-prog-disponivel" style={{ width: `${availablePct}%` }} />
                    </div>
                    <div className="lcr-prog-legend">
                      <span><i style={{ background: AP_STATUS_COLORS.vendido }} />{vendidos} vendidos</span>
                      <span><i style={{ background: AP_STATUS_COLORS.alugado }} />{alugados} alugados</span>
                      <span><i style={{ background: AP_STATUS_COLORS.reservado }} />{reservados} reservados</span>
                      <span><i style={{ background: AP_STATUS_COLORS.disponivel }} />{disponiveis} disponíveis</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
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

function ModalAvisoVencimento({ dias, tipo, onClose }) {
  const isTrial = tipo === 'trial';
  const textoTipo = isTrial ? 'período de teste' : 'assinatura';
  const textoDias = dias === 1 ? 'amanhã' : `em ${dias} dias`;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        {/* Cabeçalho */}
        <div style={{
          padding: '24px 24px 0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: dias <= 2 ? '#fff7ed' : '#fffbeb',
            border: `1px solid ${dias <= 2 ? '#fed7aa' : '#fde68a'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke={dias <= 2 ? '#ea580c' : '#d97706'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: dias <= 2 ? '#ea580c' : '#b45309', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
              Aviso de vencimento
            </div>
            <h2 className="modal-title" style={{ padding: 0, margin: 0, fontSize: '1.05rem', lineHeight: 1.3 }}>
              Seu {textoTipo} encerra {textoDias}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0, marginTop: -2 }}
            aria-label="Fechar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Corpo */}
        <div className="modal-body" style={{ padding: '16px 24px 0', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.65 }}>
          <p style={{ margin: 0 }}>
            Tudo bem? Só queríamos te avisar que o {textoTipo} da sua empresa{' '}
            <strong style={{ color: 'var(--text)' }}>vence {textoDias}</strong>.
            Para que o seu acesso não seja interrompido, recomendamos entrar em contato
            com o responsável pelo sistema o quanto antes para que a renovação seja
            providenciada sem estresse.
          </p>
          <p style={{ margin: '12px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', opacity: 0.8 }}>
            Em caso de dúvidas ou para renovar, basta acionar o administrador da plataforma.
          </p>
        </div>

        {/* Rodapé */}
        <div className="modal-footer" style={{ padding: '16px 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="qa-btn qa-btn-primary"
            style={{ minWidth: 120 }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
