import { useState, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Filter } from 'lucide-react';
import SectionHeader from '../ui/SectionHeader';
import NodePanel from '../ui/NodePanel';
import { nodeTypeConfig, collections, graphData } from '../../data/graphData';
import { useInView } from '../../hooks/useInView';
import styles from './KnowledgeGraph.module.css';

// GraphCanvas contiene D3 (~60 kB) — se importa dinámicamente y solo
// se monta cuando la sección llega al viewport.
import { lazy, Suspense } from 'react';
const GraphCanvas = lazy(() => import('../ui/GraphCanvas'));

export default function KnowledgeGraph() {
  const [filterCollection, setFilterCollection] = useState('Todos');
  const [activeNode, setActiveNode] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // rootMargin positivo: empieza a cargar D3 cuando la sección esté a
  // 300 px de entrar al viewport (prefetch suave)
  const [sectionRef, sectionInView] = useInView({ rootMargin: '300px 0px 0px 0px' });
  const [revealRef, revealInView] = useInView();
  const canvasRef = useRef(null);

  const handleNodeClick = useCallback((node) => setActiveNode(node), []);

  const nodeCount = filterCollection === 'Todos'
    ? graphData.nodes.length
    : graphData.nodes.filter(n => n.collection === filterCollection).length;

  const linkCount = filterCollection === 'Todos'
    ? graphData.links.length
    : graphData.links.filter(l => {
        const ids = new Set(graphData.nodes.filter(n => n.collection === filterCollection).map(n => n.id));
        return ids.has(l.source?.id ?? l.source) && ids.has(l.target?.id ?? l.target);
      }).length;

  return (
    <section className="section section-b" id="grafo" ref={sectionRef}>
      <div className="container">
        <SectionHeader
          label="Grafo de Conocimiento"
          title="Conexiones vivas entre el patrimonio"
          subtitle="Cada pieza ingestada se relaciona automáticamente con otras mediante entidades, épocas, estilos e instituciones. Haz clic en cualquier nodo para explorar sus conexiones."
        />

        <div
          ref={revealRef}
          className={`${styles.graphWrapper} reveal ${revealInView ? 'visible' : ''}`}
        >
          <div className={styles.canvasArea}>
            <div className={styles.canvas}>
              {/* D3 solo monta cuando la sección entra al viewport */}
              {sectionInView && (
                <Suspense fallback={null}>
                  <GraphCanvas
                    ref={canvasRef}
                    filterCollection={filterCollection}
                    onNodeClick={handleNodeClick}
                    activeNode={activeNode}
                  />
                </Suspense>
              )}

              {/* Filter — top right */}
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

              {/* Stats — top left */}
              <div className={styles.statsCard}>
                <div className={styles.statItem}>
                  <span className={styles.statNum}>{nodeCount}</span>
                  <span className={styles.statLbl}>piezas</span>
                </div>
                <span className={styles.statSep} />
                <div className={styles.statItem}>
                  <span className={styles.statNum}>{linkCount}</span>
                  <span className={styles.statLbl}>conexiones</span>
                </div>
              </div>

              {/* Zoom — bottom right */}
              <div className={styles.zoomControls}>
                <button className={styles.zoomBtn} onClick={() => canvasRef.current?.zoomIn()} title="Acercar"><ZoomIn size={14} /></button>
                <div className={styles.zoomDiv} />
                <button className={styles.zoomBtn} onClick={() => canvasRef.current?.zoomOut()} title="Alejar"><ZoomOut size={14} /></button>
                <div className={styles.zoomDiv} />
                <button className={styles.zoomBtn} onClick={() => canvasRef.current?.reset()} title="Restablecer"><RotateCcw size={12} /></button>
              </div>

              {!activeNode && <div className={styles.hint}>Arrastra · Scroll zoom · Clic para detalle</div>}

              {activeNode && (
                <div className={styles.nodePanelWrap}>
                  <NodePanel node={activeNode} onClose={() => setActiveNode(null)} />
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            {Object.entries(nodeTypeConfig).map(([type, cfg]) => (
              <div key={type} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: cfg.color }} />
                <span className={styles.legendLabel}>{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
