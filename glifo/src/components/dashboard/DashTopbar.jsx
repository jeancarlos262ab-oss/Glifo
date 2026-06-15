import { useState, useEffect, useRef } from 'react';
import { Bell, Search, Zap, X, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';
import { useNotif } from '../../context/NotifContext';
import { jobsApi } from '../../services/api';
import styles from './DashTopbar.module.css';

const PAGE_LABELS = {
  overview:   'Resumen',
  ingesta:    'Ingesta de Piezas',
  piezas:     'Piezas del Acervo',
  buscador:   'Buscador Semántico',
  grafo:      'Grafo de Conocimiento',
  api:        'API Explorer',
  datasets:   'Datasets',
  analytics:  'Analíticas',
  settings:   'Configuración',
};

const NOTIF_ICONS = {
  success: CheckCircle2,
  error:   AlertCircle,
  info:    Info,
};
const NOTIF_COLORS = {
  success: '#3DAA6A',
  error:   '#B04A4A',
  info:    'var(--accent-azul-suave)',
};

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  return `hace ${Math.floor(mins / 60)}h`;
}

export default function DashTopbar({ page, onNavigate }) {
  const label = PAGE_LABELS[page] || 'Dashboard';
  const { notifs, dismiss, clear } = useNotif();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [colaCount, setColaCount] = useState(0);
  const [ollamaOk, setOllamaOk] = useState(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);

  // Keyboard shortcut Cmd/Ctrl+K for search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setSearchQ('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Poll cola status every 15s
  useEffect(() => {
    const fetchCola = async () => {
      try {
        const cola = await jobsApi.cola();
        setColaCount((cola.pendientes || 0) + (cola.ejecutando || 0));
      } catch { setColaCount(0); }
    };
    fetchCola();
    const t = setInterval(fetchCola, 15000);
    return () => clearInterval(t);
  }, []);

  // Check Ollama
  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(r => r.json())
      .then(d => setOllamaOk(d.ollama))
      .catch(() => setOllamaOk(false));
  }, []);

  const unreadCount = notifs.length;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQ.trim()) {
      setSearchOpen(false);
      onNavigate?.('buscador');
      setSearchQ('');
    }
  };

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.left}>
          <span className={styles.pageLabel}>{label}</span>
          <div className={styles.breadcrumb}>
            <span className={styles.breadHome}>Glifo</span>
            <span className={styles.breadSep}>/</span>
            <span className={styles.breadCurrent}>{label}</span>
          </div>
        </div>

        <div className={styles.right}>
          {/* Search shortcut */}
          <button
            className={styles.searchTrigger}
            onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
          >
            <Search size={14} />
            <span className={styles.searchText}>Buscar...</span>
            <kbd className={styles.kbd}>⌘K</kbd>
          </button>

          {/* System status */}
          <div className={styles.status}>
            <span className={`${styles.statusDot} ${ollamaOk === false ? styles.statusDotErr : ollamaOk === null ? styles.statusDotPending : ''}`} />
            <span className={styles.statusText}>
              {ollamaOk === null ? 'Verificando…' : ollamaOk ? 'Ollama activo' : 'Ollama offline'}
            </span>
          </div>

          {/* Notifications */}
          <div className={styles.notifWrap} ref={notifRef}>
            <button
              className={`${styles.iconBtn} ${notifOpen ? styles.iconBtnActive : ''}`}
              aria-label="Notificaciones"
              onClick={() => setNotifOpen(o => !o)}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className={styles.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className={styles.notifDropdown}>
                <div className={styles.notifHeader}>
                  <span className={styles.notifTitle}>Notificaciones</span>
                  {notifs.length > 0 && (
                    <button className={styles.notifClearBtn} onClick={clear}>
                      Limpiar todo
                    </button>
                  )}
                </div>

                {notifs.length === 0 ? (
                  <div className={styles.notifEmpty}>
                    <Bell size={20} strokeWidth={1.3} />
                    <p>Sin notificaciones</p>
                  </div>
                ) : (
                  <div className={styles.notifList}>
                    {notifs.map(n => {
                      const Icon = NOTIF_ICONS[n.type] || Info;
                      const color = NOTIF_COLORS[n.type] || NOTIF_COLORS.info;
                      return (
                        <div key={n.id} className={styles.notifItem}>
                          <span className={styles.notifIcon} style={{ color }}>
                            <Icon size={14} />
                          </span>
                          <div className={styles.notifBody}>
                            <p className={styles.notifMsg}>{n.msg}</p>
                            <span className={styles.notifTime}>{timeAgo(n.ts)}</span>
                          </div>
                          <button
                            className={styles.notifDismiss}
                            onClick={() => dismiss(n.id)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Processing indicator */}
          {colaCount > 0 && (
            <div className={styles.processing}>
              <Zap size={13} className={styles.processingIcon} />
              <span className={styles.processingText}>{colaCount} en cola</span>
            </div>
          )}
        </div>
      </header>

      {/* Search modal */}
      {searchOpen && (
        <div className={styles.searchOverlay} onClick={() => { setSearchOpen(false); setSearchQ(''); }}>
          <div className={styles.searchModal} onClick={e => e.stopPropagation()}>
            <form className={styles.searchModalBar} onSubmit={handleSearchSubmit}>
              <Search size={16} className={styles.searchModalIcon} />
              <input
                ref={searchRef}
                className={styles.searchModalInput}
                placeholder="Buscar en el acervo…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                autoFocus
              />
              {searchQ && (
                <button type="button" className={styles.searchModalClear} onClick={() => setSearchQ('')}>
                  <X size={14} />
                </button>
              )}
            </form>
            <div className={styles.searchModalHints}>
              <span>Presiona <kbd>Enter</kbd> para buscar en el buscador semántico</span>
              <span><kbd>Esc</kbd> para cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
