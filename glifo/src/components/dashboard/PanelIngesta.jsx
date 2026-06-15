import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, FileText, Image, Mic, Video, CheckCircle2,
  Clock, AlertCircle, X, Plus, Loader2, RefreshCw
} from 'lucide-react';
import { piezasApi, jobsApi } from '../../services/api';
import { useNotif } from '../../context/NotifContext';
import styles from './PanelIngesta.module.css';

const statusConfig = {
  procesando: { label: 'Procesando',  color: 'var(--accent-dorado)',   icon: Clock },
  pendiente:  { label: 'En cola',     color: 'var(--text-muted)',       icon: Clock },
  listo:      { label: 'Listo',       color: '#3DAA6A',                 icon: CheckCircle2 },
  error:      { label: 'Error',       color: '#B04A4A',                 icon: AlertCircle },
  ejecutando: { label: 'Procesando',  color: 'var(--accent-dorado)',    icon: Clock },
  cancelado:  { label: 'Cancelado',   color: 'var(--text-muted)',       icon: X },
};

const typeColors = {
  documento: 'var(--accent-primary)',
  imagen:    'var(--accent-dorado)',
  audio:     '#7B5EA7',
  video:     'var(--accent-azul-claro)',
  objeto:    '#B04A4A',
  patrimonio:'#3DAA6A',
};

const typeIcons = { documento: FileText, imagen: Image, audio: Mic, video: Video };

const formats = [
  { label: 'PDF / Documentos',    icon: FileText, desc: 'PDF, DOC, TXT, Markdown' },
  { label: 'Imágenes',            icon: Image,    desc: 'JPG, PNG, TIFF, WebP' },
  { label: 'Audio',               icon: Mic,      desc: 'MP3, WAV, OGG, M4A' },
  { label: 'Video',               icon: Video,    desc: 'MP4, MOV, AVI, MKV' },
];

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

