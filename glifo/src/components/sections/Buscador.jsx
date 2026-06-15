import { useState, useRef } from 'react';
import { Search, X, FileText, Image, Mic, Video, Box, Landmark, Building2 } from 'lucide-react';
import SectionHeader from '../ui/SectionHeader';
import { pieces, suggestions } from '../../data/searchData';
import styles from './Buscador.module.css';

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
  audio:       'var(--accent-primary)',
  video:       'var(--accent-azul-claro)',
  objeto:      '#7B5EA7',
  patrimonio:  '#B04A4A',
  institución: 'var(--accent-primary)',
};

const ALL_TYPES = ['todos', 'documento', 'imagen', 'audio', 'video', 'objeto'];
const ALL_COLLECTIONS = ['todas', 'Archivo del 68', 'ARPA BUAP', 'Murales ARPA', 'Museum der Kulturen Basel', 'Museum Rietberg', 'Datos Puebla'];

function scoreSearch(piece, query) {
  if (!query.trim()) return 1;
  const q = query.toLowerCase();
  const fields = [
    piece.title, piece.description, piece.collection,
    ...piece.tags,
    ...Object.values(piece.entities).flat(),
  ].join(' ').toLowerCase();
  if (fields.includes(q)) return piece.score;
  const words = q.split(' ').filter(Boolean);
  const hits = words.filter(w => fields.includes(w)).length;
  return hits > 0 ? (hits / words.length) * piece.score : 0;
}

export default function Buscador() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [collectionFilter, setCollectionFilter] = useState('todas');
  const [selectedPiece, setSelectedPiece] = useState(null);
  const inputRef = useRef(null);

  const handleSearch = (q) => {
    setSubmitted(q);
    setQuery(q);
    setSelectedPiece(null);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  const results = submitted
    ? pieces
        .map(p => ({ ...p, matchScore: scoreSearch(p, submitted) }))
        .filter(p => p.matchScore > 0)
        .filter(p => typeFilter === 'todos' || p.type === typeFilter)
        .filter(p => collectionFilter === 'todas' || p.collection === collectionFilter)
        .sort((a, b) => b.matchScore - a.matchScore)
    : [];

  return (
    <section className="section section-c" id="buscador">
      <div className="container">
        <SectionHeader
          label="Búsqueda Semántica"
          title="Pregunta en lenguaje natural"
          subtitle="El sistema entiende el significado, no solo palabras clave. Busca por tema, época, lugar, persona o tipo de pieza."
        />

        <div className={styles.wrapper}>
          {/* Search bar */}
          <div className={styles.searchBar}>
            <Search size={16} className={styles.searchIcon} />
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="¿Qué piezas hablan del movimiento estudiantil?"
            />
            {query && (
              <button className={styles.clearBtn} onClick={() => { setQuery(''); setSubmitted(''); }}>
                <X size={14} />
              </button>
            )}
            <button className={styles.searchBtn} onClick={() => handleSearch(query)}>
              Buscar
            </button>
          </div>

          {/* Suggestions */}
          {!submitted && (
            <div className={styles.suggestions}>
              <span className={styles.suggestionsLabel}>Prueba con:</span>
              <div className={styles.suggestionChips}>
                {suggestions.map(s => (
                  <button key={s} className={styles.chip} onClick={() => handleSearch(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          {submitted && (
            <div className={styles.filters}>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Tipo</span>
                {ALL_TYPES.map(t => (
                  <button
                    key={t}
                    className={`${styles.filterBtn} ${typeFilter === t ? styles.filterBtnActive : ''}`}
                    onClick={() => setTypeFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Colección</span>
                <select
                  className={styles.filterSelect}
                  value={collectionFilter}
                  onChange={e => setCollectionFilter(e.target.value)}
                >
                  {ALL_COLLECTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <span className={styles.resultCount}>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Results */}
          {submitted && (
            <div className={styles.resultsArea}>
              <div className={styles.resultsList}>
                {results.length === 0 && (
                  <div className={styles.empty}>
                    <p>Sin resultados para <strong>"{submitted}"</strong></p>
                    <span>Intenta con términos más generales</span>
                  </div>
                )}
                {results.map(piece => (
                  <ResultRow
                    key={piece.id}
                    piece={piece}
                    active={selectedPiece?.id === piece.id}
                    onClick={() => setSelectedPiece(selectedPiece?.id === piece.id ? null : piece)}
                    query={submitted}
                  />
                ))}
              </div>

              {selectedPiece && <PieceDetail piece={selectedPiece} onClose={() => setSelectedPiece(null)} />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ResultRow({ piece, active, onClick, query }) {
  const Icon = TYPE_ICONS[piece.type] || FileText;
  const color = TYPE_COLORS[piece.type] || 'var(--accent-primary)';
  const pct = Math.round(piece.matchScore * 100);

  return (
    <div className={`${styles.resultRow} ${active ? styles.resultRowActive : ''}`} onClick={onClick}>
      <div className={styles.resultIcon} style={{ color, background: color + '18' }}>
        <Icon size={14} strokeWidth={1.5} />
      </div>
      <div className={styles.resultMain}>
        <div className={styles.resultTop}>
          <span className={styles.resultTitle}>{piece.title}</span>
          <span className={styles.resultYear}>{piece.year}</span>
        </div>
        <span className={styles.resultCollection}>{piece.collection}</span>
        <p className={styles.resultDesc}>{piece.description.slice(0, 110)}…</p>
      </div>
      <div className={styles.resultMeta}>
        <div className={styles.scoreBar}>
          <div className={styles.scoreFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.scoreLabel}>{pct}% relevancia</span>
        <span className={styles.connections}>{piece.connections} conexiones</span>
      </div>
    </div>
  );
}

function PieceDetail({ piece, onClose }) {
  const Icon = TYPE_ICONS[piece.type] || FileText;
  const color = TYPE_COLORS[piece.type] || 'var(--accent-primary)';

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div className={styles.detailIcon} style={{ color, background: color + '18' }}>
          <Icon size={16} strokeWidth={1.5} />
        </div>
        <div className={styles.detailTitle}>
          <h3>{piece.title}</h3>
          <span>{piece.collection} · {piece.year}</span>
        </div>
        <button className={styles.detailClose} onClick={onClose}><X size={14} /></button>
      </div>

      <p className={styles.detailDesc}>{piece.description}</p>

      <div className={styles.detailEntities}>
        {Object.entries(piece.entities).map(([key, vals]) => vals.length > 0 && (
          <div key={key} className={styles.entityBlock}>
            <span className={styles.entityKey}>{key}</span>
            <div className={styles.entityVals}>
              {vals.map(v => <span key={v} className={styles.entityVal}>{v}</span>)}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.detailTags}>
        {piece.tags.map(t => <span key={t} className={styles.detailTag}>{t}</span>)}
      </div>
    </div>
  );
}
