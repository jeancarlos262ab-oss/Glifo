import { useState } from 'react';
import {
  LayoutDashboard, FileText, Search, Share2, Globe,
  Upload, Settings, ChevronLeft, ChevronRight,
  Database, BarChart3, LogOut, User
} from 'lucide-react';
import styles from './DashSidebar.module.css';

const navItems = [
  { id: 'overview',   icon: LayoutDashboard, label: 'Resumen',       group: 'principal' },
  { id: 'ingesta',    icon: Upload,           label: 'Ingesta',        group: 'principal' },
  { id: 'piezas',     icon: FileText,         label: 'Piezas',         group: 'principal' },
  { id: 'buscador',   icon: Search,           label: 'Buscador',       group: 'principal' },
  { id: 'grafo',      icon: Share2,           label: 'Grafo',          group: 'explorar'  },
  { id: 'api',        icon: Globe,            label: 'API Explorer',   group: 'explorar'  },
  { id: 'datasets',   icon: Database,         label: 'Datasets',       group: 'explorar'  },
  { id: 'analytics',  icon: BarChart3,        label: 'Analíticas',     group: 'explorar'  },
  { id: 'settings',   icon: Settings,         label: 'Configuración',  group: 'sistema'   },
];

const groups = {
  principal: 'Principal',
  explorar:  'Explorar',
  sistema:   'Sistema',
};

export default function DashSidebar({ active, onNavigate, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);

  const user = (() => {
    try { return JSON.parse(sessionStorage.getItem('glifo_user') || '{}'); }
    catch { return {}; }
  })();

  const handleLogout = () => {
    sessionStorage.removeItem('glifo_user');
    onLogout?.();
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logoArea}>
        <a href="#" onClick={e => e.preventDefault()} className={styles.logo}>
          <span className={styles.logoGlyph}>G</span>
          {!collapsed && <span className={styles.logoText}>lifo</span>}
        </a>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {Object.entries(groups).map(([groupKey, groupLabel]) => {
          const items = navItems.filter(i => i.group === groupKey);
          return (
            <div key={groupKey} className={styles.navGroup}>
              {!collapsed && (
                <span className={styles.groupLabel}>{groupLabel}</span>
              )}
              {items.map(item => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    className={`${styles.navItem} ${isActive ? styles.navActive : ''}`}
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={17} strokeWidth={1.8} className={styles.navIcon} />
                    {!collapsed && (
                      <span className={styles.navLabel}>{item.label}</span>
                    )}
                    {isActive && !collapsed && (
                      <span className={styles.navPip} />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className={styles.userArea}>
        <div className={styles.userCard}>
          <div className={styles.avatar}>
            <User size={15} />
          </div>
          {!collapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {user.nombre || 'Usuario'}
              </span>
              <span className={styles.userRole}>
                {user.rol || 'Admin'} · {user.institucion || 'BUAP'}
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              className={styles.logoutBtn}
              title="Cerrar sesión"
              onClick={handleLogout}
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            className={`${styles.logoutBtn} ${styles.logoutBtnCollapsed}`}
            title="Cerrar sesión"
            onClick={handleLogout}
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}
