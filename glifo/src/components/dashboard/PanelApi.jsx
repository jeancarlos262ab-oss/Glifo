import { useState, useCallback } from 'react';
import { Play, Copy, ChevronDown, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import styles from './PanelApi.module.css';

const BASE = 'http://localhost:8000';

const ENDPOINTS = [
  {
    group: 'Sistema',
    items: [
      { method: 'GET', path: '/health', desc: 'Estado general del sistema y servicios', body: null },
      { method: 'GET', path: '/api/v1/ai/status', desc: 'Estado de modelos Ollama', body: null },
      { method: 'GET', path: '/api/v1/ai/backends', desc: 'Backends de audio/video disponibles', body: null },
    ],
  },
  {
    group: 'Estadísticas',
    items: [
      { method: 'GET', path: '/api/v1/stats/overview', desc: 'Datos del panel Overview', body: null },
      { method: 'GET', path: '/api/v1/stats/colecciones', desc: 'Colecciones con conteo de piezas', body: null },
    ],
  },
  {
    group: 'Piezas',
    items: [
      { method: 'GET', path: '/api/v1/piezas', desc: 'Listar piezas con filtros y paginación', body: null,
        params: '?pagina=1&por_pagina=10' },
      { method: 'GET', path: '/api/v1/piezas/{id}', desc: 'Detalle de una pieza', body: null,
        paramInput: { key: 'id', placeholder: 'UUID de la pieza' } },
      { method: 'POST', path: '/api/v1/piezas', desc: 'Crear pieza manual sin archivo',
        body: JSON.stringify({ titulo: 'Mi pieza', tipo: 'documento', coleccion: 'Mi colección' }, null, 2) },
    ],
  },
  {
    group: 'Búsqueda',
    items: [
      { method: 'POST', path: '/api/v1/buscar', desc: 'Búsqueda semántica por texto',
        body: JSON.stringify({ query: 'patrimonio cultural', top_k: 5 }, null, 2) },
      { method: 'GET', path: '/api/v1/buscar/stats', desc: 'Estadísticas del índice semántico', body: null },
    ],
  },
  {
    group: 'Grafo',
    items: [
      { method: 'GET', path: '/api/v1/grafo', desc: 'Nodos y aristas completos del grafo', body: null },
      { method: 'GET', path: '/api/v1/grafo/stats', desc: 'Estadísticas del grafo', body: null },
    ],
  },
  {
    group: 'Jobs / Cola',
    items: [
      { method: 'GET', path: '/api/v1/jobs', desc: 'Lista de jobs de procesamiento', body: null,
        params: '?limit=20' },
      { method: 'GET', path: '/api/v1/jobs/cola', desc: 'Estado actual de la cola', body: null },
    ],
  },
];

const METHOD_COLORS = { GET: '#3DAA6A', POST: '#4A9EE0', PATCH: '#C8A84B', DELETE: '#B04A4A' };

function syntaxHighlight(json) {
  if (typeof json !== 'string') json = JSON.stringify(json, null, 2);
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-string';
      else if (/true|false/.test(match)) cls = 'json-bool';
      else if (/null/.test(match)) cls = 'json-null';
      return `<span class="${cls}">${match}</span>`;
    });
}

