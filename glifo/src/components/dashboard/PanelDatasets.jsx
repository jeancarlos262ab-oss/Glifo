import { useState, useEffect, useCallback } from 'react';
import {
  Database, RefreshCw, Loader2, FileText, Image, Mic, Video,
  Box, ChevronRight, BarChart3, WifiOff
} from 'lucide-react';
import { statsApi, piezasApi } from '../../services/api';
import { useNotif } from '../../context/NotifContext';
import styles from './PanelDatasets.module.css';

const BAR_COLORS = ['#4A9EE0', '#E8A838', '#3EC98E', '#A07BE8', '#E85C78', '#38C4B8', '#F08030', '#60C8A8'];

const typeIcons = { documento: FileText, imagen: Image, audio: Mic, video: Video, objeto: Box };
const typeColors = {
  documento: 'var(--accent-primary)',
  imagen:    'var(--accent-dorado)',
  audio:     '#7B5EA7',
  video:     'var(--accent-azul-claro)',
  objeto:    '#B04A4A',
};

export default function PanelDatasets({ onNavigate }) {
  const [colecciones, setColecciones] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCol, setSelectedCol] = useState(null);
  const [colPiezas, setColPiezas] = useState(null);
  const [loadingPiezas, setLoadingPiezas] = useState(false);
  const { push } = useNotif();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [col, ov] = await Promise.all([statsApi.colecciones(), statsApi.overview()]);
      setColecciones(col);
      setOverview(ov);
    } catch (e) {
      setError(e.message);
      push(`Error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectColeccion = async (nombre) => {
    if (selectedCol === nombre) { setSelectedCol(null); setColPiezas(null); return; }
    setSelectedCol(nombre);
    setLoadingPiezas(true);
    try {
      const data = await piezasApi.listar({ coleccion: nombre, por_pagina: 8 });
      setColPiezas(data);
    } catch (e) {
      push(`Error: ${e.message}`, 'error');
    } finally {
      setLoadingPiezas(false);
    }
  };

  if (loading) return (
    <div className={styles.panel}>
      <div className={styles.loadState}>
        <Loader2 size={20} className={styles.spin} />
        <span>Cargando datasets…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className={styles.panel}>
      <div className={styles.errorState}>
        <WifiOff size={32} strokeWidth={1.3} />
        <p>No se pudo conectar al backend</p>
        <button className={styles.retryBtn} onClick={load}><RefreshCw size={14} /> Reintentar</button>
      </div>
    </div>
  );

  const cols = colecciones?.colecciones ?? [];
  const tipos = overview?.tipos ?? {};
  const total = colecciones?.total_global ?? 0;

  return (
    <div className={styles.panel}>
      <div className={styles.topBar}>
        <div>
          <p className={styles.headerLabel}>Gestión de datos</p>
          <h2 className={styles.headerTitle}>Datasets y Colecciones</h2>
          <p className={styles.headerSub}>
            {cols.length} colecciones · {total.toLocaleString()} piezas totales
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={load}><RefreshCw size={14} /></button>
      </div>

      {/* Summary stats */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard} style={{ '--summary-accent': '#4A9EE0', '--summary-icon-color': '#4A9EE0' }}>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryVal}>{total.toLocaleString()}</span>
            <span className={styles.summaryLabel}>piezas totales</span>
          </div>
          <div className={styles.summaryIcon}><BarChart3 size={56} strokeWidth={1} /></div>
        </div>
        <div className={styles.summaryCard} style={{ '--summary-accent': '#A07BE8', '--summary-icon-color': '#A07BE8' }}>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryVal}>{cols.length}</span>
            <span className={styles.summaryLabel}>colecciones</span>
          </div>
          <div className={styles.summaryIcon}><Database size={56} strokeWidth={1} /></div>
        </div>
        {Object.entries(tipos).slice(0, 4).map(([tipo, cnt]) => {
          const Icon = typeIcons[tipo] || Box;
          const iconColor = typeColors[tipo] || 'var(--text-muted)';
          return (
            <div key={tipo} className={styles.summaryCard} style={{ '--summary-accent': iconColor, '--summary-icon-color': iconColor }}>
              <div className={styles.summaryInfo}>
                <span className={styles.summaryVal}>{cnt}</span>
                <span className={styles.summaryLabel}>{tipo}s</span>
              </div>
              <div className={styles.summaryIcon}><Icon size={56} strokeWidth={1} /></div>
            </div>
          );
        })}
      </div>

      <div className={styles.body}>
        {/* Collections list */}
        <div className={styles.colList}>
          <div className={styles.colListHead}>
            <h3 className={styles.sectionTitle}>Colecciones</h3>
          </div>
          {cols.length === 0 ? (
            <div className={styles.emptyState}>
              <Database size={28} strokeWidth={1.2} />
              <p>No hay colecciones aún.</p>
              <button onClick={() => onNavigate?.('ingesta')}>Subir archivos</button>
            </div>
          ) : (
            cols.map((col, i) => (
              <button
                key={col.nombre}
                className={`${styles.colItem} ${selectedCol === col.nombre ? styles.colItemActive : ''}`}
                onClick={() => selectColeccion(col.nombre)}
              >
                <div className={styles.colLeft}>
                  <div
                    className={styles.colDot}
                    style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                  />
                  <div className={styles.colInfo}>
                    <span className={styles.colName}>{col.nombre}</span>
                    <div className={styles.colBar}>
                      <div
                        className={styles.colBarFill}
                        style={{ width: `${col.porcentaje}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.colRight}>
                  <span className={styles.colCount}>{col.total}</span>
                  <span className={styles.colPct}>{col.porcentaje}%</span>
                  <ChevronRight size={13} className={styles.colChevron} />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className={styles.detail}>
          {!selectedCol ? (
            <div className={styles.detailEmpty}>
              <Database size={32} strokeWidth={1.2} />
              <p>Selecciona una colección para ver sus piezas</p>
            </div>
          ) : (
            <>
              <div className={styles.detailHead}>
                <h3 className={styles.detailTitle}>{selectedCol}</h3>
                <button className={styles.viewAllBtn} onClick={() => onNavigate?.('piezas')}>
                  Ver todas <ChevronRight size={12} />
                </button>
              </div>
              {loadingPiezas ? (
                <div className={styles.detailLoading}>
                  <Loader2 size={18} className={styles.spin} />
                </div>
              ) : colPiezas?.items?.length === 0 ? (
                <div className={styles.detailEmpty}>
                  <p>Sin piezas en esta colección</p>
                </div>
              ) : (
                <div className={styles.pieceList}>
                  {(colPiezas?.items || []).map(p => {
                    const Icon = typeIcons[p.tipo] || FileText;
                    return (
                      <div key={p.id} className={styles.pieceRow}>
                        <span className={styles.pieceIcon} style={{ color: typeColors[p.tipo] }}>
                          <Icon size={13} />
                        </span>
                        <span className={styles.pieceTitle}>{p.titulo}</span>
                        <span className={styles.pieceType}>{p.tipo}</span>
                      </div>
                    );
                  })}
                  {colPiezas && colPiezas.total > 8 && (
                    <div className={styles.morePieces}>
                      +{colPiezas.total - 8} piezas más
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
