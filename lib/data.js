// Helpers de apresentacao. Os dados de loteamentos e lotes vêm da API.

export function fmtBRL(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function fmtBRLShort(value) {
  const n = Number(value) || 0;
  if (n >= 1e6) return 'R$ ' + (n / 1e6).toFixed(1).replace('.', ',') + ' mi';
  if (n >= 1e3) return 'R$ ' + (n / 1e3).toFixed(0) + ' mil';
  return 'R$ ' + n.toFixed(0);
}

export function statusLabel(status) {
  return {
    disponivel: 'Disponível',
    reservado: 'Reservado',
    vendido: 'Vendido',
  }[status] || status || 'Disponível';
}
