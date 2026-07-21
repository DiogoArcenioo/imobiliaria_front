export const APP_MODULES = [
  { id: 'dashboard', label: 'Dashboard', description: 'Painel inicial e indicadores gerais.' },
  { id: 'loteamentos', label: 'Loteamentos', description: 'Lista e mapa dos loteamentos.' },
  { id: 'predios', label: 'Predios', description: 'Lista, plantas e apartamentos.' },
  { id: 'casas', label: 'Casas', description: 'Cadastro, venda e aluguel de casas.' },
  { id: 'locacoes', label: 'Locacoes', description: 'Contratos de aluguel e pagamentos.' },
  { id: 'comercial', label: 'Comercial', description: 'Reservas, propostas e negociacoes.' },
  { id: 'lotes', label: 'Lotes', description: 'Estoque de lotes e acoes de venda.' },
  { id: 'vendas', label: 'Vendas', description: 'Vendas realizadas e historico comercial.' },
  { id: 'clientes', label: 'Clientes', description: 'Cadastro e consulta de clientes.' },
  { id: 'agenda', label: 'Agenda', description: 'Tarefas, visitas e atendimentos do time comercial.' },
  { id: 'relatorios', label: 'Relatorios', description: 'Indicadores, exportacoes e analises.' },
];

export const DEFAULT_VENDEDOR_MODULES = [
  'dashboard',
  'loteamentos',
  'predios',
  'casas',
  'comercial',
  'lotes',
  'vendas',
  'clientes',
  'agenda',
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
