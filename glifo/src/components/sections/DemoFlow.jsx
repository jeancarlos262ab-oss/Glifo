import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, CheckCircle, Loader, ChevronRight } from 'lucide-react';
import SectionHeader from '../ui/SectionHeader';
import styles from './DemoFlow.module.css';

// ─── Static mock data shown at each step ───────────────────────────────────

const MOCK_AI_RESULT = {
  description: 'Fotografía en blanco y negro de una concentración masiva en espacio abierto urbano. Se distinguen estandartes estudiantiles y estructura arquitectónica de bloques de vivienda al fondo. Estimado: entre 3,000 y 8,000 personas. Contexto urbano: Ciudad de México, circa 1968.',
  entities: {
    lugares:  ['Plaza de las Tres Culturas', 'Tlatelolco', 'Ciudad de México'],
    fechas:   ['2 octubre 1968'],
    temas:    ['protesta estudiantil', 'movimiento del 68', 'represión', 'masacre'],
    personas: ['estudiantes UNAM', 'estudiantes IPN'],
  },
  confidence: 0.94,
};

const MOCK_CONNECTIONS = [
  { id: 'doc-68-1', title: 'Manifiesto Estudiantil del CNH',  type: 'documento', relation: 'contemporáneo', weight: 3 },
  { id: 'doc-68-3', title: 'Carta al Rector UNAM',            type: 'documento', relation: 'temático',      weight: 2 },
  { id: 'arpa-1',   title: 'Cortometraje — Memoria Viva',     type: 'video',     relation: 'referencia',    weight: 2 },
  { id: 'doc-68-4', title: 'Testimonio Oral #12',             type: 'audio',     relation: 'testimonio',    weight: 2 },
];

const NL_QUERY = '¿Qué piezas hablan del movimiento estudiantil?';
const NL_RESULTS = [
  { title: 'Manifiesto Estudiantil del CNH', type: 'documento', score: 0.97, year: 1968 },
  { title: 'Fotografía Tlatelolco — recién procesada', type: 'imagen', score: 0.94, year: 1968 },
  { title: 'Testimonio Oral #12', type: 'audio', score: 0.87, year: 1969 },
  { title: 'Cortometraje — Memoria Viva', type: 'video', score: 0.91, year: 2019 },
];

const API_REQUEST  = `curl -X POST https://glifo.buap.mx/api/v1/search \\
  -H "Content-Type: application/json" \\
  -d '{"query": "movimiento estudiantil 1968", "limit": 5}'`;

const API_RESPONSE = `{
  "query": "movimiento estudiantil 1968",
  "results": [
    { "id": "doc-68-1", "title": "Manifiesto Estudiantil", "score": 0.97 },
    { "id": "doc-68-2", "title": "Fotografía Tlatelolco",  "score": 0.94 },
    { "id": "doc-68-4", "title": "Testimonio Oral #12",    "score": 0.87 }
  ],
  "took_ms": 38
}`;

// ─── Steps definition ───────────────────────────────────────────────────────

const STEPS = [
  { id: 'upload',    label: 'Carga de pieza',       short: '01 — Carga' },
  { id: 'ai',        label: 'Análisis con IA',       short: '02 — IA' },
  { id: 'graph',     label: 'Grafo en vivo',         short: '03 — Grafo' },
  { id: 'nl',        label: 'Lenguaje natural',      short: '04 — NL Query' },
  { id: 'api',       label: 'API pública',           short: '05 — API' },
];

// ─── Animated typing hook ───────────────────────────────────────────────────

