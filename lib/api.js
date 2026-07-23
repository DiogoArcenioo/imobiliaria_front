import { getToken } from './auth';

const API_BASE = '/api-proxy';

// Empresa ativa para o admin — sobrescreve o contexto de empresa via header
let adminEmpresaOverride = null;

export function setAdminEmpresaOverride(empresaId) {
  adminEmpresaOverride = empresaId ?? null;
}

function authHeaders() {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (adminEmpresaOverride) {
    headers['X-Empresa-Id'] = String(adminEmpresaOverride);
  }
  return headers;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Erro ${res.status} em ${path}`);
  }
  return res.json();
}

// ── Empresas (admin) ──────────────────────────────────────────────────────────

export function getEmpresas() {
  return request('/empresas');
}

export function getCurrentEmpresa() {
  return request('/empresas/current');
}

export function updateEmpresaSettings(data) {
  return request('/empresas/settings', { method: 'PATCH', body: JSON.stringify(data) });
}

// ── Assinaturas / Clientes (admin) ───────────────────────────────────────────

export function getAdminClientes() {
  return request('/admin/clientes');
}

export function atualizarAssinatura(empresaId, data) {
  return request(`/admin/clientes/${empresaId}/assinatura`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function renovarAssinatura(empresaId, data) {
  return request(`/admin/clientes/${empresaId}/renovar`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getPagamentos(empresaId) {
  return request(`/admin/clientes/${empresaId}/pagamentos`);
}

export function registrarPagamento(empresaId, data) {
  return request(`/admin/clientes/${empresaId}/pagamentos`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function cancelarPagamento(empresaId, pagamentoId) {
  return request(`/admin/clientes/${empresaId}/pagamentos/${pagamentoId}`, {
    method: 'DELETE',
  });
}

export function getEventosAssinatura(empresaId) {
  return request(`/admin/clientes/${empresaId}/eventos`);
}

// ── Planos (admin) ────────────────────────────────────────────────────────────

export function getAdminPlanos() {
  return request('/admin/clientes/planos');
}

export function criarPlano(data) {
  return request('/admin/clientes/planos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function atualizarPlano(planoId, data) {
  return request(`/admin/clientes/planos/${planoId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getPlanos() {
  return request('/assinaturas/planos');
}

export function assinarPlano(planoId) {
  return request('/assinaturas/contratar', {
    method: 'POST',
    body: JSON.stringify({ plano_id: planoId }),
  });
}

// ── Loteamentos ──────────────────────────────────────────────────────────────

export function getLoteamentos() {
  return request('/loteamentos');
}

export function getLoteamento(id) {
  return request(`/loteamentos/${id}`);
}

export function createLoteamento(data) {
  return request('/loteamentos', { method: 'POST', body: JSON.stringify(data) });
}

export function updateLoteamento(id, data) {
  return request(`/loteamentos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteLoteamento(id) {
  return request(`/loteamentos/${id}`, { method: 'DELETE' });
}

/** Arquiva ou reativa um loteamento (ativo: boolean) */
export function toggleLoteamentoAtivo(id, ativo) {
  return request(`/loteamentos/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo }) });
}

export function getLoteamentoPublico(id) {
  return fetch(`/api-proxy/loteamentos/publico/${id}`, {
    headers: { 'Content-Type': 'application/json' },
  }).then(async (res) => {
    if (!res.ok) throw new Error('Loteamento não encontrado');
    return res.json();
  });
}

export function saveEditor(id, shapes, meta) {
  return request(`/loteamentos/${id}/save-editor`, {
    method: 'POST',
    body: JSON.stringify({ shapes, meta }),
  });
}

// ── Lotes ────────────────────────────────────────────────────────────────────

export function getLotes(loteamentoId) {
  return request(`/loteamentos/${loteamentoId}/lotes`);
}

