// chrome.jsx - Sidebar + Header

export const Sidebar = ({ view, onNavigate, counts = {} }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'loteamentos', label: 'Loteamentos', icon: 'map', badge: counts.loteamentos },
    { id: 'lotes', label: 'Lotes', icon: 'grid', badge: counts.lotes },
    { id: 'vendas', label: 'Vendas', icon: 'bag', badge: counts.vendas },
  ];

  const iconPaths = {
    home: <path d="M3 7.5L9 3l6 4.5V14a1 1 0 0 1-1 1h-3v-4H7v4H4a1 1 0 0 1-1-1V7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />,
    map: <path d="M2 4l4-1 4 1 4-1v11l-4 1-4-1-4 1V4zM6 3v11M10 4v11" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />,
    grid: <path d="M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z" stroke="currentColor" strokeWidth="1.3" fill="none" />,
    bag: <path d="M3 6h12l-1 9H4L3 6zM6 6V4a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />,
  };

  return (
    <aside className="sidebar">
      <div className="sb-brand" onClick={() => onNavigate('dashboard')}>
        <div className="sb-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" fill="currentColor" />
            <circle cx="12" cy="12" r="1.7" fill="#0a0e14" />
          </svg>
        </div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">Terreno</div>
          <div className="sb-brand-sub">Loteamentos e lotes</div>
        </div>
      </div>

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
    </aside>
  );
};

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

export const Header = ({ view, loteamentoNome, onBack, userEmail, onLogout }) => {
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
          <span className="tb-crumb">{view === 'dashboard' ? 'Dashboard' : view === 'vendas' ? 'Vendas' : view === 'lotes' ? 'Lotes' : 'Loteamentos'}</span>
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
      {onLogout && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12 }}>
          {userEmail && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </span>
          )}
          <button
            onClick={onLogout}
            title="Sair"
            style={{
              background: 'transparent',
              border: '1px solid var(--border, #334155)',
              borderRadius: 6,
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px 10px',
              fontSize: '0.75rem',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sair
          </button>
        </div>
      )}
    </header>
  );
};
