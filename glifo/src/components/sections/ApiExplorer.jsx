import { useState } from 'react';
import { Copy, Check, ChevronRight, Globe } from 'lucide-react';
import SectionHeader from '../ui/SectionHeader';
import { useInView } from '../../hooks/useInView';
import styles from './ApiExplorer.module.css';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/pieces',
    label: 'Listar piezas',
    description: 'Retorna todas las piezas del acervo con metadata completa y paginación.',
    params: [
      { name: 'collection', type: 'string', desc: 'Filtrar por colección' },
      { name: 'type', type: 'string', desc: 'Filtrar por tipo (documento, imagen, audio, video)' },
      { name: 'limit', type: 'integer', desc: 'Piezas por página (default: 20)' },
      { name: 'offset', type: 'integer', desc: 'Desplazamiento para paginación' },
    ],
    response: {
      total: 342,
      limit: 20,
      offset: 0,
      items: [
        {
          id: 'doc-68-1',
          title: 'Manifiesto Estudiantil del CNH',
          type: 'documento',
          year: 1968,
          collection: 'Archivo del 68',
          connections: 7,
          embedding_id: 'emb_a3f9c2',
        },
        {
          id: 'arpa-1',
          title: 'Cortometraje — Memoria Viva',
          type: 'video',
          year: 2019,
          collection: 'ARPA BUAP',
          connections: 3,
          embedding_id: 'emb_b7e1d4',
        },
      ],
    },
  },
  {
    method: 'GET',
    path: '/api/v1/pieces/:id',
    label: 'Detalle de pieza',
    description: 'Retorna metadata completa, entidades extraídas, embeddings y conexiones de una pieza.',
    params: [
      { name: 'id', type: 'string', desc: 'Identificador único de la pieza', required: true },
    ],
    response: {
      id: 'doc-68-1',
      title: 'Manifiesto Estudiantil del CNH',
      type: 'documento',
      year: 1968,
      collection: 'Archivo del 68',
      description: 'Documento fundacional del Consejo Nacional de Huelga...',
      entities: {
        personas: ['Heberto Castillo', 'Eli de Gortari'],
        lugares: ['Ciudad de México', 'UNAM'],
        fechas: ['26 julio 1968', '2 octubre 1968'],
        temas: ['movimiento estudiantil', 'huelga', 'represión'],
      },
      connections: [
        { id: 'doc-68-2', title: 'Fotografía Tlatelolco', relation: 'contemporáneo', weight: 3 },
        { id: 'arpa-1', title: 'Cortometraje Memoria Viva', relation: 'referencia', weight: 2 },
      ],
      file_url: 'https://glifo.buap.mx/files/doc-68-1.pdf',
      ingested_at: '2026-06-01T14:23:10Z',
    },
  },
  {
    method: 'POST',
    path: '/api/v1/search',
    label: 'Búsqueda semántica',
    description: 'Búsqueda vectorial en lenguaje natural usando embeddings nomic-embed-text.',
    params: [
      { name: 'query', type: 'string', desc: 'Consulta en lenguaje natural', required: true },
      { name: 'limit', type: 'integer', desc: 'Número de resultados (default: 10)' },
      { name: 'type', type: 'string', desc: 'Filtrar por tipo de pieza' },
    ],
    response: {
      query: '¿Qué piezas hablan del movimiento estudiantil?',
      results: [
        { id: 'doc-68-1', title: 'Manifiesto Estudiantil del CNH', score: 0.97, type: 'documento' },
        { id: 'doc-68-2', title: 'Fotografía Tlatelolco', score: 0.94, type: 'imagen' },
        { id: 'arpa-1', title: 'Cortometraje Memoria Viva', score: 0.91, type: 'video' },
      ],
      took_ms: 42,
    },
  },
  {
    method: 'GET',
    path: '/api/v1/graph/neighbors/:id',
    label: 'Vecinos en el grafo',
    description: 'Retorna nodos conectados a una pieza con tipo de relación y peso de la conexión.',
    params: [
      { name: 'id', type: 'string', desc: 'ID de la pieza origen', required: true },
      { name: 'depth', type: 'integer', desc: 'Profundidad del grafo (1-3, default: 1)' },
    ],
    response: {
      origin: { id: 'mural-1', title: 'Mural Identidad Poblana' },
      neighbors: [
        { id: 'mural-2', title: 'Mural Resistencia', relation: 'estilo', weight: 2, depth: 1 },
        { id: 'swiss-1', title: 'Códice Mesoamericano Basel', relation: 'iconografía', weight: 3, depth: 1 },
        { id: 'doc-68-1', title: 'Manifiesto Estudiantil', relation: 'temático', weight: 2, depth: 2 },
      ],
      total_nodes: 3,
      total_edges: 3,
    },
  },
  {
    method: 'POST',
    path: '/api/v1/ingest',
    label: 'Ingestar pieza',
    description: 'Envía un archivo para procesamiento. La pipeline corre en background y retorna un job_id para seguimiento.',
    params: [
      { name: 'file', type: 'file', desc: 'Archivo a ingestar (PDF, imagen, audio, video)', required: true },
      { name: 'collection', type: 'string', desc: 'Colección destino', required: true },
      { name: 'metadata', type: 'object', desc: 'Metadata adicional opcional' },
    ],
    response: {
      job_id: 'job_7f3a1c9e',
      status: 'queued',
      file: 'testimonio_oral_1969.mp3',
      collection: 'Archivo del 68',
      estimated_seconds: 47,
      pipeline: ['extract_audio', 'transcribe', 'entities', 'embed', 'graph'],
    },
  },
];