export default function PanelIngesta() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [coleccion, setColeccion] = useState('Sin colección');
  const [colecciones, setColecciones] = useState(['Sin colección', 'ARPA BUAP', 'Archivo del 68', 'Murales ARPA', 'Lenguas Indígenas', 'INAH Monumentos']);
  const [uploadFiles, setUploadFiles] = useState([]);
  const fileRef = useRef(null);
  const { push } = useNotif();

  const loadQueue = useCallback(async () => {
    try {
      const [piezas, cola] = await Promise.all([
        piezasApi.listar({ estado: 'procesando', por_pagina: 10 }),
        piezasApi.listar({ estado: 'pendiente', por_pagina: 10 }),
      ]);
      // Merge and deduplicate
      const combined = [...(piezas.items || []), ...(cola.items || [])];
      const seen = new Set();
      const unique = combined.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

      // Also get recent ones with error/listo to show history
      const recientes = await piezasApi.listar({ por_pagina: 15 });
      const history = (recientes.items || []).filter(p =>
        p.estado === 'listo' || p.estado === 'error'
      );

      setQueue([...unique, ...history.slice(0, 5)]);
    } catch (e) {
      console.warn('Error cargando cola:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // Auto-refresh si hay items procesando
  useEffect(() => {
    const hasActive = queue.some(p => p.estado === 'procesando' || p.estado === 'pendiente');
    if (!hasActive) return;
    const t = setInterval(loadQueue, 5000);
    return () => clearInterval(t);
  }, [queue, loadQueue]);

  const handleFiles = useCallback(async (files) => {
    const arr = Array.from(files);
    if (!arr.length) return;

    setUploading(true);
    let ok = 0, fail = 0;

    for (const file of arr) {
      try {
        const pieza = await piezasApi.subir(file, '', coleccion);
        ok++;
        push(`"${pieza.titulo}" encolado para procesamiento`, 'success');
      } catch (e) {
        fail++;
        push(`Error subiendo "${file.name}": ${e.message}`, 'error');
      }
    }

    setUploading(false);
    setUploadFiles([]);
    if (ok > 0) {
      setTimeout(loadQueue, 1000);
    }
  }, [coleccion, push, loadQueue]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleCancel = async (pieza) => {
    try {
      // First get jobs for this piece
      const jobs = await jobsApi.listar({ pieza_id: pieza.id });
      const pending = jobs.find(j => j.estado === 'pendiente');
      if (pending) {
        await jobsApi.cancelar(pending.id);
        push(`Job cancelado`, 'info');
      } else {
        push('No hay jobs cancelables para esta pieza', 'info');
      }
      loadQueue();
    } catch (e) {
      push(`Error: ${e.message}`, 'error');
    }
  };

  const handleReprocesar = async (pieza) => {
    try {
      await piezasApi.reprocesar(pieza.id);
      push(`"${pieza.titulo}" encolado para re-procesamiento`, 'success');
      setTimeout(loadQueue, 1000);
    } catch (e) {
      push(`Error: ${e.message}`, 'error');
    }
  };

  const activeCount = queue.filter(p => p.estado === 'procesando' || p.estado === 'pendiente').length;

  return (
    <div className={styles.panel}>
      {/* Upload zone */}
      <div className={styles.uploadCard}>
        <div
          className={`${styles.dropZone} ${dragOver ? styles.dropActive : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className={styles.dropIcon}>
            {uploading
              ? <Loader2 size={28} strokeWidth={1.5} className={styles.spin} />
              : <Upload size={28} strokeWidth={1.5} />
            }
          </div>
          <h3 className={styles.dropTitle}>
            {dragOver ? '¡Suelta para subir!' : uploading ? 'Subiendo archivos…' : 'Arrastra tus archivos aquí'}
          </h3>
          <p className={styles.dropSub}>
            PDF, imágenes, audio en lenguas indígenas, video · Máx 2 GB por archivo
          </p>

          <div className={styles.uploadControls}>
            <div className={styles.coleccionField}>
              <label className={styles.coleccionLabel}>Colección destino</label>
              <input
                list="colecciones-list"
                className={styles.coleccionInput}
                value={coleccion}
                onChange={e => setColeccion(e.target.value)}
                placeholder="Nombre de colección"
              />
              <datalist id="colecciones-list">
                {colecciones.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <button
              className={styles.browseBtn}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Plus size={15} />
              Seleccionar archivos
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.tiff,.webp,.mp3,.wav,.ogg,.m4a,.mp4,.mov,.avi,.mkv"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        <div className={styles.formats}>
          {formats.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className={styles.formatChip}>
                <Icon size={14} strokeWidth={1.5} />
                <div>
                  <span className={styles.formatLabel}>{f.label}</span>
                  <span className={styles.formatDesc}>{f.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue */}
      <div className={styles.queueCard}>
        <div className={styles.cardHead}>
          <div>
            <h3 className={styles.cardTitle}>Cola de procesamiento</h3>
            <p className={styles.cardSub}>La IA corre completamente local. Sin costos de API.</p>
          </div>
          <div className={styles.cardHeadRight}>
            {activeCount > 0 && (
              <span className={styles.queueCount}>{activeCount} activos</span>
            )}
            <button className={styles.refreshBtn} onClick={loadQueue} title="Actualizar">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 size={18} className={styles.spin} />
            <span>Cargando cola…</span>
          </div>
        ) : queue.length === 0 ? (
          <div className={styles.emptyState}>
            <Upload size={28} strokeWidth={1.2} />
            <p>No hay piezas en la cola.</p>
            <span>Sube tu primer archivo para empezar.</span>
          </div>
        ) : (
          <div className={styles.queue}>
            {queue.map((item) => {
              const TypeIcon = typeIcons[item.tipo] || FileText;
              const sc = statusConfig[item.estado] || statusConfig.pendiente;
              const StatusIcon = sc.icon;

              return (
                <div key={item.id} className={styles.queueItem}>
                  <div className={styles.queueLeft}>
                    <span className={styles.queueTypeChip} style={{ '--chip-color': typeColors[item.tipo] || 'var(--accent-primary)' }}>
                      <TypeIcon size={14} />
                    </span>
                    <div className={styles.queueInfo}>
                      <span className={styles.queueName}>{item.titulo}</span>
                      <div className={styles.queueMeta}>
                        <span className={styles.queueColl}>{item.coleccion}</span>
                        {item.archivo_tamano && (
                          <><span className={styles.queueDot} /><span className={styles.queueSize}>{formatBytes(item.archivo_tamano)}</span></>
                        )}
                        <span className={styles.queueDot} />
                        <span className={styles.queueSize}>{timeAgo(item.creado_en)}</span>
                      </div>
                      {item.error_msg && (
                        <span className={styles.queueError}>{item.error_msg}</span>
                      )}
                      {item.paso_actual && (item.estado === 'procesando' || item.estado === 'pendiente') && (
                        <span className={styles.queueStep}>{item.paso_actual}</span>
                      )}
                      {(item.estado === 'procesando' || item.estado === 'pendiente') && (
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${item.progreso || 0}%` }} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.queueRight}>
                    <span className={styles.statusBadge} style={{ '--sc': sc.color }}>
                      <StatusIcon size={11} />
                      {sc.label}
                      {(item.estado === 'procesando' || item.estado === 'pendiente') && item.progreso > 0 && ` ${item.progreso}%`}
                    </span>
                    {item.estado === 'error' && (
                      <button className={styles.actionBtn} onClick={() => handleReprocesar(item)} title="Re-procesar">
                        <RefreshCw size={12} />
                      </button>
                    )}
                    {(item.estado === 'pendiente') && (
                      <button className={styles.removeBtn} onClick={() => handleCancel(item)} aria-label="Cancelar">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
