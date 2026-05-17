const NAV = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    id: 'ingresos',
    label: 'Ingresos',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M7 8h10M7 12h6" />
        <rect x="3" y="5" width="18" height="14" rx="2" />
      </svg>
    ),
  },
  {
    id: 'gastos',
    label: 'Gastos',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" />
      </svg>
    ),
  },
  {
    id: 'gastos_fijos',
    label: 'Gastos fijos',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
  {
    id: 'categorias',
    label: 'Categorías',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <path d="M7 6v12" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Usuarios',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

function sidebarDisplayName(user) {
  if (!user) return '';
  const name = String(user.name || '').trim();
  if (name) return name;
  const username = String(user.username || '').trim();
  if (username) return username;
  return String(user.email || '').trim();
}

export default function Sidebar({ active, onNavigate, open, onClose, role = 'appuser', onLogout, user = null }) {
  const visibleNav = NAV.filter((item) => {
    if (role === 'admin') return true;
    // appuser: dashboard, incomes, expenses only
    return item.id === 'dashboard' || item.id === 'ingresos' || item.id === 'gastos';
  });
  const who = sidebarDisplayName(user);
  return (
    <>
      <button type="button" className={`sidebar-backdrop ${open ? 'is-visible' : ''}`} aria-label="Cerrar menú" onClick={onClose} />
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Navegación principal">
        {who ? (
          <div className="sidebar-user">
            <div className="sidebar-user-caption">Conectado como</div>
            <div className="sidebar-user-name">{who}</div>
          </div>
        ) : null}
        <div className="sidebar-menu-label">Menú</div>
        <nav className="sidebar-nav">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${active === item.id ? 'is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
