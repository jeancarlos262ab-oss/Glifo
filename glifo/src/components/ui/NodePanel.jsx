import { X, Calendar, Archive, Tag as TagIcon, Link } from 'lucide-react';
import { graphData, nodeTypeConfig } from '../../data/graphData';
import styles from './NodePanel.module.css';

export default function NodePanel({ node, onClose }) {
  if (!node) return null;

  const config = nodeTypeConfig[node.type] || {};

  // Find connected nodes
  const connections = graphData.links
    .filter(l => {
      const src = l.source?.id ?? l.source;
      const tgt = l.target?.id ?? l.target;
      return src === node.id || tgt === node.id;
    })
    .map(l => {
      const src = l.source?.id ?? l.source;
      const tgt = l.target?.id ?? l.target;
      const otherId = src === node.id ? tgt : src;
      const other = graphData.nodes.find(n => n.id === otherId);
      return { node: other, type: l.type, weight: l.weight };
    })
    .filter(c => c.node);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.typeTag} style={{ background: config.color + '22', color: config.color }}>
          {config.label}
        </div>
        <button className={styles.close} onClick={onClose} aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>

      <h3 className={styles.title}>{node.label}</h3>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <Calendar size={12} />
          <span>{node.year} {node.year < 1900 ? 'dC' : ''}</span>
        </div>
        <div className={styles.metaRow}>
          <Archive size={12} />
          <span>{node.collection}</span>
        </div>
        <div className={styles.metaRow}>
          <TagIcon size={12} />
          <span>{node.type}</span>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel}>
          <Link size={10} />
          {connections.length} conexiones
        </p>
        <div className={styles.connections}>
          {connections.map((c, i) => (
            <div key={i} className={styles.connection}>
              <div
                className={styles.connDot}
                style={{ background: nodeTypeConfig[c.node.type]?.color || '#888' }}
              />
              <div className={styles.connInfo}>
                <span className={styles.connName}>{c.node.label}</span>
                <span className={styles.connType}>{c.type}</span>
              </div>
              <div className={styles.connWeight}>
                {Array.from({ length: c.weight }).map((_, j) => (
                  <span key={j} className={styles.weightDot} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.idRow}>
        <span className={styles.idLabel}>id</span>
        <code className={styles.idValue}>{node.id}</code>
      </div>
    </div>
  );
}
