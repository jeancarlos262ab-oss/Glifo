import { useState, useCallback } from 'react';
import {
  Search, X, FileText, Image, Mic, Video, Box, Landmark, Building2,
  Loader2, Upload, AlertCircle
} from 'lucide-react';
import { buscarApi } from '../../services/api';
import { useNotif } from '../../context/NotifContext';
import styles from './PanelBuscador.module.css';

const TYPE_ICONS = {
  documento:   FileText,
  imagen:      Image,
  audio:       Mic,
  video:       Video,
  objeto:      Box,
  patrimonio:  Landmark,
  institución: Building2,
};

const TYPE_COLORS = {
  documento:   'var(--accent-primary)',
  imagen:      'var(--accent-dorado)',
  audio:       '#7B5EA7',
  video:       'var(--accent-azul-claro)',
  objeto:      '#B04A4A',
  patrimonio:  '#3DAA6A',
  institución: 'var(--accent-primary)',
};

const ALL_TYPES = ['todos', 'documento', 'imagen', 'audio', 'video', 'objeto'];

const DEFAULT_SUGGESTIONS = [
  '¿Qué piezas hablan del movimiento estudiantil?',
  'Murales sobre identidad indígena',
  'Testimonios orales en náhuatl',
  'Fotografías del patrimonio colonial de Puebla',
  'Documentos sobre la BUAP en los años 70',
  'Objetos prehispánicos mesoamericanos',
];

