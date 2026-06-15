import { useState, useEffect, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { Filter, ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';
import { grafoApi } from '../../services/api';
import styles from './PanelGrafo.module.css';

/* ─── Límites de rendimiento ─────────────────────────────────── */
const MAX_NODES_RENDER = 400;   // máximo de nodos visibles en pantalla
const MAX_LINKS_RENDER = 800;   // máximo de aristas visibles

/* ─── Color palettes ─────────────────────────────────────────── */
const TYPE_COLORS = {
  documento:  '#4A9EE0',
  imagen:     '#E8A838',
  audio:      '#3EC98E',
  video:      '#F06040',
  objeto:     '#A07BE8',
  patrimonio: '#E85C78',
  institución:'#38C4B8',
};

const TYPE_LABELS = {
  documento:  'Documento',
  imagen:     'Imagen',
  audio:      'Audio',
  video:      'Video',
  objeto:     'Objeto',
  patrimonio: 'Patrimonio',
  institución:'Institución',
};

const LINK_COLORS = {
  contemporáneo: '#4A9EE0', temático: '#E8A838', visual: '#3EC98E',
  testimonio:    '#5BB8F5', referencia: '#A07BE8', iconografía: '#E8A838',
  simbólico:     '#E85C78', origen:    '#5BB8F5', cultura:    '#3EC98E',
  período:       '#4A9EE0', custodia:  '#38C4B8', gestión:    '#A07BE8',
  inspiración:   '#E8A838', exhibición: '#E85C78', audio:     '#3EC98E',
  estilo:        '#4A9EE0', relacionado: '#8AAAD4',
  entidad_compartida: '#5BB8F5', tags_compartidos: '#8AAAD4',
};

function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bgVar = getComputedStyle(document.documentElement)
    .getPropertyValue('--bg-base').trim() || (isDark ? '#161B24' : '#F4F6FA');
  return {
    bg:         bgVar,
    labelColor: isDark ? 'rgba(148,170,212,0.55)' : 'rgba(42,74,122,0.50)',
    labelHover: isDark ? 'rgba(220,230,250,0.90)' : 'rgba(10,21,37,0.90)',
    arrowFill:  isDark ? 'rgba(74,158,224,0.22)' : 'rgba(0,61,124,0.18)',
  };
}

function nodeColor(n) {
  return TYPE_COLORS[n.tipo] || TYPE_COLORS[n.type] || '#6B8AB8';
}

function linkColor(l) {
  return LINK_COLORS[l.tipo] || LINK_COLORS[l.type] || '#8888aa';
}

/* ─── Muestrea nodos priorizando los más conectados ─────────── */
function sampleGraph(nodes, links, maxNodes, maxLinks) {
  if (nodes.length <= maxNodes) {
    return { nodes, links: links.slice(0, maxLinks) };
  }

  const connectionCount = new Map();
  for (const l of links) {
    const s = l.source?.id ?? l.source;
    const t = l.target?.id ?? l.target;
    connectionCount.set(s, (connectionCount.get(s) || 0) + 1);
    connectionCount.set(t, (connectionCount.get(t) || 0) + 1);
  }

  const sorted = [...nodes].sort((a, b) => {
    const ca = connectionCount.get(a.id) || a.conexiones || a.num_conexiones || 0;
    const cb = connectionCount.get(b.id) || b.conexiones || b.num_conexiones || 0;
    return cb - ca;
  });

  const sampled = sorted.slice(0, maxNodes);
  const sampledIds = new Set(sampled.map(n => n.id));
  const sampledLinks = links
    .filter(l => {
      const s = l.source?.id ?? l.source;
      const t = l.target?.id ?? l.target;
      return sampledIds.has(s) && sampledIds.has(t);
    })
    .slice(0, maxLinks);

  return { nodes: sampled, links: sampledLinks };
}

/* ─── D3 graph renderer ─────────────────────────────────────────── */
function drawGraph({ svgEl, data, filterCollection, activeNode, onNodeClick, zoomRef, simulationRef }) {
  const container = svgEl.parentElement;
  if (!container) return;

  const W = Math.max(container.clientWidth  || 0, 600);
  const H = Math.max(container.clientHeight || 0, 480);
  const tc = getThemeColors();

  const rawNodes = (data.nodos  || data.nodes  || []);
  const rawLinks = (data.aristas || data.links || []);

  if (rawNodes.length === 0) return;

  // 1. Filtrar por colección
  const filteredNodes = filterCollection === 'Todos'
    ? rawNodes
    : rawNodes.filter(n => (n.coleccion || n.collection) === filterCollection);
  const filteredIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = rawLinks.filter(l => {
    const s = l.source?.id ?? l.source;
    const t = l.target?.id ?? l.target;
    return filteredIds.has(s) && filteredIds.has(t);
  });

  // 2. Reducir si hay demasiados nodos
  const { nodes: sampledNodes, links: sampledLinks } = sampleGraph(
    filteredNodes, filteredLinks, MAX_NODES_RENDER, MAX_LINKS_RENDER
  );
  const isTruncated = filteredNodes.length > sampledNodes.length;

  const nodes = sampledNodes.map(d => ({ ...d }));
  const links = sampledLinks.map(d => ({
    ...d,
    source: d.source?.id ?? d.source,
    target: d.target?.id ?? d.target,
  }));

  d3.select(svgEl).selectAll('*').remove();
  if (simulationRef.current) simulationRef.current.stop();

  const svg = d3.select(svgEl).attr('width', W).attr('height', H);

  /* Background */
  svg.append('rect').attr('width', W).attr('height', H).attr('fill', tc.bg);

  /* Defs: glow filter + arrow marker */
  const defs = svg.append('defs');

  const glow = defs.append('filter').attr('id', 'pg-glow')
    .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
  glow.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'blur');
  const mg = glow.append('feMerge');
  mg.append('feMergeNode').attr('in', 'blur');
  mg.append('feMergeNode').attr('in', 'SourceGraphic');

  defs.append('marker').attr('id', 'pg-arrow')
    .attr('viewBox', '0 -4 8 8').attr('refX', 20).attr('refY', 0)
    .attr('markerWidth', 4).attr('markerHeight', 4).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', tc.arrowFill);

  const g = svg.append('g');

  /* Zoom */
  const zoom = d3.zoom().scaleExtent([0.05, 4])
    .on('zoom', e => g.attr('transform', e.transform));
  zoomRef.current = zoom;
  svg.call(zoom);

  /* ─── Escalar fuerzas según tamaño del grafo ─── */
  const n = nodes.length;
  const linkDistance = Math.max(80, Math.min(200, 1200 / Math.sqrt(n)));
  const chargeStrength = -Math.max(200, Math.min(800, 15000 / Math.sqrt(n)));
  const collisionRadius = Math.max(20, Math.min(50, 600 / Math.sqrt(n)));

  /* Simulation */
  const simulation = d3.forceSimulation(nodes)
    .alphaDecay(0.04)
    .velocityDecay(0.5)
    .force('link',
      d3.forceLink(links)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(0.3)
    )
    .force('charge', d3.forceManyBody().strength(chargeStrength))
    .force('center', d3.forceCenter(W / 2, H / 2).strength(0.08))
    .force('collision', d3.forceCollide(collisionRadius).strength(0.9))
    .force('x', d3.forceX(W / 2).strength(0.04))
    .force('y', d3.forceY(H / 2).strength(0.04));

  simulationRef.current = simulation;

  /* Links */
  const link = g.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', d => linkColor(d))
    .attr('stroke-opacity', 0.25)
    .attr('stroke-width', d => (d.weight || d.peso || 1) * 0.75)
    .attr('stroke-dasharray', d => (d.weight || d.peso || 1) === 1 ? '3,5' : 'none')
    .attr('marker-end', 'url(#pg-arrow)');

  /* Nodes */
  const node = g.append('g').selectAll('g').data(nodes).join('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (e, d) => {
        if (!e.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end',   (e, d) => {
        if (!e.active) simulation.alphaTarget(0);
        d.fx = d.x;
        d.fy = d.y;
      })
    )
    .on('click', (e, d) => { e.stopPropagation(); onNodeClick(d); });

  /* Hover interactions */
  node
    .on('mouseenter', function(e, d) {
      d3.select(this).select('.pg-ring').attr('r', 18).attr('stroke-opacity', 0.9);
      d3.select(this).select('.pg-label').attr('fill', tc.labelHover);
    })
    .on('mouseleave', function(e, d) {
      const isAct = activeNode?.id === d.id;
      d3.select(this).select('.pg-ring').attr('r', isAct ? 18 : 13).attr('stroke-opacity', isAct ? 1 : 0.55);
      d3.select(this).select('.pg-label').attr('fill', tc.labelColor);
    });

  /* Ring */
  node.append('circle').attr('class', 'pg-ring')
    .attr('r', d => activeNode?.id === d.id ? 18 : 13)
    .attr('fill', d => nodeColor(d) + '18')
    .attr('stroke', d => nodeColor(d))
    .attr('stroke-width', 1.4)
    .attr('stroke-opacity', d => activeNode?.id === d.id ? 1 : 0.55)
    .attr('filter', d => activeNode?.id === d.id ? 'url(#pg-glow)' : 'none');

  /* Core dot */
  node.append('circle').attr('class', 'pg-core')
    .attr('r', 4.5)
    .attr('fill', d => nodeColor(d))
    .attr('opacity', 0.92);

  /* Label */
  const labelFontSize = n <= 50 ? '10px' : n <= 150 ? '9px' : '8px';
  const labelMaxLen   = n <= 50 ? 22 : n <= 150 ? 18 : 14;
  const labelText = d => {
    const lbl = d.titulo || d.label || d.nombre || d.id || '';
    return lbl.length > labelMaxLen ? lbl.slice(0, labelMaxLen - 1) + '…' : lbl;
  };
  node.append('text').attr('class', 'pg-label')
    .attr('y', 27).attr('text-anchor', 'middle')
    .attr('font-size', labelFontSize).attr('font-family', 'var(--font-mono)')
    .attr('fill', tc.labelColor)
    .attr('pointer-events', 'none').attr('letter-spacing', '0.02em')
    .text(labelText);

  /* Click on background deselects */
  svg.on('click', () => onNodeClick(null));

  /* Tick */
  simulation.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  return { truncated: isTruncated, totalNodes: filteredNodes.length, renderedNodes: n };
}

