import { getToken } from './auth';

const API_BASE = '/api-proxy';

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    // Token expirado ou inválido — força logout via evento
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

export function updateLoteStatus(dbId, status) {
  return request(`/lotes/${dbId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateLote(dbId, data) {
  return request(`/lotes/${dbId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteLote(dbId) {
  return request(`/lotes/${dbId}`, { method: 'DELETE' });
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
