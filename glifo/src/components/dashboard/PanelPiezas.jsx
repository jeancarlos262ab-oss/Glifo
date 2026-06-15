import { useState, useEffect, useCallback } from 'react';
import {
  Search, FileText, Image, Mic, Video, Box, Landmark,
  LayoutGrid, List, ChevronRight, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, Clock, Trash2, RotateCcw,
  ChevronLeft, ExternalLink
} from 'lucide-react';
import { piezasApi } from '../../services/api';
import { useNotif } from '../../context/NotifContext';
import styles from './PanelPiezas.module.css';

const TYPE_ICONS = {
  documento: FileText, imagen: Image, audio: Mic,
  video: Video, objeto: Box, patrimonio: Landmark,
};
const TYPE_COLORS = {
  documento: 'var(--accent-primary)',
  imagen:    'var(--accent-dorado)',
  audio:     '#7B5EA7',
  video:     'var(--accent-azul-claro)',
  objeto:    '#B04A4A',
  patrimonio:'#3DAA6A',
};
const ALL_TYPES = ['todos', 'documento', 'imagen', 'audio', 'video', 'objeto'];
const ALL_STATES = ['todos', 'listo', 'procesando', 'pendiente', 'error'];

const statusConfig = {
  listo:       { label: 'Listo',      icon: CheckCircle2, color: '#3DAA6A' },
  procesando:  { label: 'Procesando', icon: Clock,        color: 'var(--accent-dorado)' },
  pendiente:   { label: 'Pendiente',  icon: Clock,        color: '#6B8AB8' },
  error:       { label: 'Error',      icon: AlertCircle,  color: '#B04A4A' },
};