/* ─── Component ─────────────────────────────────────────────────── */
export default function PanelGrafo() {
  const [grafoData, setGrafoData]   = useState(null);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [activeNode, setActiveNode] = useState(null);
  const [filterCollection, setFilterCollection] = useState('Todos');
  const [filterOpen, setFilterOpen] = useState(false);
  const [renderInfo, setRenderInfo] = useState(null);

  const svgRef        = useRef(null);
  const zoomRef       = useRef(null);
  const simulationRef = useRef(null);
  const containerRef  = useRef(null);
  /* ── Data loading ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, st] = await Promise.all([grafoApi.datos(), grafoApi.stats()]);

      const nodos = data.nodos || data.nodes || [];
      if (nodos.length === 0) {
        setGrafoData({ nodos: [], aristas: [] });
        setStats(st);
      } else {
        setGrafoData(data);
        setStats(st);
      }
    } catch (e) {
      setGrafoData({ nodos: [], aristas: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Draw / redraw ── */
  const redraw = useCallback(() => {
    if (!svgRef.current || !grafoData) return;
    const W = containerRef.current?.clientWidth || 0;
    const H = containerRef.current?.clientHeight || 0;
    if (W === 0 || H === 0) return;

    const info = drawGraph({
      svgEl: svgRef.current,
      data: grafoData,
      filterCollection,
      activeNode,
      onNodeClick: (node) => setActiveNode(an => an?.id === node?.id ? null : node),
      zoomRef,
      simulationRef,
    });
    if (info) setRenderInfo(info);
  }, [grafoData, filterCollection, activeNode]);

  useEffect(() => {
    const t = setTimeout(redraw, 80);
    return () => clearTimeout(t);
  }, [redraw]);

  /* Resize observer */
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => {
      const el = containerRef.current;
      if (el && el.clientWidth > 0 && el.clientHeight > 0) redraw();
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [redraw]);

  /* Theme observer */
  useEffect(() => {
    const mut = new MutationObserver(() => redraw());
    mut.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mut.disconnect();
  }, [redraw]);

  /* ── Derived data for UI ── */
  const rawNodes = grafoData?.nodos || grafoData?.nodes || [];
  const rawLinks = grafoData?.aristas || grafoData?.links || [];

  const collections = ['Todos', ...new Set(rawNodes.map(n => n.coleccion || n.collection).filter(Boolean))];

  const visibleNodes = filterCollection === 'Todos'
    ? rawNodes
    : rawNodes.filter(n => (n.coleccion || n.collection) === filterCollection);
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const visibleLinks = rawLinks.filter(l => {
    const s = l.source?.id ?? l.source;
    const t = l.target?.id ?? l.target;
    return visibleIds.has(s) && visibleIds.has(t);
  });

  const allNodeTypes = [...new Set(rawNodes.map(n => n.tipo || n.type).filter(Boolean))];

  /* ── Conexiones del nodo activo ── */
  const activeConnections = activeNode ? (() => {
    const nodeMap = new Map(rawNodes.map(n => [n.id, n]));
    return rawLinks
      .filter(l => {
        const s = l.source?.id ?? l.source;
        const t = l.target?.id ?? l.target;
        return s === activeNode.id || t === activeNode.id;
      })
      .map(l => {
        const s = l.source?.id ?? l.source;
        const t = l.target?.id ?? l.target;
        const otherId = s === activeNode.id ? t : s;
        const other = nodeMap.get(otherId);
        const direction = s === activeNode.id ? 'out' : 'in';
        return {
          id: otherId,
          tipo: l.tipo || l.type || 'relacionado',
          nombre: other?.titulo || other?.label || other?.nombre || otherId,
          tipoNodo: other?.tipo || other?.type,
          direction,
        };
      });
  })() : [];

  /* ── Zoom helpers ── */
  const zoomIn  = () => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(260).call(zoomRef.current.scaleBy, 1.4); };
  const zoomOut = () => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(260).call(zoomRef.current.scaleBy, 1 / 1.4); };
  const zoomReset = () => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(320).call(zoomRef.current.transform, d3.zoomIdentity); };

  /* ── Mensaje cuando no hay datos ── */
  const isEmpty = rawNodes.length === 0 && !loading;

  /* ── Loading state ── */
  if (loading) return (
    <div className={styles.root}>
      <div className={styles.loadState}>
        <Loader2 size={24} className={styles.spin} />
        <span>Cargando grafo de conocimiento…</span>
      </div>
    </div>
  );

  return (
    <div className={styles.root}>

      {/* Aviso de truncado cuando hay miles de nodos */}
      {renderInfo?.truncated && (
        <div className={styles.truncatedBanner}>
          <span>
            Mostrando {renderInfo.renderedNodes} de {renderInfo.totalNodes} nodos
            (los más conectados). Usa el filtro de colección para explorar subconjuntos.
          </span>
        </div>
      )}

      <div className={styles.graphWrapper}>

        {/* Canvas area */}
        <div className={styles.canvasArea}>
          <div className={styles.canvas} ref={containerRef}>

            {/* D3 SVG */}
            <svg ref={svgRef} className={styles.svg} />

            {/* Estado vacío — centrado dentro del canvas */}
            {isEmpty && (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>Sin datos en el grafo</p>
              </div>
            )}

            {/* Stats pill - solo mostrar si hay datos */}
            {!isEmpty && (
              <div className={styles.statsCard}>
                <div className={styles.statItem}>
                  <span className={styles.statNum}>{visibleNodes.length}</span>
                  <span className={styles.statLbl}>nodos</span>
                </div>
                <span className={styles.statSep} />
                <div className={styles.statItem}>
                  <span className={styles.statNum}>{visibleLinks.length}</span>
                  <span className={styles.statLbl}>conexiones</span>
                </div>
                {collections.length > 1 && (
                  <>
                    <span className={styles.statSep} />
                    <div className={styles.statItem}>
                      <span className={styles.statNum}>{collections.length - 1}</span>
                      <span className={styles.statLbl}>colecciones</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Filter - solo mostrar si hay datos */}
            {!isEmpty && !activeNode && (
              <div className={styles.filterWrap}>
                <button
                  className={`${styles.toolBtn} ${filterOpen ? styles.toolBtnActive : ''}`}
                  onClick={() => setFilterOpen(o => !o)}
                >
                  <Filter size={12} />
                  <span>{filterCollection === 'Todos' ? 'Colección' : filterCollection}</span>
                </button>
                {filterOpen && (
                  <div className={styles.filterDropdown}>
                    {collections.map(col => (
                      <button
                        key={col}
                        className={`${styles.filterOption} ${filterCollection === col ? styles.filterOptionActive : ''}`}
                        onClick={() => { setFilterCollection(col); setFilterOpen(false); setActiveNode(null); }}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Zoom controls - solo mostrar si hay datos */}
            {!isEmpty && (
              <div className={styles.zoomControls}>
                <button className={styles.zoomBtn} onClick={zoomIn}    title="Acercar"><ZoomIn size={14} /></button>
                <div className={styles.zoomDiv} />
                <button className={styles.zoomBtn} onClick={zoomOut}   title="Alejar"><ZoomOut size={14} /></button>
                <div className={styles.zoomDiv} />
                <button className={styles.zoomBtn} onClick={zoomReset} title="Restablecer"><RotateCcw size={12} /></button>
              </div>
            )}

            {/* Hint */}
            {!isEmpty && !activeNode && (
              <div className={styles.hint}>Arrastra · Scroll zoom · Clic para detalle</div>
            )}

            {/* Active node panel */}
            {activeNode && (
              <div className={styles.nodePanelWrap}>
                <div className={styles.nodePanel}>
                  <div className={styles.nodePanelHeader}>
                    <div className={styles.nodeDot} style={{ background: nodeColor(activeNode) }} />
                    <div className={styles.nodePanelInfo}>
                      <p className={styles.nodePanelType}>
                        {TYPE_LABELS[activeNode.tipo || activeNode.type] || activeNode.tipo || activeNode.type}
                      </p>
                      <h4 className={styles.nodePanelTitle}>
                        {activeNode.titulo || activeNode.label || activeNode.nombre || activeNode.id}
                      </h4>
                    </div>
                    <button className={styles.nodePanelClose} onClick={() => setActiveNode(null)}>×</button>
                  </div>
                  <div className={styles.nodePanelBody}>
                    {(activeNode.coleccion || activeNode.collection) && (
                      <div className={styles.nodeMeta}>
                        <span className={styles.nodeMetaKey}>Colección</span>
                        <span className={styles.nodeMetaVal}>{activeNode.coleccion || activeNode.collection}</span>
                      </div>
                    )}
                    <div className={styles.nodeMeta}>
                      <span className={styles.nodeMetaKey}>Conexiones</span>
                      <span className={styles.nodeMetaVal}>{activeConnections.length}</span>
                    </div>
                    {activeNode.tags?.length > 0 && (
                      <div className={styles.nodeTags}>
                        {activeNode.tags.slice(0, 4).map(t => (
                          <span key={t} className={styles.nodeTag}>{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Lista de conexiones */}
                    {activeConnections.length > 0 && (
                      <div className={styles.connList}>
                        <p className={styles.connListTitle}>Vínculos</p>
                        {activeConnections.map((conn, i) => (
                          <div key={`${conn.id}-${i}`} className={styles.connItem}>
                            <div className={styles.connItemLeft}>
                              <span
                                className={styles.connArrow}
                                title={conn.direction === 'out' ? 'Saliente' : 'Entrante'}
                              >
                                {conn.direction === 'out' ? '→' : '←'}
                              </span>
                              <span
                                className={styles.connDot}
                                style={{ background: TYPE_COLORS[conn.tipoNodo] || '#6B8AB8' }}
                              />
                            </div>
                            <div className={styles.connItemInfo}>
                              <span className={styles.connNombre}>{conn.nombre}</span>
                              <span className={styles.connTipo}>{conn.tipo}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Legend - solo mostrar si hay datos */}
        {!isEmpty && allNodeTypes.length > 0 && (
          <div className={styles.legend}>
            {allNodeTypes.map(type => (
              <div key={type} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: TYPE_COLORS[type] || '#6B8AB8' }} />
                <span className={styles.legendLabel}>{TYPE_LABELS[type] || type}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}