export default function PanelBuscador() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageMode, setImageMode] = useState(false);
  const { push } = useNotif();

  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSubmitted(q);
    setQuery(q);
    setSelectedPiece(null);

    try {
      const res = await buscarApi.texto(q, 15, typeFilter !== 'todos' ? typeFilter : null);
      setResults(res);
    } catch (e) {
      setError(e.message);
      push(`Error en búsqueda: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, push]);

  const handleImageSearch = useCallback(async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSubmitted('[búsqueda por imagen]');
    setSelectedPiece(null);

    try {
      const res = await buscarApi.imagen(file, 10);
      setResults(res);
      setImageMode(true);
    } catch (e) {
      setError(e.message);
      push(`Error en búsqueda por imagen: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  const handleTypeFilter = async (type) => {
    setTypeFilter(type);
    if (submitted && submitted !== '[búsqueda por imagen]') {
      setLoading(true);
      try {
        const res = await buscarApi.texto(submitted, 15, type !== 'todos' ? type : null);
        setResults(res);
      } catch (e) {
        push(`Error: ${e.message}`, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredResults = results?.resultados ?? [];
  const totalResults = results?.total ?? 0;

  return (
    <>
      <div className={styles.cityBg} aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.cityBgIcon}>
          <circle cx="42" cy="42" r="28" strokeWidth="6" stroke="currentColor"/>
          <line x1="63" y1="63" x2="88" y2="88" strokeWidth="7" strokeLinecap="round" stroke="currentColor"/>
        </svg>
      </div>
      <div className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.headerLabel}>Buscador Semántico</p>
        <h2 className={styles.headerTitle}>
          Pregunta en <span className={styles.accent}>lenguaje natural</span>
        </h2>
        <p className={styles.headerSub}>
          Busca por tema, época, lugar, persona o tipo de pieza. El sistema entiende significado, no solo palabras clave.
        </p>
      </div>

      {/* Search bar */}
      <div className={styles.searchArea}>
        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={query}
            onChange={e => { setQuery(e.target.value); setImageMode(false); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
            placeholder="¿Qué piezas hablan del movimiento estudiantil?"
          />
          {(query || imageFile) && (
            <button
              className={styles.clearBtn}
              onClick={() => { setQuery(''); setSubmitted(''); setResults(null); setImageFile(null); setImageMode(false); }}
            >
              <X size={14} />
            </button>
          )}
          <button className={styles.searchBtn} onClick={() => handleSearch(query)} disabled={loading || !query.trim()}>
            {loading ? <Loader2 size={14} className={styles.spin} /> : 'Buscar'}
          </button>
        </div>

        {/* Image search button */}
        <div className={styles.searchExtras}>
          <label className={styles.imageSearchBtn} title="Buscar por imagen (usa llava)">
            <Upload size={14} />
            <span>Buscar por imagen</span>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setImageFile(f); setQuery(''); handleImageSearch(f); }
              }}
            />
          </label>
          {imageFile && (
            <span className={styles.imageFileName}>{imageFile.name}</span>
          )}
        </div>

        {/* Suggestions */}
        {!submitted && (
          <div className={styles.suggestions}>
            {DEFAULT_SUGGESTIONS.map(s => (
              <button
                key={s}
                className={styles.suggestionChip}
                onClick={() => handleSearch(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && !loading && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} />
          <span>
            Error conectando al backend semántico: {error}.
            Asegúrate de que el backend y Ollama estén corriendo.
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loadingState}>
          <Loader2 size={20} className={styles.spin} />
          <span>{imageMode ? 'Analizando imagen con llava…' : 'Buscando con embeddings semánticos…'}</span>
        </div>
      )}

      {/* Type filter */}
      {submitted && !loading && (
        <div className={styles.filterRow}>
          {ALL_TYPES.map(t => (
            <button
              key={t}
              className={`${styles.filterBtn} ${typeFilter === t ? styles.filterActive : ''}`}
              onClick={() => handleTypeFilter(t)}
            >
              {t === 'todos' ? 'Todos' : t}
            </button>
          ))}
          <span className={styles.resultCount}>
            {totalResults} resultado{totalResults !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Results */}
      {submitted && !loading && (
        <div className={styles.results}>
          {filteredResults.length === 0 && (
            <div className={styles.empty}>
              <Search size={28} strokeWidth={1.3} />
              <p>Sin resultados para «<em>{submitted}</em>»</p>
              <span>Intenta con otros términos o verifica que Ollama esté activo.</span>
            </div>
          )}
          {filteredResults.map(p => {
            const Icon = TYPE_ICONS[p.tipo] || FileText;
            const color = TYPE_COLORS[p.tipo] || 'var(--accent-primary)';
            const isSel = selectedPiece?.id === p.id;
            const pct = Math.round((p.score ?? 0) * 100);
            return (
              <div
                key={p.id}
                className={`${styles.resultCard} ${isSel ? styles.resultSelected : ''}`}
                onClick={() => setSelectedPiece(isSel ? null : p)}
              >
                <div className={styles.resultLeft}>
                  <span className={styles.resultChip} style={{ '--chip-color': color }}>
                    <Icon size={14} />
                  </span>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultTopRow}>
                      <h4 className={styles.resultTitle}>{p.titulo}</h4>
                      <span className={styles.resultScore} style={{
                        color: pct >= 80 ? '#3DAA6A' : pct >= 50 ? 'var(--accent-dorado)' : 'var(--text-muted)'
                      }}>
                        {pct}% relevante
                      </span>
                    </div>
                    {p.descripcion && (
                      <p className={styles.resultDesc}>{p.descripcion}</p>
                    )}
                    <div className={styles.resultMeta}>
                      <span className={styles.resultColl}>{p.coleccion}</span>
                      {p.anio && <><span className={styles.metaDot} /><span className={styles.resultYear}>{p.anio}</span></>}
                      <span className={styles.metaDot} />
                      <span className={styles.resultConn}>{p.num_conexiones} conexiones</span>
                    </div>
                    {(p.tags || []).length > 0 && (
                      <div className={styles.resultTags}>
                        {p.tags.slice(0, 4).map(t => (
                          <span key={t} className={styles.resultTag}>{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Expanded detail */}
                    {isSel && p.entidades && Object.keys(p.entidades).length > 0 && (
                      <div className={styles.entityExpand}>
                        {Object.entries(p.entidades).map(([k, vs]) =>
                          vs && vs.length > 0 ? (
                            <div key={k} className={styles.entityRow}>
                              <span className={styles.entityKey}>{k}:</span>
                              <span className={styles.entityVals}>{vs.join(', ')}</span>
                            </div>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}