function useTyping(text, active, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  const i = useRef(0);

  useEffect(() => {
    if (!active) { setDisplayed(''); i.current = 0; return; }
    i.current = 0;
    const interval = setInterval(() => {
      i.current++;
      setDisplayed(text.slice(0, i.current));
      if (i.current >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [active, text, speed]);

  return displayed;
}

// ─── Step panels ────────────────────────────────────────────────────────────

function StepUpload({ state }) {
  const done = state === 'done';
  return (
    <div className={styles.panel}>
      <p className={styles.panelLabel}>Archivo seleccionado</p>
      <div className={`${styles.fileCard} ${done ? styles.fileCardDone : ''}`}>
        <div className={styles.fileIcon}>
          <span className={styles.fileExt}>JPG</span>
        </div>
        <div className={styles.fileInfo}>
          <span className={styles.fileName}>tlatelolco_2oct1968.jpg</span>
          <span className={styles.fileMeta}>Imagen escaneada · 3.2 MB · Archivo del 68</span>
        </div>
        {state === 'running' && <Loader size={15} className={styles.spin} />}
        {done && <CheckCircle size={15} className={styles.checkGreen} />}
      </div>
      {done && (
        <div className={styles.uploadDone}>
          Archivo recibido — iniciando pipeline de procesamiento
        </div>
      )}
    </div>
  );
}

function StepAI({ state }) {
  const [visibleKeys, setVisibleKeys] = useState([]);
  const [showConf, setShowConf] = useState(false);
  const descTyped = useTyping(MOCK_AI_RESULT.description, state === 'running' || state === 'done', 10);

  useEffect(() => {
    if (state !== 'running' && state !== 'done') { setVisibleKeys([]); setShowConf(false); return; }
    const keys = Object.keys(MOCK_AI_RESULT.entities);
    keys.forEach((k, i) => {
      setTimeout(() => setVisibleKeys(p => [...p, k]), 1400 + i * 400);
    });
    setTimeout(() => setShowConf(true), 1400 + keys.length * 400 + 200);
  }, [state]);

  return (
    <div className={styles.panel}>
      <p className={styles.panelLabel}>Modelo: llava + llama3.2</p>
      <div className={styles.aiDesc}>
        <span className={styles.aiDescText}>{descTyped}</span>
        {state === 'running' && descTyped.length < MOCK_AI_RESULT.description.length && (
          <span className={styles.cursor} />
        )}
      </div>
      {visibleKeys.length > 0 && (
        <div className={styles.entitiesGrid}>
          {visibleKeys.map(k => (
            <div key={k} className={styles.entityBlock}>
              <span className={styles.entityKey}>{k}</span>
              <div className={styles.entityVals}>
                {MOCK_AI_RESULT.entities[k].map(v => (
                  <span key={v} className={styles.entityVal}>{v}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {showConf && (
        <div className={styles.confRow}>
          <span className={styles.confLabel}>Confianza del modelo</span>
          <div className={styles.confBar}>
            <div className={styles.confFill} style={{ width: `${MOCK_AI_RESULT.confidence * 100}%` }} />
          </div>
          <span className={styles.confValue}>{Math.round(MOCK_AI_RESULT.confidence * 100)}%</span>
        </div>
      )}
    </div>
  );
}

function StepGraph({ state }) {
  const [visibleConns, setVisibleConns] = useState([]);
  const [pulseNode, setPulseNode] = useState(false);

  useEffect(() => {
    if (state !== 'running' && state !== 'done') { setVisibleConns([]); setPulseNode(false); return; }
    setPulseNode(true);
    MOCK_CONNECTIONS.forEach((_, i) => {
      setTimeout(() => setVisibleConns(p => [...p, i]), 300 + i * 500);
    });
  }, [state]);

  const typeColors = {
    documento: 'var(--accent-primary)',
    audio:     'var(--accent-primary)',
    video:     'var(--accent-azul-claro)',
    imagen:    'var(--accent-dorado)',
  };

  return (
    <div className={styles.panel}>
      <p className={styles.panelLabel}>Neo4j / NetworkX — actualización en vivo</p>
      <div className={styles.graphMini}>
        {/* Central node */}
        <div className={`${styles.centerNode} ${pulseNode ? styles.centerNodePulse : ''}`}>
          <span className={styles.centerNodeLabel}>tlatelolco<br/>2oct1968.jpg</span>
        </div>
        {/* Connection lines */}
        {MOCK_CONNECTIONS.map((conn, i) => (
          <div
            key={conn.id}
            className={`${styles.connLine} ${styles[`connLine${i}`]} ${visibleConns.includes(i) ? styles.connLineVisible : ''}`}
          >
            <div
              className={styles.connNode}
              style={{ borderColor: typeColors[conn.type] || 'var(--border-strong)', color: typeColors[conn.type] }}
            >
              <span className={styles.connNodeLabel}>{conn.title}</span>
              <span className={styles.connNodeType}>{conn.type}</span>
            </div>
            <span className={styles.connRelation}>{conn.relation}</span>
          </div>
        ))}
      </div>
      {visibleConns.length === MOCK_CONNECTIONS.length && (
        <div className={styles.graphDone}>
          <CheckCircle size={12} />
          {MOCK_CONNECTIONS.length} nuevas conexiones integradas al grafo
        </div>
      )}
    </div>
  );
}

function StepNL({ state }) {
  const queryTyped = useTyping(NL_QUERY, state === 'running' || state === 'done', 30);
  const [showResults, setShowResults] = useState(false);
  const [visibleResults, setVisibleResults] = useState([]);

  useEffect(() => {
    if (state !== 'running' && state !== 'done') { setShowResults(false); setVisibleResults([]); return; }
    const t1 = setTimeout(() => setShowResults(true), NL_QUERY.length * 30 + 400);
    NL_RESULTS.forEach((_, i) => {
      setTimeout(() => setVisibleResults(p => [...p, i]), NL_QUERY.length * 30 + 700 + i * 250);
    });
    return () => clearTimeout(t1);
  }, [state]);

  const typeColors = { documento: 'var(--accent-primary)', imagen: 'var(--accent-dorado)', audio: 'var(--accent-primary)', video: 'var(--accent-azul-claro)' };

  return (
    <div className={styles.panel}>
      <p className={styles.panelLabel}>Búsqueda semántica — pgvector + nomic-embed-text</p>
      <div className={styles.nlInput}>
        <span className={styles.nlPrompt}>query:</span>
        <span className={styles.nlQuery}>{queryTyped}</span>
        {state === 'running' && queryTyped.length < NL_QUERY.length && <span className={styles.cursor} />}
      </div>
      {showResults && (
        <div className={styles.nlResults}>
          {NL_RESULTS.filter((_, i) => visibleResults.includes(i)).map((r, i) => (
            <div key={i} className={styles.nlResult}>
              <div className={styles.nlResultDot} style={{ background: typeColors[r.type] }} />
              <div className={styles.nlResultInfo}>
                <span className={styles.nlResultTitle}>{r.title}</span>
                <span className={styles.nlResultMeta}>{r.year} · {r.type}</span>
              </div>
              <div className={styles.nlScore}>
                <div className={styles.nlScoreBar}>
                  <div className={styles.nlScoreFill} style={{ width: `${r.score * 100}%` }} />
                </div>
                <span>{Math.round(r.score * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepAPI({ state }) {
  const reqTyped  = useTyping(API_REQUEST,  state === 'running' || state === 'done', 8);
  const [showResp, setShowResp] = useState(false);
  const respTyped = useTyping(API_RESPONSE, showResp, 6);

  useEffect(() => {
    if (state !== 'running' && state !== 'done') { setShowResp(false); return; }
    const t = setTimeout(() => setShowResp(true), API_REQUEST.length * 8 + 600);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className={styles.panel}>
      <p className={styles.panelLabel}>curl — cualquier desarrollador puede hacer esto</p>
      <div className={styles.terminal}>
        <div className={styles.terminalHeader}>
          <span className={styles.termDot} style={{ background: '#FF5F57' }} />
          <span className={styles.termDot} style={{ background: '#FEBC2E' }} />
          <span className={styles.termDot} style={{ background: '#28C840' }} />
          <span className={styles.termTitle}>Terminal</span>
        </div>
        <pre className={styles.termBody}>
          <span className={styles.termPrompt}>$ </span>
          <span className={styles.termCode}>{reqTyped}</span>
          {state === 'running' && reqTyped.length < API_REQUEST.length && <span className={styles.cursor} />}
          {showResp && (
            <span className={`\n${styles.termResponse}`}>{'\n\n'}{respTyped}</span>
          )}
        </pre>
      </div>
      {respTyped.length === API_RESPONSE.length && (
        <div className={styles.apiSuccess}>
          <CheckCircle size={12} />
          38ms · acervo abierto al mundo
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

const STEP_DURATIONS = [1800, 3200, 3000, 3500, 4000];

export default function DemoFlow() {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [stepStates, setStepStates] = useState(STEPS.map(() => 'idle'));
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const reset = useCallback(() => {
    clearTimers();
    setRunning(false);
    setCurrentStep(-1);
    setStepStates(STEPS.map(() => 'idle'));
  }, []);

  const run = useCallback(() => {
    reset();
    setTimeout(() => {
      setRunning(true);
      let delay = 0;
      STEPS.forEach((_, i) => {
        const t1 = setTimeout(() => {
          setCurrentStep(i);
          setStepStates(p => p.map((s, j) => j === i ? 'running' : j < i ? 'done' : 'idle'));
        }, delay);
        timers.current.push(t1);
        delay += STEP_DURATIONS[i];
        const t2 = setTimeout(() => {
          setStepStates(p => p.map((s, j) => j === i ? 'done' : s));
          if (i === STEPS.length - 1) setRunning(false);
        }, delay);
        timers.current.push(t2);
      });
    }, 60);
  }, [reset]);

  useEffect(() => () => clearTimers(), []);

  const PANELS = [StepUpload, StepAI, StepGraph, StepNL, StepAPI];

  return (
    <section className="section section-d" id="demo-flow">
      <div className="container">
        <SectionHeader
          label="Simulación del Momento WOW"
          title="El flujo completo, en vivo"
          subtitle="Presiona Ejecutar para ver la simulación completa del flujo de Glifo en tiempo real."
        />

        <div className={styles.wrapper}>
          {/* Control bar */}
          <div className={styles.controls}>
            <div className={styles.controlsLeft}>
              {!running && currentStep === -1 && (
                <button className={styles.runBtn} onClick={run}>
                  <Play size={13} />
                  Ejecutar demo
                </button>
              )}
              {running && (
                <div className={styles.running}>
                  <Loader size={13} className={styles.spin} />
                  Ejecutando…
                </div>
              )}
              {!running && currentStep >= 0 && (
                <button className={styles.resetBtn} onClick={reset}>
                  <RotateCcw size={13} />
                  Reiniciar
                </button>
              )}
            </div>
            <div className={styles.stepIndicators}>
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={`${styles.indicator} ${stepStates[i] === 'done' ? styles.indicatorDone : ''} ${stepStates[i] === 'running' ? styles.indicatorRunning : ''}`}
                />
              ))}
            </div>
          </div>

          {/* Steps tabs */}
          <div className={styles.tabs}>
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                className={`${styles.tab} ${currentStep === i ? styles.tabActive : ''} ${stepStates[i] === 'done' ? styles.tabDone : ''}`}
                onClick={() => currentStep >= i && setCurrentStep(i)}
              >
                {stepStates[i] === 'done' && <CheckCircle size={11} className={styles.tabCheck} />}
                {stepStates[i] === 'running' && <Loader size={11} className={styles.spin} />}
                <span>{s.short}</span>
                {i < STEPS.length - 1 && <ChevronRight size={11} className={styles.tabArrow} />}
              </button>
            ))}
          </div>

          {/* Active panel */}
          <div className={styles.panelArea}>
            {currentStep === -1 && (
              <div className={styles.idle}>
                <p>Presiona <strong>Ejecutar demo</strong> para iniciar la simulación</p>
              </div>
            )}
            {currentStep >= 0 && (() => {
              const Panel = PANELS[currentStep];
              return <Panel state={stepStates[currentStep]} />;
            })()}
          </div>
        </div>
      </div>
    </section>
  );
}
