import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Image, Mic, Video, Share2, TrendingUp,
  Clock, CheckCircle2, AlertCircle, Upload, ArrowUpRight,
  RefreshCw, Loader2, Wifi, WifiOff
} from 'lucide-react';
import { statsApi } from '../../services/api';
import { useNotif } from '../../context/NotifContext';
import styles from './PanelOverview.module.css';

const typeIcons = { documento: FileText, video: Video, imagen: Image, audio: Mic };
const typeColors = {
  documento: 'var(--accent-primary)',
  video:     'var(--accent-azul-claro)',
  imagen:    'var(--accent-dorado)',
  audio:     '#7B5EA7',
};
const statusConfig = {
  listo:       { label: 'Listo',      icon: CheckCircle2, color: '#3DAA6A' },
  procesando:  { label: 'Procesando', icon: Clock,        color: 'var(--accent-dorado)' },
  pendiente:   { label: 'Pendiente',  icon: Clock,        color: '#6B8AB8' },
  error:       { label: 'Error',      icon: AlertCircle,  color: '#B04A4A' },
};

const BAR_COLORS = ['#4A9EE0','#E8A838','#3EC98E','#A07BE8','#E85C78','#38C4B8','#F08030','#60C8A8'];

function timeAgo(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

// SVG centrados verticalmente (todos los elementos dentro del viewBox 120x120)
function getTimeOfDay(hour) {
  if (hour >= 0 && hour < 5) {
    // Madrugada — luna creciente centrada
    return {
      greeting: 'Buenas noches',
      icon: (
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0, 0)">
            {/* Luna creciente centrada en (60,60) */}
            <path d="M72 36 C52 38 36 52 36 68 C36 84 50 96 66 94 C58 92 50 86 46 76 C42 66 42 56 48 48 C54 40 62 34 72 36Z" fill="currentColor"/>
            <path d="M72 36 C62 34 54 40 48 48 C42 56 42 66 46 76 C50 86 58 92 66 94 C70 88 72 80 72 70 C72 60 68 46 72 36Z" fill="currentColor"/>
            {/* Estrella principal */}
            <path d="M96 28 L98 34 L104 34 L99.5 38.5 L102 45 L96 41 L90 45 L92.5 38.5 L88 34 L94 34 Z" fill="currentColor"/>
            {/* Estrellas secundarias */}
            <circle cx="22" cy="40" r="2.5" fill="currentColor"/>
            <circle cx="100" cy="56" r="2" fill="currentColor"/>
            <circle cx="18" cy="66" r="2" fill="currentColor"/>
            <circle cx="86" cy="86" r="2.5" fill="currentColor"/>
            <circle cx="30" cy="90" r="1.8" fill="currentColor"/>
          </g>
        </svg>
      ),
    };
  } else if (hour >= 5 && hour < 8) {
    // Amanecer — sol emergiendo centrado
    return {
      greeting: 'Buenos días',
      icon: (
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0, 0)">
            {/* Línea de horizonte */}
            <path d="M12 86 L108 86" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <path d="M20 92 L100 92" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            {/* Sol - semicírculo centrado en X=60, base en Y=86 */}
            <path d="M34 86 A26 26 0 0 1 86 86" stroke="currentColor" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
            {/* Rayos del amanecer */}
            <line x1="60" y1="48" x2="60" y2="36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="78" y1="56" x2="86" y2="46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <line x1="42" y1="56" x2="34" y2="46" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <line x1="92" y1="70" x2="102" y2="64" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="28" y1="70" x2="18" y2="64" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </g>
        </svg>
      ),
    };
  } else if (hour >= 8 && hour < 13) {
    // Mañana — sol radiante centrado en (60,60)
    return {
      greeting: 'Buenos días',
      icon: (
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0, 0)">
            {/* Núcleo solar centrado */}
            <circle cx="60" cy="60" r="18" fill="currentColor"/>
            <circle cx="60" cy="60" r="18" stroke="currentColor" strokeWidth="2"/>
            {/* Rayos largos - 8 direcciones */}
            <line x1="60" y1="14" x2="60" y2="30" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            <line x1="60" y1="90" x2="60" y2="106" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            <line x1="14" y1="60" x2="30" y2="60" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            <line x1="90" y1="60" x2="106" y2="60" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            <line x1="24" y1="24" x2="35" y2="35" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            <line x1="85" y1="85" x2="96" y2="96" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            <line x1="96" y1="24" x2="85" y2="35" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            <line x1="35" y1="85" x2="24" y2="96" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            {/* Rayos cortos intercalados */}
            <line x1="60" y1="34" x2="60" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="60" y1="82" x2="60" y2="86" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="34" y1="60" x2="38" y2="60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="82" y1="60" x2="86" y2="60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </g>
        </svg>
      ),
    };
  } else if (hour >= 13 && hour < 19) {
    // Tarde — sol con nube centrado
    return {
      greeting: 'Buenas tardes',
      icon: (
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0, 0)">
            {/* Sol visible detrás - centrado */}
            <circle cx="46" cy="52" r="16" stroke="currentColor" strokeWidth="4" fill="none"/>
            {/* Rayos solares visibles */}
            <line x1="46" y1="24" x2="46" y2="30" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <line x1="68" y1="32" x2="63" y2="37" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="24" y1="32" x2="29" y2="37" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="18" y1="52" x2="26" y2="52" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            {/* Nube centrada */}
            <path d="M36 80 C26 80 22 72 24 64 C26 56 34 54 38 56 C40 48 50 46 56 50 C60 44 70 44 74 50 C80 48 86 52 86 60 C88 68 84 76 76 78 C68 80 46 80 36 80Z" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
          </g>
        </svg>
      ),
    };
  } else if (hour >= 19 && hour < 21) {
    // Atardecer — sol en horizonte centrado
    return {
      greeting: 'Buenas tardes',
      icon: (
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0, 0)">
            {/* Horizonte con capas */}
            <line x1="12" y1="86" x2="108" y2="86" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="18" y1="92" x2="102" y2="92" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="24" y1="97" x2="96" y2="97" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            {/* Sol semicírculo - base en Y=86 */}
            <path d="M32 86 A28 28 0 0 1 88 86" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round"/>
            {/* Rayos atardecer */}
            <line x1="60" y1="44" x2="60" y2="34" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="80" y1="54" x2="88" y2="44" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <line x1="40" y1="54" x2="32" y2="44" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <line x1="94" y1="68" x2="104" y2="62" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="26" y1="68" x2="16" y2="62" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </g>
        </svg>
      ),
    };
  } else {
    // Noche — luna llena centrada en (60,60)
    return {
      greeting: 'Buenas noches',
      icon: (
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0, 0)">
            {/* Luna llena centrada */}
            <circle cx="60" cy="60" r="24" fill="currentColor"/>
            <circle cx="60" cy="60" r="24" stroke="currentColor" strokeWidth="2"/>
            {/* Cráteres */}
            <ellipse cx="52" cy="54" rx="5" ry="4.5" stroke="currentColor" strokeWidth="2" fill="none"/>
            <ellipse cx="68" cy="68" rx="3.5" ry="3" stroke="currentColor" strokeWidth="1.8" fill="none"/>
            <ellipse cx="56" cy="74" rx="3" ry="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <circle cx="72" cy="50" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <circle cx="48" cy="66" r="1.8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            {/* Estrella fugaz */}
            <path d="M100 20 L96 30 L102 27 L98 37" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Estrellas */}
            <circle cx="20" cy="30" r="2" fill="currentColor"/>
            <circle cx="104" cy="54" r="2" fill="currentColor"/>
            <circle cx="22" cy="78" r="1.8" fill="currentColor"/>
            <circle cx="98" cy="86" r="1.8" fill="currentColor"/>
            <circle cx="34" cy="22" r="1.5" fill="currentColor"/>
          </g>
        </svg>
      ),
    };
  }
}

