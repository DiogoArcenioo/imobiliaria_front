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

export function updateLoteStatus(dbId, status, clienteId, observacao) {
  return request(`/lotes/${dbId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, cliente_id: clienteId, observacao: observacao || undefined }),
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

// ── Negociação: etapas ────────────────────────────────────────────────────────

export function getEtapas(loteDbId) {
  return request(`/negociacao/lotes/${loteDbId}/etapas`);
}

export function createEtapa(loteDbId, descricao) {
  return request(`/negociacao/lotes/${loteDbId}/etapas`, {
    method: 'POST',
    body: JSON.stringify({ descricao }),
  });
}

export function updateEtapa(etapaId, descricao) {
  return request(`/negociacao/etapas/${etapaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ descricao }),
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

// ── Métricas computadas localmente ───────────────────────────────────────────

export function computeMetrics(loteamentos) {
  let total = 0, disp = 0, res = 0, ven = 0, vgvTotal = 0, vgvVendido = 0;
  for (const l of loteamentos) {
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
  return loteamentos.flatMap((loteamento) =>
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
