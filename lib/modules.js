export const APP_MODULES = [
  { id: 'dashboard', label: 'Dashboard', description: 'Painel inicial e indicadores gerais.' },
  { id: 'loteamentos', label: 'Loteamentos', description: 'Lista e mapa dos loteamentos.' },
  { id: 'predios', label: 'Prédios', description: 'Lista, plantas e apartamentos.' },
  { id: 'locacoes', label: 'Locações', description: 'Contratos de aluguel e pagamentos.' },
  { id: 'comercial', label: 'Comercial', description: 'Reservas, propostas e negociações.' },
  { id: 'lotes', label: 'Lotes', description: 'Estoque de lotes e ações de venda.' },
  { id: 'vendas', label: 'Vendas', description: 'Vendas realizadas e histórico comercial.' },
  { id: 'clientes', label: 'Clientes', description: 'Cadastro e consulta de clientes.' },
  { id: 'relatorios', label: 'Relatórios', description: 'Indicadores, exportações e análises.' },
];

export const DEFAULT_VENDEDOR_MODULES = [
  'dashboard',
  'loteamentos',
  'predios',
  'comercial',
  'lotes',
  'vendas',
  'clientes',
];

export function normalizeModules(value, fallback = []) {
  const allowed = new Set(APP_MODULES.map((module) => module.id));
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((item) => allowed.has(item)))];
}

export function userHasModule(user, moduleId) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'gerente') return true;
  if (user.role !== 'vendedor') return false;
  const modules = normalizeModules(user.modulos_permitidos, DEFAULT_VENDEDOR_MODULES);
  return modules.includes(moduleId);
}