function StatCard({ label, value, delta, up, icon: Icon, cardAccent }) {
  return (
    <div className={styles.statCard} style={{ '--card-accent': cardAccent }}>
      <div className={styles.statTop}>
        <span className={styles.statLabel}>{label}</span>
      </div>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statDelta} style={{
        color: up === false ? '#B04A4A' : up ? '#3DAA6A' : 'var(--text-muted)'
      }}>
        {up && '↑ '}{delta}
      </span>
      <div className={styles.statIconWrap} style={{ '--icon-color': cardAccent }}>
        <Icon size={80} strokeWidth={1} />
      </div>
    </div>
  );
}

export default function PanelOverview({ onNavigate }) {
  const [data, setData] = useState(null);
  const [colecciones, setColecciones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { push } = useNotif();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, col] = await Promise.all([statsApi.overview(), statsApi.colecciones()]);
      setData(ov);
      setColecciones(col);
    } catch (e) {
      setError(e.message);
      push(`Error cargando overview: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data) return;
    const hasProcessing = (data.estados?.procesando || 0) + (data.estados?.pendiente || 0) > 0;
    if (!hasProcessing) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [data, load]);

  const now = new Date();
  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dateStr = `${dayNames[now.getDay()]}, ${now.getDate()} de ${monthNames[now.getMonth()]} · ${now.getFullYear()}`;

  const user = (() => {
    try { return JSON.parse(sessionStorage.getItem('glifo_user') || '{}'); } catch { return {}; }
  })();

  if (loading) return (
    <div className={styles.panel}>
      <div className={styles.loadingState}>
        <Loader2 size={20} className={styles.spin} />
        <span>Cargando estadísticas…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className={styles.panel}>
      <div className={styles.errorState}>
        <WifiOff size={32} strokeWidth={1.3} />
        <p>No se pudo conectar al backend</p>
        <span>{error}</span>
        <button className={styles.retryBtn} onClick={load}>
          <RefreshCw size={14} /> Reintentar
        </button>
      </div>
    </div>
  );

  const stats = data ? [
    {
      label: 'Total piezas',
      value: data.total_piezas?.toLocaleString() ?? '—',
      delta: `+${data.esta_semana ?? 0} esta semana`,
      up: (data.esta_semana ?? 0) > 0,
      icon: FileText,
      cardAccent: '#4A9EE0',
    },
    {
      label: 'Conexiones en grafo',
      value: data.grafo?.aristas?.toLocaleString() ?? '—',
      delta: `${data.grafo?.nodos ?? 0} nodos activos`,
      up: true,
      icon: Share2,
      cardAccent: '#A07BE8',
    },
    {
      label: 'Costo de API',
      value: data.costo_api ?? '$0.00',
      delta: '100% local con Ollama',
      up: true,
      icon: TrendingUp,
      cardAccent: '#3EC98E',
    },
    {
      label: 'En procesamiento',
      value: ((data.estados?.procesando ?? 0) + (data.estados?.pendiente ?? 0)).toString(),
      delta: data.estados?.error ? `${data.estados.error} con error` : 'Todo en orden',
      up: null,
      icon: Clock,
      cardAccent: '#E8A838',
    },
  ] : [];

  const recientes = data?.piezas_recientes ?? [];
  const cols = colecciones?.colecciones ?? [];
  const nombre = user.nombre?.split(' ')[0] || 'usuario';
  const { greeting, icon: timeIcon } = getTimeOfDay(now.getHours());

  return (
    <div className={styles.panel}>
      <div className={styles.greeting}>
        <div className={styles.greetRow}>
          <div>
            <p className={styles.greetLabel}>{dateStr}</p>
            <h2 className={styles.greetTitle}>
              {greeting}, <span className={styles.greetAccent}>{nombre}</span>
            </h2>
            <p className={styles.greetSub}>
              {((data?.estados?.procesando ?? 0) + (data?.estados?.pendiente ?? 0)) > 0
                ? `${(data?.estados?.procesando ?? 0) + (data?.estados?.pendiente ?? 0)} piezas en procesamiento.`
                : 'Todo procesado.'}{' '}
              El grafo tiene {data?.grafo?.nodos ?? 0} nodos activos.
            </p>
          </div>
        </div>
        <div className={styles.greetTimeIcon} aria-hidden="true">
          {timeIcon}
        </div>
      </div>

      <div className={styles.statsGrid}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className={styles.twoCol}>
        <div className={styles.tableCard}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Piezas recientes</h3>
            <button className={styles.viewAll} onClick={() => onNavigate?.('piezas')}>
              Ver todas <ArrowUpRight size={12} />
            </button>
          </div>
          {recientes.length === 0 ? (
            <div className={styles.emptyTable}>
              <FileText size={24} strokeWidth={1.2} />
              <p>No hay piezas aún. <button onClick={() => onNavigate?.('ingesta')}>Subir archivos</button></p>
            </div>
          ) : (
            <div className={styles.table}>
              <div className={styles.thead}>
                <span>Pieza</span>
                <span>Colección</span>
                <span>Estado</span>
                <span>Fecha</span>
              </div>
              {recientes.map((p) => {
                const TypeIcon = typeIcons[p.tipo] || FileText;
                const sc = statusConfig[p.estado] || statusConfig.pendiente;
                const StatusIcon = sc.icon;
                return (
                  <div key={p.id} className={styles.trow}>
                    <div className={styles.tcell}>
                      <span className={styles.typeChip} style={{ '--chip-color': typeColors[p.tipo] || 'var(--accent-primary)' }}>
                        <TypeIcon size={11} />
                      </span>
                      <span className={styles.pieceTitle}>{p.titulo}</span>
                    </div>
                    <span className={styles.tcellMuted}>{p.coleccion}</span>
                    <span className={styles.statusChip} style={{ '--status-color': sc.color }}>
                      <StatusIcon size={11} />
                      {sc.label}
                    </span>
                    <span className={styles.tcellDate}>{timeAgo(p.creado_en)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.rightCol}>
          <div className={styles.breakdownCard}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>Distribución por acervo</h3>
            </div>
            {cols.length === 0 ? (
              <div className={styles.emptyTable} style={{ padding: '20px 0' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin colecciones aún</p>
              </div>
            ) : (
              <div className={styles.barList}>
                {cols.slice(0, 6).map((c, i) => (
                  <div key={c.nombre} className={styles.barRow}>
                    <div className={styles.barMeta}>
                      <span className={styles.barName}>{c.nombre}</span>
                      <span className={styles.barCount}>{c.total}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${c.porcentaje}%`, '--bar-color': BAR_COLORS[i % BAR_COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.quickCard}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>Acciones rápidas</h3>
            </div>
            <div className={styles.quickGrid}>
              <button className={styles.quickBtn} onClick={() => onNavigate?.('ingesta')}>
                <Upload size={16} />
                <span>Subir pieza</span>
              </button>
              <button className={styles.quickBtn} onClick={() => onNavigate?.('grafo')}>
                <Share2 size={16} />
                <span>Ver grafo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}