import { lazy, Suspense, useState } from 'react';
import DashSidebar from '../components/dashboard/DashSidebar';
import DashTopbar  from '../components/dashboard/DashTopbar';
import styles from './Dashboard.module.css';

const PanelOverview   = lazy(() => import('../components/dashboard/PanelOverview'));
const PanelIngesta    = lazy(() => import('../components/dashboard/PanelIngesta'));
const PanelPiezas     = lazy(() => import('../components/dashboard/PanelPiezas'));
const PanelBuscador   = lazy(() => import('../components/dashboard/PanelBuscador'));
const PanelGrafo      = lazy(() => import('../components/dashboard/PanelGrafo'));
const PanelSettings   = lazy(() => import('../components/dashboard/PanelSettings'));
const PanelApi        = lazy(() => import('../components/dashboard/PanelApi'));
const PanelDatasets   = lazy(() => import('../components/dashboard/PanelDatasets'));
const PanelAnalytics  = lazy(() => import('../components/dashboard/PanelAnalytics'));

function PanelLoader() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        opacity: 0.45,
      }}>Cargando panel…</span>
    </div>
  );
}

export default function Dashboard({ onLogout }) {
  const [page, setPage] = useState('overview');

  const renderPanel = () => {
    switch (page) {
      case 'overview':  return <PanelOverview onNavigate={setPage} />;
      case 'ingesta':   return <PanelIngesta />;
      case 'piezas':    return <PanelPiezas onNavigate={setPage} />;
      case 'buscador':  return <PanelBuscador />;
      case 'grafo':     return <PanelGrafo />;
      case 'api':       return <PanelApi />;
      case 'datasets':  return <PanelDatasets onNavigate={setPage} />;
      case 'analytics': return <PanelAnalytics />;
      case 'settings':  return <PanelSettings />;
      default:          return <PanelOverview onNavigate={setPage} />;
    }
  };

  return (
    <div className={styles.root}>
      <DashSidebar active={page} onNavigate={setPage} onLogout={onLogout} />
      <div className={styles.body}>
        <DashTopbar page={page} onNavigate={setPage} />
        <main className={styles.content}>
          <Suspense fallback={<PanelLoader />}>
            {renderPanel()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
