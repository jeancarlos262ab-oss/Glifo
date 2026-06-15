import { lazy, Suspense, useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NotifProvider } from './context/NotifContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import './index.css';

const Home      = lazy(() => import('./pages/Home'));
const Auth      = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

function PageShell() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        opacity: 0.5,
      }}>Cargando…</span>
    </div>
  );
}

function AppInner() {
  const [page, setPage] = useState('landing');
  const [authMode, setAuthMode] = useState('login');
  const { forceLightMode, restoreTheme } = useTheme();

  useEffect(() => {
    if (page === 'landing' || page === 'auth') {
      forceLightMode();
    } else {
      restoreTheme();
    }
  }, [page]);

  const goToLogin    = () => { setAuthMode('login');  setPage('auth'); };
  const goToRegister = () => { setAuthMode('signup'); setPage('auth'); };

  return (
    <>
      {page === 'landing' && (
        <>
          <Navbar onLogin={goToLogin} onRegister={goToRegister} />
          <Suspense fallback={<PageShell />}>
            <Home />
          </Suspense>
          <Footer onDashboard={() => setPage('dashboard')} />
        </>
      )}

      {page === 'auth' && (
        <Suspense fallback={<PageShell />}>
          <Auth
            initialMode={authMode}
            onSuccess={() => setPage('dashboard')}
            onBack={() => setPage('landing')}
          />
        </Suspense>
      )}

      {page === 'dashboard' && (
        <Suspense fallback={<PageShell />}>
          <Dashboard onLogout={() => setPage('landing')} />
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NotifProvider>
        <AppInner />
      </NotifProvider>
    </ThemeProvider>
  );
}
