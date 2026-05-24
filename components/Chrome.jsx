// chrome.jsx - Sidebar + Header

import { useState, useEffect, useRef } from 'react';

export const Sidebar = ({ view, onNavigate, counts = {}, user, onLogout, empresas = [], selectedEmpresa, onSelectEmpresa }) => {
  const roleLabels = {
    admin: 'Administrador',
    gerente: 'Gerente',
    vendedor: 'Vendedor',
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'loteamentos', label: 'Loteamentos', icon: 'map', badge: counts.loteamentos },
    { id: 'lotes', label: 'Lotes', icon: 'grid', badge: counts.lotes },
    { id: 'vendas', label: 'Vendas', icon: 'bag', badge: counts.vendas },
    { id: 'clientes', label: 'Clientes', icon: 'client', badge: counts.clientes },
    ...(user?.role === 'admin'
      ? [{ id: 'admin', label: 'Admin', icon: 'shield' }]
      : []),
  ];

  const iconPaths = {
    home: <path d="M3 7.5L9 3l6 4.5V14a1 1 0 0 1-1 1h-3v-4H7v4H4a1 1 0 0 1-1-1V7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />,
    map: <path d="M2 4l4-1 4 1 4-1v11l-4 1-4-1-4 1V4zM6 3v11M10 4v11" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />,
    grid: <path d="M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z" stroke="currentColor" strokeWidth="1.3" fill="none" />,
    bag: <path d="M3 6h12l-1 9H4L3 6zM6 6V4a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />,
    client: <path d="M8 8.2a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8zM3 15v-1.1c0-2.2 2.2-4 5-4s5 1.8 5 4V15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    users: <path d="M6.5 8a2.7 2.7 0 1 0 0-5.4A2.7 2.7 0 0 0 6.5 8zM2.5 15v-1.1c0-2 1.8-3.6 4-3.6s4 1.6 4 3.6V15M12 7.7a2.1 2.1 0 1 0 0-4.2M11.6 10.4c1.8.2 3.1 1.6 3.1 3.3V15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    shield: <path d="M9 2.5l5 1.8v3.8c0 3.2-1.9 5.7-5 7.1-3.1-1.4-5-3.9-5-7.1V4.3l5-1.8zM6.7 8.8l1.4 1.4 3.2-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  };

  const initials = user?.nome
    ? user.nome.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const displayName = user?.nome || user?.email || 'Usuario';
  const displayRole = roleLabels[user?.role] || 'Usuario';

  return (
    <aside className="sidebar">
      <div className="sb-brand" onClick={() => onNavigate('dashboard')}>
        <div className="sb-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" fill="currentColor" />
            <circle cx="12" cy="12" r="1.7" fill="#0d1b3e" />
          </svg>
        </div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">Terreno</div>
          <div className="sb-brand-sub">Loteamentos e lotes</div>
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="sb-empresa-picker">
          <div className="sb-nav-section">EMPRESA ATIVA</div>
          <EmpresaDropdown
            empresas={empresas}
            selected={selectedEmpresa}
            onSelect={onSelectEmpresa}
          />
        </div>
      )}

      <nav className="sb-nav">
        <div className="sb-nav-section">GESTÃO</div>
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            iconPath={iconPaths[item.icon]}
            active={
              view === item.id ||
              (view === 'map' && item.id === 'loteamentos') ||
              (view === 'editor' && item.id === 'loteamentos')
            }
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      <div className="sb-foot">
        <div className="sb-user">
          <div className="sb-user-avatar">{initials}</div>
          <div className="sb-user-body">
            <div className="sb-user-name">{displayName}</div>
            <div className="sb-user-role">{displayRole}</div>
          </div>
        </div>
        {onLogout && (
          <button className="sb-logout-btn" onClick={onLogout}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sair do sistema
          </button>
        )}
      </div>
    </aside>
  );
};

function EmpresaDropdown({ empresas, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="emp-dd" ref={ref}>
      <button
        className={'emp-dd-trigger' + (open ? ' emp-dd-trigger-open' : '')}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="emp-dd-label">
          {selected ? selected.nome : '— Selecione uma empresa —'}
        </span>
        <svg className={'emp-dd-chevron' + (open ? ' emp-dd-chevron-up' : '')} width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="emp-dd-list">
          {empresas.length === 0 ? (
            <div className="emp-dd-empty">Nenhuma empresa cadastrada</div>
          ) : (
            empresas.map((emp) => (
              <button
                key={emp.id}
                className={'emp-dd-item' + (selected?.id === emp.id ? ' emp-dd-item-active' : '')}
                onClick={() => { onSelect?.(emp); setOpen(false); }}
                type="button"
              >
                <span className="emp-dd-item-nome">{emp.nome}</span>
                {emp.cidade && (
                  <span className="emp-dd-item-loc">{[emp.cidade, emp.estado].filter(Boolean).join(' / ')}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NavItem({ item, iconPath, active, onClick }) {
  return (
    <button className={'sb-item' + (active ? ' sb-item-active' : '')} onClick={onClick}>
      <span className="sb-item-ic">
        <svg width="16" height="16" viewBox="0 0 18 18">{iconPath}</svg>
      </span>
      <span className="sb-item-lbl">{item.label}</span>
      {item.badge != null && <span className="sb-item-badge">{item.badge}</span>}
      {active && <span className="sb-item-rail" />}
    </button>
  );
}

export const Header = ({ view, loteamentoNome, onBack }) => {
  const titles = {
    dashboard: 'Dashboard',
    vendas: 'Vendas',
    lotes: 'Lotes',
    clientes: 'Clientes',
    usuarios: 'Usuarios',
    admin: 'Admin',
  };

  return (
    <header className="topbar">
      <div className="tb-left">
        {view === 'map' && (
          <button className="tb-back" onClick={onBack}>
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            Voltar
          </button>
        )}
        <div className="tb-crumbs">
          <span className="tb-crumb">{titles[view] || 'Loteamentos'}</span>
          {view === 'map' && (
            <>
              <span className="tb-crumb-sep">/</span>
              <span className="tb-crumb tb-crumb-active">{loteamentoNome}</span>
            </>
          )}
        </div>
      </div>
      <div className="tb-search">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input placeholder="Buscar loteamentos e lotes..." />
      </div>
    </header>
  );
};
