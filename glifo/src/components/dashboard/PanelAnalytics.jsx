import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Clock, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, WifiOff, FileText, Image, Mic, Video, Box
} from 'lucide-react';
import { statsApi, jobsApi } from '../../services/api';
import { useNotif } from '../../context/NotifContext';
import styles from './PanelAnalytics.module.css';

const BAR_COLORS = ['#4A9EE0','#E8A838','#3EC98E','#A07BE8','#E85C78','#38C4B8'];

const typeColors = {
  documento: '#4A9EE0', imagen: '#C8A84B', audio: '#7B5EA7',
  video: '#1A5EA8', objeto: '#B04A4A', patrimonio: '#3DAA6A',
};
const typeIcons = { documento: FileText, imagen: Image, audio: Mic, video: Video, objeto: Box };

const statusColors = {
  completado: '#3DAA6A', fallido: '#B04A4A', pendiente: '#6B8AB8', ejecutando: '#C8A84B',
};

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={styles.miniBarTrack}>
      <div className={styles.miniBarFill} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function PanelAnalytics() {
  const [overview, setOverview] = useState(null);
  const [colecciones, setColecciones] = useState(null);
  const [cola, setCola] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { push } = useNotif();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, col, colaData, jobsData] = await Promise.all([
        statsApi.overview(),
        statsApi.colecciones(),
        jobsApi.cola(),
        jobsApi.listar({ limit: 50 }),
      ]);
      setOverview(ov);
      setColecciones(col);
      setCola(colaData);
      setJobs(jobsData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className={styles.panel}>
      <div className={styles.loadState}>
        <Loader2 size={20} className={styles.spin} />
        <span>Cargando analíticas…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className={styles.panel}>
      <div className={styles.errorState}>
        <WifiOff size={32} strokeWidth={1.3} />
        <p>Error cargando datos</p>
        <button className={styles.retryBtn} onClick={load}><RefreshCw size={14} /> Reintentar</button>
      </div>
    </div>
  );

  const tipos = overview?.tipos ?? {};
  const estados = overview?.estados ?? {};
  const cols = colecciones?.colecciones ?? [];
  const maxTipo = Math.max(...Object.values(tipos), 1);
  const maxCol = Math.max(...cols.map(c => c.total), 1);

  // Jobs breakdown by status
  const jobsByStatus = jobs.reduce((acc, j) => {
    acc[j.estado] = (acc[j.estado] || 0) + 1;
    return acc;
  }, {});

  // Avg processing time from completed jobs (rough estimate)
  const completedJobs = jobs.filter(j => j.estado === 'completado' && j.iniciado_en && j.completado_en);
  const avgMs = completedJobs.length > 0
    ? completedJobs.reduce((s, j) => {
        return s + (new Date(j.completado_en) - new Date(j.iniciado_en));
      }, 0) / completedJobs.length
    : null;
  const avgMin = avgMs ? (avgMs / 60000).toFixed(1) : '—';

  return (
    <div className={styles.panel}>
      <div className={styles.topBar}>
        <div>
          <p className={styles.headerLabel}>Estadísticas</p>
          <h2 className={styles.headerTitle}>Analíticas del acervo</h2>
          <p className={styles.headerSub}>Métricas en tiempo real del sistema y la colección.</p>
        </div>
        <button className={styles.refreshBtn} onClick={load}><RefreshCw size={14} /></button>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard} style={{ '--kpi-accent': '#4A9EE0' }}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal}>{overview?.total_piezas?.toLocaleString() ?? '—'}</span>
            <span className={styles.kpiLabel}>piezas totales</span>
          </div>
          <div className={styles.kpiIcon} style={{ color: '#4A9EE0' }}>
            <BarChart3 size={64} strokeWidth={1} />
          </div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-accent': '#3DAA6A' }}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal}>{estados.listo ?? 0}</span>
            <span className={styles.kpiLabel}>procesadas</span>
          </div>
          <div className={styles.kpiIcon} style={{ color: '#3DAA6A' }}>
            <CheckCircle2 size={64} strokeWidth={1} />
          </div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-accent': '#C8A84B' }}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal}>{(estados.procesando ?? 0) + (estados.pendiente ?? 0)}</span>
            <span className={styles.kpiLabel}>en cola</span>
          </div>
          <div className={styles.kpiIcon} style={{ color: '#C8A84B' }}>
            <Clock size={64} strokeWidth={1} />
          </div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-accent': '#B04A4A' }}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal}>{estados.error ?? 0}</span>
            <span className={styles.kpiLabel}>con error</span>
          </div>
          <div className={styles.kpiIcon} style={{ color: '#B04A4A' }}>
            <AlertCircle size={64} strokeWidth={1} />
          </div>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-accent': '#A07BE8' }}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal}>{overview?.esta_semana ?? 0}</span>
            <span className={styles.kpiLabel}>esta semana</span>
          </div>
          <div className={styles.kpiIcon} style={{ color: '#A07BE8' }}>
            <TrendingUp size={64} strokeWidth={1} />
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Tipos */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Distribución por tipo</h3>
          </div>
          <div className={styles.chartList}>
            {Object.entries(tipos).map(([tipo, cnt], i) => {
              const Icon = typeIcons[tipo] || Box;
              return (
                <div key={tipo} className={styles.chartRow}>
                  <div className={styles.chartLabel}>
                    <Icon size={13} style={{ color: typeColors[tipo] || '#6B8AB8' }} />
                    <span>{tipo}</span>
                  </div>
                  <MiniBar value={cnt} max={maxTipo} color={typeColors[tipo] || BAR_COLORS[i % BAR_COLORS.length]} />
                  <span className={styles.chartVal}>{cnt}</span>
                </div>
              );
            })}
            {Object.keys(tipos).length === 0 && (
              <div className={styles.emptyChart}>Sin datos de tipos</div>
            )}
          </div>
        </div>

        {/* Estados */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Estado de procesamiento</h3>
          </div>
          <div className={styles.chartList}>
            {Object.entries(estados).map(([est, cnt]) => {
              const total = Object.values(estados).reduce((a, b) => a + b, 1);
              const pct = Math.round((cnt / total) * 100);
              return (
                <div key={est} className={styles.chartRow}>
                  <div className={styles.chartLabel}>
                    <span className={styles.statusDot} style={{ background: statusColors[est] || '#6B8AB8' }} />
                    <span>{est}</span>
                  </div>
                  <MiniBar value={cnt} max={total} color={statusColors[est] || '#6B8AB8'} />
                  <span className={styles.chartVal}>{cnt} <span className={styles.chartPct}>({pct}%)</span></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Colecciones */}
        <div className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Top colecciones</h3>
          </div>
          <div className={styles.chartList}>
            {cols.slice(0, 8).map((col, i) => (
              <div key={col.nombre} className={styles.chartRow}>
                <div className={styles.chartLabel}>
                  <span className={styles.colBullet} style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                  <span>{col.nombre}</span>
                </div>
                <MiniBar value={col.total} max={maxCol} color={BAR_COLORS[i % BAR_COLORS.length]} />
                <span className={styles.chartVal}>{col.total}</span>
              </div>
            ))}
            {cols.length === 0 && <div className={styles.emptyChart}>Sin colecciones</div>}
          </div>
        </div>

        {/* Jobs stats */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Cola de procesamiento</h3>
          </div>
          <div className={styles.queueStats}>
            {cola && (
              <>
                <div className={styles.queueStat}>
                  <span className={styles.queueStatVal} style={{ color: '#C8A84B' }}>{cola.pendientes}</span>
                  <span className={styles.queueStatLabel}>pendientes</span>
                </div>
                <div className={styles.queueStat}>
                  <span className={styles.queueStatVal} style={{ color: '#4A9EE0' }}>{cola.ejecutando}</span>
                  <span className={styles.queueStatLabel}>ejecutando</span>
                </div>
                <div className={styles.queueStat}>
                  <span className={styles.queueStatVal} style={{ color: '#3DAA6A' }}>{cola.completados_hoy}</span>
                  <span className={styles.queueStatLabel}>completados hoy</span>
                </div>
                <div className={styles.queueStat}>
                  <span className={styles.queueStatVal} style={{ color: '#B04A4A' }}>{cola.fallidos}</span>
                  <span className={styles.queueStatLabel}>fallidos</span>
                </div>
              </>
            )}
          </div>
          <div className={styles.cardDivider} />
          <div className={styles.processingInfo}>
            <div className={styles.processingRow}>
              <span className={styles.processingLabel}>Tiempo prom. procesamiento</span>
              <span className={styles.processingVal}>{avgMin === '—' ? '—' : `${avgMin} min`}</span>
            </div>
            <div className={styles.processingRow}>
              <span className={styles.processingLabel}>Total jobs registrados</span>
              <span className={styles.processingVal}>{jobs.length}</span>
            </div>
            <div className={styles.processingRow}>
              <span className={styles.processingLabel}>Costo de API</span>
              <span className={styles.processingVal} style={{ color: '#3DAA6A' }}>$0.00</span>
            </div>
          </div>
        </div>

        {/* Grafo */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Grafo de conocimiento</h3>
          </div>
          <div className={styles.grafoStats}>
            <div className={styles.grafoStat}>
              <span className={styles.grafoVal}>{overview?.grafo?.nodos ?? '—'}</span>
              <span className={styles.grafoLabel}>nodos</span>
            </div>
            <div className={styles.grafoSep} />
            <div className={styles.grafoStat}>
              <span className={styles.grafoVal}>{overview?.grafo?.aristas ?? '—'}</span>
              <span className={styles.grafoLabel}>aristas</span>
            </div>
            <div className={styles.grafoSep} />
            <div className={styles.grafoStat}>
              <span className={styles.grafoVal}>{overview?.indice_semantico?.piezas_indexadas ?? '—'}</span>
              <span className={styles.grafoLabel}>indexadas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