function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Preview de archivo para tarjetas y panel de detalle ──────────
function CardPreview({ tipo, mimetype, url, color, large = false }) {
  const Icon = TYPE_ICONS[tipo] || FileText;
  const cls = large ? styles.detailPreview : styles.cardPreview;
  const iconSize = large ? 40 : 28;

  if (url && mimetype) {
    if (mimetype.startsWith('image/')) {
      return (
        <div className={cls}>
          <img src={url} alt="" className={styles.previewImg} />
        </div>
      );
    }

    if (mimetype.startsWith('video/')) {
      return (
        <div className={cls}>
          <video
            src={url}
            className={styles.previewImg}
            muted
            preload="metadata"
            onMouseEnter={e => e.target.play()}
            onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
          />
          <div className={styles.previewPlayOverlay}>
            <span className={styles.previewPlayIcon}>▶</span>
          </div>
        </div>
      );
    }

    if (mimetype.startsWith('audio/')) {
      return (
        <div className={cls} style={{ background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
          <Mic size={iconSize} strokeWidth={1} style={{ color, opacity: 0.7 }} />
          <audio src={url} controls className={styles.previewAudio} />
        </div>
      );
    }

    if (mimetype === 'application/pdf') {
      return (
        <div className={cls} style={{ background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
          <FileText size={iconSize} strokeWidth={1} style={{ color, opacity: 0.7 }} />
          <span className={styles.previewLabel}>PDF</span>
        </div>
      );
    }
  }

  // Fallback genérico
  return (
    <div className={cls} style={{ background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      <Icon size={iconSize} strokeWidth={1.2} style={{ color, opacity: 0.7 }} />
    </div>
  );
}

export default function PanelPiezas({ onNavigate }) {
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('todos');
  const [stateF, setStateF] = useState('todos');
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [expandTitle, setExpandTitle] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);
  const [expandResumen, setExpandResumen] = useState(false);
  const [paginatedData, setPaginatedData] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const { push } = useNotif();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { pagina, por_pagina: view === 'grid' ? 24 : 20 };
      if (typeF !== 'todos') params.tipo = typeF;
      if (stateF !== 'todos') params.estado = stateF;
      if (q.trim()) params.q = q.trim();
      const data = await piezasApi.listar(params);
      setPaginatedData(data);
    } catch (e) {
      push(`Error cargando piezas: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [pagina, typeF, stateF, q, view]);

  useEffect(() => { load(); }, [pagina, typeF, stateF]);

  useEffect(() => {
    const t = setTimeout(() => { setPagina(1); load(); }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const detail = await piezasApi.obtener(id);
      setSelectedDetail(detail);
    } catch (e) {
      push(`Error: ${e.message}`, 'error');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelect = (id) => {
    if (selected === id) {
      setSelected(null);
      setSelectedDetail(null);
    } else {
      setSelected(id);
      setExpandTitle(false);
      setExpandDesc(false);
      setExpandResumen(false);
      loadDetail(id);
    }
  };

  const handleDelete = async (pieza) => {
    if (!confirm(`¿Eliminar "${pieza.titulo}"? Esta acción no se puede deshacer.`)) return;
    try {
      await piezasApi.eliminar(pieza.id);
      push(`"${pieza.titulo}" eliminada`, 'success');
      setSelected(null);
      setSelectedDetail(null);
      load();
    } catch (e) {
      push(`Error: ${e.message}`, 'error');
    }
  };

  const handleReprocesar = async (pieza) => {
    try {
      await piezasApi.reprocesar(pieza.id);
      push(`"${pieza.titulo}" encolada para re-procesamiento`, 'success');
      setTimeout(load, 1000);
    } catch (e) {
      push(`Error: ${e.message}`, 'error');
    }
  };

  const pieces = paginatedData?.items || [];

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.panel}>
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Buscar piezas, colección…"
                value={q}
                onChange={e => { setQ(e.target.value); }}
              />
            </div>

            <div className={styles.filters}>
              <select className={styles.select} value={typeF} onChange={e => { setTypeF(e.target.value); setPagina(1); }}>
                {ALL_TYPES.map(t => (
                  <option key={t} value={t}>{t === 'todos' ? 'Tipo: todos' : t}</option>
                ))}
              </select>

              <select className={styles.select} value={stateF} onChange={e => { setStateF(e.target.value); setPagina(1); }}>
                {ALL_STATES.map(s => (
                  <option key={s} value={s}>{s === 'todos' ? 'Estado: todos' : s}</option>
                ))}
              </select>
            </div>

            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${view === 'grid' ? styles.viewActive : ''}`}
                onClick={() => setView('grid')} aria-label="Vista cuadrícula"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                className={`${styles.viewBtn} ${view === 'list' ? styles.viewActive : ''}`}
                onClick={() => setView('list')} aria-label="Vista lista"
              >
                <List size={15} />
              </button>
            </div>

            <button className={styles.refreshBtn} onClick={load} title="Actualizar">
              <RefreshCw size={14} />
            </button>
          </div>

          <div className={styles.countRow}>
            {loading
              ? <span className={styles.countLabel}><Loader2 size={12} className={styles.spinInline} /> Cargando…</span>
              : <span className={styles.countLabel}>
                  {paginatedData?.total ?? 0} piezas
                  {paginatedData && paginatedData.paginas > 1 && ` · pág ${pagina}/${paginatedData.paginas}`}
                </span>
            }
          </div>

          {!loading && pieces.length === 0 && (
            <div className={styles.emptyState}>
              <FileText size={32} strokeWidth={1.2} />
              <p>No se encontraron piezas</p>
              {(q || typeF !== 'todos' || stateF !== 'todos') && (
                <button className={styles.clearBtn} onClick={() => { setQ(''); setTypeF('todos'); setStateF('todos'); }}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {view === 'grid' ? (
            <div className={styles.grid}>
              {pieces.map(p => {
                const color = TYPE_COLORS[p.tipo] || 'var(--accent-primary)';
                const sc = statusConfig[p.estado] || statusConfig.pendiente;
                const isSel = selected === p.id;
                return (
                  <button
                    key={p.id}
                    className={`${styles.card} ${isSel ? styles.cardSelected : ''}`}
                    onClick={() => handleSelect(p.id)}
                  >
                    {/* Preview visual del archivo */}
                    <CardPreview
                      tipo={p.tipo}
                      mimetype={p.archivo_mimetype}
                      url={p.archivo_url}
                      color={color}
                    />

                    <div className={styles.cardStatusDot} style={{ background: sc.color }} />
                    <div className={styles.cardBody}>
                      {p.anio && <span className={styles.cardYear}>{p.anio}</span>}
                      <h4 className={styles.cardTitle}>{p.titulo}</h4>
                      <span className={styles.cardColl}>{p.coleccion}</span>
                      <div className={styles.cardTags}>
                        {(p.tags || []).slice(0, 2).map(t => (
                          <span key={t} className={styles.cardTag}>{t}</span>
                        ))}
                      </div>
                      <div className={styles.cardConnections}>
                        {p.num_conexiones} conexiones
                        <ChevronRight size={11} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.listView}>
              <div className={styles.listHead}>
                <span>Pieza</span>
                <span>Colección</span>
                <span>Estado</span>
                <span>Conexiones</span>
                <span>Tags</span>
              </div>
              {pieces.map(p => {
                const Icon = TYPE_ICONS[p.tipo] || FileText;
                const color = TYPE_COLORS[p.tipo] || 'var(--accent-primary)';
                const sc = statusConfig[p.estado] || statusConfig.pendiente;
                const StatusIcon = sc.icon;
                const isSel = selected === p.id;
                return (
                  <button
                    key={p.id}
                    className={`${styles.listRow} ${isSel ? styles.listSelected : ''}`}
                    onClick={() => handleSelect(p.id)}
                  >
                    <div className={styles.listCell}>
                      {/* En lista: thumbnail pequeño o ícono */}
                      {p.archivo_url && p.archivo_mimetype?.startsWith('image/') ? (
                        <img src={p.archivo_url} alt="" className={styles.listThumb} />
                      ) : (
                        <span className={styles.listChip} style={{ '--chip-color': color }}>
                          <Icon size={12} />
                        </span>
                      )}
                      <span className={styles.listTitle}>{p.titulo}</span>
                    </div>
                    <span className={styles.listMuted}>{p.coleccion}</span>
                    <span className={styles.statusChip} style={{ '--sc': sc.color }}>
                      <StatusIcon size={11} /> {sc.label}
                    </span>
                    <span className={styles.listMono}>{p.num_conexiones}</span>
                    <div className={styles.listTags}>
                      {(p.tags || []).slice(0, 2).map(t => (
                        <span key={t} className={styles.cardTag}>{t}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {paginatedData && paginatedData.paginas > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={pagina <= 1}
                onClick={() => setPagina(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, paginatedData.paginas) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`${styles.pageBtn} ${pagina === p ? styles.pageBtnActive : ''}`}
                    onClick={() => setPagina(p)}
                  >
                    {p}
                  </button>
                );
              })}
              {paginatedData.paginas > 5 && <span className={styles.pageEllipsis}>…</span>}
              <button
                className={styles.pageBtn}
                disabled={pagina >= paginatedData.paginas}
                onClick={() => setPagina(p => Math.min(paginatedData.paginas, p + 1))}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail side panel */}
      {selected && (
        <div className={styles.detail}>
          {detailLoading ? (
            <div className={styles.detailLoading}>
              <Loader2 size={20} className={styles.spin} />
            </div>
          ) : selectedDetail ? (
            <>
              {/* Preview grande en el detalle */}
              <div className={styles.detailPreviewWrap}>
                <CardPreview
                  tipo={selectedDetail.tipo}
                  mimetype={selectedDetail.archivo_mimetype}
                  url={selectedDetail.archivo_url}
                  color={TYPE_COLORS[selectedDetail.tipo] || 'var(--accent-primary)'}
                  large
                />
                <button
                  className={styles.detailClose}
                  onClick={() => { setSelected(null); setSelectedDetail(null); }}
                >×</button>
              </div>

              <div className={styles.detailBody}>
                <p className={styles.detailType}>{selectedDetail.tipo} {selectedDetail.anio && `· ${selectedDetail.anio}`}</p>
                <h3
                  className={styles.detailTitle}
                  style={expandTitle ? { WebkitLineClamp: 'unset', overflow: 'visible' } : {}}
                >
                  {selectedDetail.titulo}
                </h3>
                {selectedDetail.titulo?.length > 60 && (
                  <button className={styles.expandBtn} onClick={() => setExpandTitle(v => !v)}>
                    {expandTitle ? 'Ver menos' : 'Ver más…'}
                  </button>
                )}
                <p className={styles.detailColl}>{selectedDetail.coleccion}</p>

                {selectedDetail.descripcion && (
                  <>
                    <p
                      className={styles.detailDesc}
                      style={expandDesc ? { WebkitLineClamp: 'unset', overflow: 'visible' } : {}}
                    >
                      {selectedDetail.descripcion}
                    </p>
                    {selectedDetail.descripcion.length > 180 && (
                      <button className={styles.expandBtn} onClick={() => setExpandDesc(v => !v)}>
                        {expandDesc ? 'Ver menos' : 'Ver más…'}
                      </button>
                    )}
                  </>
                )}

                {selectedDetail.resumen && (
                  <div className={styles.detailSection}>
                    <p className={styles.detailSectionTitle}>Resumen IA</p>
                    <p
                      className={`${styles.detailSectionText} ${!expandResumen ? styles.detailSectionTextClamped : ''}`}
                    >
                      {selectedDetail.resumen}
                    </p>
                    {selectedDetail.resumen.length > 220 && (
                      <button className={styles.expandBtn} onClick={() => setExpandResumen(v => !v)}>
                        {expandResumen ? 'Ver menos' : 'Ver más…'}
                      </button>
                    )}
                  </div>
                )}

                <div className={styles.detailMeta}>
                  <div className={styles.detailMetaRow}>
                    <span className={styles.detailMetaKey}>Estado</span>
                    <span className={styles.detailMetaVal} style={{ color: statusConfig[selectedDetail.estado]?.color }}>
                      {statusConfig[selectedDetail.estado]?.label || selectedDetail.estado}
                      {(selectedDetail.estado === 'procesando' || selectedDetail.estado === 'pendiente') && ` (${selectedDetail.progreso}%)`}
                    </span>
                  </div>
                  <div className={styles.detailMetaRow}>
                    <span className={styles.detailMetaKey}>Conexiones</span>
                    <span className={styles.detailMetaVal}>{selectedDetail.num_conexiones}</span>
                  </div>
                  {selectedDetail.archivo_tamano && (
                    <div className={styles.detailMetaRow}>
                      <span className={styles.detailMetaKey}>Tamaño</span>
                      <span className={styles.detailMetaVal}>{formatBytes(selectedDetail.archivo_tamano)}</span>
                    </div>
                  )}
                  {selectedDetail.idioma && (
                    <div className={styles.detailMetaRow}>
                      <span className={styles.detailMetaKey}>Idioma</span>
                      <span className={styles.detailMetaVal}>{selectedDetail.idioma}</span>
                    </div>
                  )}
                  <div className={styles.detailMetaRow}>
                    <span className={styles.detailMetaKey}>Creado</span>
                    <span className={styles.detailMetaVal}>{timeAgo(selectedDetail.creado_en)}</span>
                  </div>
                  <div className={styles.detailMetaRow}>
                    <span className={styles.detailMetaKey}>ID</span>
                    <span className={styles.detailMetaMono}>{selectedDetail.id.slice(0, 8)}…</span>
                  </div>
                </div>

                {selectedDetail.entidades && Object.keys(selectedDetail.entidades).length > 0 && (
                  <div className={styles.detailSection}>
                    <p className={styles.detailSectionTitle}>Entidades extraídas</p>
                    {Object.entries(selectedDetail.entidades).map(([key, vals]) =>
                      vals && vals.length > 0 ? (
                        <div key={key} className={styles.entidadRow}>
                          <span className={styles.entidadKey}>{key}</span>
                          <div className={styles.entidadVals}>
                            {vals.slice(0, 4).map(v => (
                              <span key={v} className={styles.entidadTag}>{v}</span>
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                )}

                {(selectedDetail.tags || []).length > 0 && (
                  <div className={styles.detailTags}>
                    {selectedDetail.tags.map(t => (
                      <span key={t} className={styles.cardTag}>{t}</span>
                    ))}
                  </div>
                )}

                {selectedDetail.error_msg && (
                  <div className={styles.errorBox}>
                    <AlertCircle size={14} />
                    <span>{selectedDetail.error_msg}</span>
                  </div>
                )}

                <div className={styles.detailActions}>
                  <button className={styles.detailBtn} onClick={() => onNavigate?.('grafo')}>
                    <ExternalLink size={13} />
                    Ver en grafo
                  </button>
                  {selectedDetail.estado === 'error' && (
                    <button className={styles.detailBtnSec} onClick={() => handleReprocesar(selectedDetail)}>
                      <RotateCcw size={13} />
                      Re-procesar
                    </button>
                  )}
                  <button
                    className={styles.detailBtnDanger}
                    onClick={() => handleDelete(selectedDetail)}
                    title="Eliminar pieza"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}