export function updateLoteStatus(dbId, status, clienteId, observacao, vendidoEm) {
  return request(`/lotes/${dbId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      cliente_id: clienteId,
      observacao: observacao || undefined,
      vendido_em: vendidoEm || undefined,
    }),
  });
}

export function updateLote(dbId, data) {
  return request(`/lotes/${dbId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function updateLoteObservacao(dbId, observacao) {
  return request(`/lotes/${dbId}/observacao`, {
    method: 'PATCH',
    body: JSON.stringify({ observacao: observacao || undefined }),
  });
}

export function getLotePrecoHistorico(dbId) {
  return request(`/lotes/${dbId}/preco-historico`);
}

export async function uploadLoteImagens(dbId, files) {
  const form = new FormData();
  Array.from(files || []).forEach((file) => form.append('imagens', file));
  const res = await fetch(`${API_BASE}/lotes/${dbId}/imagens`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Nao foi possivel enviar as imagens');
  }
  return res.json();
}

export function deleteLoteImagem(dbId, imageUrl) {
  const filename = decodeURIComponent(String(imageUrl).split('/').pop());
  return request(`/lotes/${dbId}/imagens/${encodeURIComponent(filename)}`, { method: 'DELETE' });
}

// ── Negociação: etapas ────────────────────────────────────────────────────────

export function getEtapas(loteDbId) {
  return request(`/negociacao/lotes/${loteDbId}/etapas`);
}

export function createEtapa(loteDbId, descricao, valorNegociado) {
  return request(`/negociacao/lotes/${loteDbId}/etapas`, {
    method: 'POST',
    body: JSON.stringify({
      descricao,
      ...(valorNegociado !== undefined ? { valor_negociado: valorNegociado } : {}),
    }),
  });
}

export function getEtapasUnidade(tipo, unidadeId) {
  return request(`/negociacao/${tipo}/${unidadeId}/etapas`);
}

export function createEtapaUnidade(tipo, unidadeId, descricao, valorNegociado) {
  return request(`/negociacao/${tipo}/${unidadeId}/etapas`, {
    method: 'POST',
    body: JSON.stringify({
      descricao,
      ...(valorNegociado !== undefined ? { valor_negociado: valorNegociado } : {}),
    }),
  });
}

export function updateEtapa(etapaId, descricao, valorNegociado) {
  return request(`/negociacao/etapas/${etapaId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      descricao,
      ...(valorNegociado !== undefined ? { valor_negociado: valorNegociado } : {}),
    }),
  });
}

export function deleteEtapa(etapaId) {
  return request(`/negociacao/etapas/${etapaId}`, { method: 'DELETE' });
}

export function deleteLote(dbId) {
  return request(`/lotes/${dbId}`, { method: 'DELETE' });
}

// Usuarios

export function getUsers() {
  return request('/users');
}

export function createUser(data) {
  return request('/users', { method: 'POST', body: JSON.stringify(data) });
}

export function updateUser(id, data) {
  return request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

/** Ativa ou desativa um usuário (ativo: boolean) */
export function toggleUserAtivo(id, ativo) {
  return request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo }) });
}

// Clientes

export function getClientes(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/clientes${query}`);
}

export function createCliente(data) {
  return request('/clientes', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCliente(id, data) {
  return request(`/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// Admin: cancelamentos

export function getTiposCancelamento() {
  return request('/cancelamentos/tipos');
}

export function getMotivosCancelamento(tipo_id) {
  const query = tipo_id ? `?tipo_id=${encodeURIComponent(tipo_id)}` : '';
  return request(`/cancelamentos/motivos${query}`);
}

export function createMotivoCancelamento(data) {
  return request('/cancelamentos/motivos', { method: 'POST', body: JSON.stringify(data) });
}

export function updateMotivoCancelamento(id, data) {
  return request(`/cancelamentos/motivos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function getCancelamentosLog() {
  return request('/cancelamentos/logs');
}

export function cancelarVenda(data) {
  return request('/cancelamentos/venda', { method: 'POST', body: JSON.stringify(data) });
}

// ── Recuperação de senha ──────────────────────────────────────────────────────

export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Erro ${res.status}`);
  return body;
}

export async function resetPassword(token, password) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Erro ${res.status}`);
  return body;
}

// ── IA: geração de loteamento a partir de imagem/PDF ─────────────────────────
// Usa SSE para manter a conexão viva durante processamentos longos (PDFs com
// claude-opus-4-8 podem levar vários minutos). Pings a cada 15s evitam timeout.

export function gerarLoteamentoIA(file) {
  const formData = new FormData();
  formData.append('imagem', file);

  const headers = { ...authHeaders() };

  return fetch(`${API_BASE}/ai/gerar-loteamento`, {
    method: 'POST',
    headers,
    body: formData,
  }).then(async (res) => {
    if (res.status === 401) {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Erro ${res.status} ao chamar IA`);
    }

    // Lê stream SSE: comentários ": ping" são ignorados; eventos "data:" trazem o resultado
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error('Conexão encerrada antes da IA responder.');

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = JSON.parse(trimmed.replace(/^data:\s*/, ''));
        if (payload.type === 'done') return { shapes: payload.shapes, canvas: payload.canvas };
        if (payload.type === 'error') throw new Error(payload.message || 'Erro ao chamar a IA.');
      }
    }
  });
}

// ── Prédios ──────────────────────────────────────────────────────────────────

export function getPredios() {
  return request('/predios');
}

export function getPredio(id) {
  return request(`/predios/${id}`);
}

export function createPredio(data) {
  return request('/predios', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePredio(id, data) {
  return request(`/predios/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deletePredio(id) {
  return request(`/predios/${id}`, { method: 'DELETE' });
}

export function saveFloorPlan(predioId, andarNumero, shapes, apartamentos, meta = {}) {
  return request(`/predios/${predioId}/andares/${andarNumero}/floor-plan`, {
    method: 'POST',
    body: JSON.stringify({ shapes, apartamentos, ...meta }),
  });
}

export function updateApartamentoStatus(apId, status, clienteId, observacao, vendidoEm) {
  return request(`/predios/apartamentos/${apId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      cliente_id: clienteId,
      observacao: observacao || undefined,
      vendido_em: vendidoEm || undefined,
    }),
  });
}

export function updateApartamento(apId, data) {
  return request(`/predios/apartamentos/${apId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function uploadApartamentoImagens(apId, files) {
  const form = new FormData();
  Array.from(files || []).forEach((file) => form.append('imagens', file));
  const res = await fetch(`${API_BASE}/predios/apartamentos/${apId}/imagens`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Nao foi possivel enviar as imagens');
  }
  return res.json();
}

export function deleteApartamentoImagem(apId, imageUrl) {
  const filename = decodeURIComponent(String(imageUrl).split('/').pop());
  return request(`/predios/apartamentos/${apId}/imagens/${encodeURIComponent(filename)}`, { method: 'DELETE' });
}

// Casas

export function getCasas() {
  return request('/casas');
}

export function createCasa(data) {
  return request('/casas', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCasa(id, data) {
  return request(`/casas/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteCasa(id) {
  return request(`/casas/${id}`, { method: 'DELETE' });
}

export function updateCasaStatus(id, status, clienteId, observacao, vendidoEm) {
  return request(`/casas/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      cliente_id: clienteId,
      observacao: observacao || undefined,
      vendido_em: vendidoEm || undefined,
    }),
  });
}

export async function uploadCasaFotos(casaId, files) {
  const form = new FormData();
  Array.from(files || []).forEach((file) => form.append('fotos', file));
  const res = await fetch(`${API_BASE}/casas/${casaId}/fotos`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Nao foi possivel enviar as fotos');
  }
  return res.json();
}

function casaFotoFilename(imageUrl) {
  return decodeURIComponent(String(imageUrl).split('/').pop());
}

export function setCasaFotoCapa(casaId, imageUrl) {
  const filename = casaFotoFilename(imageUrl);
  return request(`/casas/${casaId}/fotos/${encodeURIComponent(filename)}/capa`, { method: 'PATCH' });
}

export function deleteCasaFoto(casaId, imageUrl) {
  const filename = casaFotoFilename(imageUrl);
  return request(`/casas/${casaId}/fotos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
}

export function createCasaLocacao(casaId, data) {
  return request(`/locacoes/casas/${casaId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Locações ────────────────────────────────────────────────────────────────

export function getLocacoes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.predioId) params.set('predio_id', filters.predioId);
  if (filters.casaId) params.set('casa_id', filters.casaId);
  if (filters.status) params.set('status', filters.status);
  const query = params.toString();
  return request(`/locacoes${query ? `?${query}` : ''}`);
}

export function getLocacoesResumo(predioId) {
  if (typeof predioId === 'object' && predioId !== null) {
    const params = new URLSearchParams();
    if (predioId.predioId) params.set('predio_id', predioId.predioId);
    if (predioId.casaId) params.set('casa_id', predioId.casaId);
    const query = params.toString();
    return request(`/locacoes/resumo${query ? `?${query}` : ''}`);
  }
  return request(`/locacoes/resumo${predioId ? `?predio_id=${predioId}` : ''}`);
}

export function createLocacao(apartamentoId, data) {
  return request(`/locacoes/apartamentos/${apartamentoId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function encerrarLocacao(id, motivoOrData) {
  const body = typeof motivoOrData === 'object' && motivoOrData !== null
    ? motivoOrData
    : { motivo: motivoOrData || undefined };
  return request(`/locacoes/${id}/encerrar`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function getLocacaoPagamentos(locacaoId) {
  return request(`/locacoes/${locacaoId}/pagamentos`);
}

export function getPagamentosLocacoes() {
  return request('/locacoes/pagamentos');
}

export function registrarPagamentoLocacao(locacaoId, data) {
  return request(`/locacoes/${locacaoId}/pagamentos`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function cancelarPagamentoLocacao(locacaoId, pagamentoId) {
  return request(`/locacoes/${locacaoId}/pagamentos/${pagamentoId}`, {
    method: 'DELETE',
  });
}

// ── Relatórios gerenciais (gerente/admin) ────────────────────────────────────

export function getAgendaItems(filters = {}) {
  const params = new URLSearchParams();
  if (filters.inicio) params.set('inicio', filters.inicio);
  if (filters.fim) params.set('fim', filters.fim);
  if (filters.usuarioId) params.set('usuario_id', filters.usuarioId);
  if (filters.escopo) params.set('escopo', filters.escopo);
  const query = params.toString();
  return request(`/agenda${query ? `?${query}` : ''}`);
}

export function createAgendaItem(data) {
  return request('/agenda', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAgendaItem(id, data) {
  return request(`/agenda/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAgendaItem(id) {
  return request(`/agenda/${id}`, {
    method: 'DELETE',
  });
}

export function getRelatorioGerencial() {
  return request('/relatorios/gerencial');
}

// Comercial / CRM leve

export function getComercialCockpit() {
  return request('/comercial/cockpit');
}

export function getReservasComerciais() {
  return request('/comercial/reservas');
}

export function converterReservaEmVenda(tipo, id, vendidoEm) {
  return request('/comercial/reservas/converter-venda', {
    method: 'POST',
    body: JSON.stringify({ tipo, id, vendido_em: vendidoEm }),
  });
}

export function gerarPropostaComercial(tipo, id, formato = 'html') {
  return request(`/comercial/documentos/proposta?formato=${encodeURIComponent(formato)}`, {
    method: 'POST',
    body: JSON.stringify({ tipo, id }),
  });
}

// ── Métricas computadas localmente ───────────────────────────────────────────

export function computeMetrics(loteamentos) {
  let total = 0, disp = 0, res = 0, ven = 0, vgvTotal = 0, vgvVendido = 0;
  for (const l of loteamentos) {
    if (l.ativo === false) continue;
    for (const lot of l.lots || []) {
      total++;
      vgvTotal += Number(lot.preco) || 0;
      if (lot.status === 'disponivel') disp++;
      else if (lot.status === 'reservado') res++;
      else if (lot.status === 'vendido') { ven++; vgvVendido += Number(lot.preco) || 0; }
    }
  }
  return { total, disp, res, ven, vgvTotal, vgvVendido };
}

export function flattenLots(loteamentos = []) {
  return loteamentos
    .filter((loteamento) => loteamento.ativo !== false)
    .flatMap((loteamento) =>
      (loteamento.lots || []).map((lot) => ({
        ...lot,
        loteamentoId: loteamento.id,
        loteamentoNome: loteamento.nome,
        bairro: loteamento.bairro,
        cidade: loteamento.cidade,
        estado: loteamento.estado,
      }))
    );
}