export default function PanelApi() {
  const [activeEndpoint, setActiveEndpoint] = useState(null);
  const [paramValue, setParamValue] = useState('');
  const [bodyValue, setBodyValue] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set(ENDPOINTS.map(e => e.group)));

  const selectEndpoint = (ep) => {
    setActiveEndpoint(ep);
    setParamValue('');
    setBodyValue(ep.body || '');
    setResponse(null);
    setResponseTime(null);
  };

  const buildUrl = () => {
    if (!activeEndpoint) return '';
    let path = activeEndpoint.path;
    if (activeEndpoint.paramInput && paramValue) {
      path = path.replace(`{${activeEndpoint.paramInput.key}}`, paramValue);
    }
    return `${BASE}${path}${activeEndpoint.params || ''}`;
  };

  const handleRun = useCallback(async () => {
    if (!activeEndpoint) return;
    setLoading(true);
    setResponse(null);
    const url = buildUrl();
    const t0 = Date.now();
    try {
      const opts = { method: activeEndpoint.method };
      if (activeEndpoint.body && bodyValue) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = bodyValue;
      }
      const res = await fetch(url, opts);
      let data;
      try { data = await res.json(); } catch { data = { error: 'Non-JSON response' }; }
      setResponseTime(Date.now() - t0);
      setResponse({ status: res.status, ok: res.ok, data });
    } catch (e) {
      setResponseTime(Date.now() - t0);
      setResponse({ status: 0, ok: false, data: { error: e.message, hint: 'Verifica que el backend esté corriendo en http://localhost:8000' } });
    } finally {
      setLoading(false);
    }
  }, [activeEndpoint, bodyValue, paramValue]);

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleGroup = (group) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.headerLabel}>Explorador</p>
        <h2 className={styles.headerTitle}>API Explorer</h2>
        <p className={styles.headerSub}>Prueba todos los endpoints de la API Glifo directamente desde el navegador.</p>
        <div className={styles.baseUrl}>
          <span className={styles.baseLabel}>Base URL</span>
          <code className={styles.baseCode}>{BASE}/api/v1</code>
        </div>
      </div>

      <div className={styles.explorer}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          {ENDPOINTS.map(group => (
            <div key={group.group} className={styles.group}>
              <button
                className={styles.groupHeader}
                onClick={() => toggleGroup(group.group)}
              >
                {expandedGroups.has(group.group)
                  ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                }
                <span>{group.group}</span>
                <span className={styles.groupCount}>{group.items.length}</span>
              </button>
              {expandedGroups.has(group.group) && (
                <div className={styles.groupItems}>
                  {group.items.map(ep => (
                    <button
                      key={ep.path + ep.method}
                      className={`${styles.epItem} ${activeEndpoint?.path === ep.path && activeEndpoint?.method === ep.method ? styles.epActive : ''}`}
                      onClick={() => selectEndpoint(ep)}
                    >
                      <span className={styles.epMethod} style={{ color: METHOD_COLORS[ep.method] }}>
                        {ep.method}
                      </span>
                      <span className={styles.epPath}>{ep.path.replace('/api/v1', '')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className={styles.main}>
          {!activeEndpoint ? (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>{'</>'}</div>
              <p>Selecciona un endpoint del panel izquierdo para probarlo</p>
            </div>
          ) : (
            <>
              {/* Endpoint header */}
              <div className={styles.epHeader}>
                <span
                  className={styles.epMethodBig}
                  style={{ background: `${METHOD_COLORS[activeEndpoint.method]}18`, color: METHOD_COLORS[activeEndpoint.method] }}
                >
                  {activeEndpoint.method}
                </span>
                <span className={styles.epPathBig}>{buildUrl()}</span>
              </div>
              <p className={styles.epDesc}>{activeEndpoint.desc}</p>

              {/* Param input */}
              {activeEndpoint.paramInput && (
                <div className={styles.paramSection}>
                  <label className={styles.paramLabel}>Parámetro: {activeEndpoint.paramInput.key}</label>
                  <input
                    className={styles.paramInput}
                    placeholder={activeEndpoint.paramInput.placeholder}
                    value={paramValue}
                    onChange={e => setParamValue(e.target.value)}
                  />
                </div>
              )}

              {/* Body */}
              {activeEndpoint.body !== null && (
                <div className={styles.bodySection}>
                  <label className={styles.paramLabel}>Request body (JSON)</label>
                  <textarea
                    className={styles.bodyTextarea}
                    value={bodyValue}
                    onChange={e => setBodyValue(e.target.value)}
                    rows={8}
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Run */}
              <button
                className={styles.runBtn}
                onClick={handleRun}
                disabled={loading}
              >
                {loading
                  ? <><Loader2 size={15} className={styles.spin} /> Ejecutando…</>
                  : <><Play size={15} /> Ejecutar</>
                }
              </button>

              {/* Response */}
              {response && (
                <div className={styles.responseSection}>
                  <div className={styles.responseHeader}>
                    <div className={styles.responseStatus}>
                      <span
                        className={styles.statusCode}
                        style={{ color: response.ok ? '#3DAA6A' : '#B04A4A' }}
                      >
                        {response.status || 'Error'}
                      </span>
                      <span className={styles.responseTime}>{responseTime}ms</span>
                    </div>
                    <button className={styles.copyBtn} onClick={handleCopy}>
                      {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div className={styles.responseBody}>
                    <pre
                      className={styles.jsonPre}
                      dangerouslySetInnerHTML={{
                        __html: syntaxHighlight(JSON.stringify(response.data, null, 2))
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