const METHOD_COLORS = {
  GET:  { bg: 'rgba(74,124,89,0.14)',   text: '#4A7C59' },
  POST: { bg: 'rgba(196,98,45,0.14)',   text: '#C4622D' },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className={styles.copyBtn} onClick={copy} title="Copiar">
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export default function ApiExplorer() {
  const [active, setActive] = useState(0);
  const [ref, inView] = useInView();
  const ep = ENDPOINTS[active];
  const responseJson = JSON.stringify(ep.response, null, 2);
  const baseUrl = 'https://glifo.buap.mx';

  return (
    <section className="section section-a" id="api">
      <div className="container">
        <SectionHeader
          label="API Pública Abierta"
          title="El acervo, disponible para el mundo"
          subtitle="REST y GraphQL. Cualquier investigador, institución o desarrollador puede consumir el patrimonio con una petición HTTP."
        />

        <div className={styles.apiBadges}>
          <span className={styles.badge}><Globe size={11} /> REST API</span>
          <span className={styles.badge}>GraphQL</span>
          <span className={styles.badge} style={{ color: 'var(--accent-primary)' }}>Sin autenticación requerida</span>
          <span className={styles.badge}>Base URL: {baseUrl}</span>
        </div>

        <div ref={ref} className={`${styles.explorer} reveal ${inView ? 'visible' : ''}`}>
          {/* Endpoint list */}
          <div className={styles.sidebar}>
            <p className={styles.sidebarLabel}>Endpoints</p>
            {ENDPOINTS.map((ep, i) => (
              <button
                key={i}
                className={`${styles.epBtn} ${active === i ? styles.epBtnActive : ''}`}
                onClick={() => setActive(i)}
              >
                <span
                  className={styles.method}
                  style={{ background: METHOD_COLORS[ep.method].bg, color: METHOD_COLORS[ep.method].text }}
                >
                  {ep.method}
                </span>
                <span className={styles.epLabel}>{ep.label}</span>
                {active === i && <ChevronRight size={12} className={styles.chevron} />}
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className={styles.detail}>
            {/* Path bar */}
            <div className={styles.pathBar}>
              <span
                className={styles.methodBadge}
                style={{ background: METHOD_COLORS[ep.method].bg, color: METHOD_COLORS[ep.method].text }}
              >
                {ep.method}
              </span>
              <code className={styles.path}>{baseUrl}{ep.path}</code>
              <CopyButton text={`${baseUrl}${ep.path}`} />
            </div>

            <p className={styles.epDesc}>{ep.description}</p>

            {/* Parameters */}
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Parámetros</p>
              <div className={styles.paramsTable}>
                {ep.params.map(p => (
                  <div key={p.name} className={styles.paramRow}>
                    <div className={styles.paramLeft}>
                      <code className={styles.paramName}>{p.name}</code>
                      <span className={styles.paramType}>{p.type}</span>
                      {p.required && <span className={styles.required}>requerido</span>}
                    </div>
                    <span className={styles.paramDesc}>{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Response */}
            <div className={styles.section}>
              <div className={styles.responseLabelRow}>
                <p className={styles.sectionLabel}>Respuesta de ejemplo</p>
                <CopyButton text={responseJson} />
              </div>
              <pre className={styles.codeBlock}>
                <code>{responseJson}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* GraphQL note */}
        <div className={styles.graphqlNote}>
          <code className={styles.graphqlLabel}>GraphQL</code>
          <p>También disponible en <code className={styles.inline}>{baseUrl}/graphql</code>. Permite consultas anidadas, filtros complejos y subscripciones en tiempo real para eventos de ingesta.</p>
        </div>
      </div>
    </section>
  );
}
