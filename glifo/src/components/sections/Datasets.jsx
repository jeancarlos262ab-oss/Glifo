import { datasets } from '../../data';
import SectionHeader from '../ui/SectionHeader';
import Tag from '../ui/Tag';
import { useInView } from '../../hooks/useInView';
import styles from './Datasets.module.css';

const typeColors = {
  Video: 'rgba(196,98,45,0.12)',
  Imagen: 'rgba(201,153,58,0.12)',
  Documento: 'rgba(44,95,138,0.12)',
  Colección: 'rgba(74,124,89,0.12)',
  Patrimonio: 'rgba(201,153,58,0.12)',
  'Datos Abiertos': 'rgba(74,124,89,0.12)',
};

const typeText = {
  Video: 'var(--accent-azul-claro)',
  Imagen: 'var(--accent-dorado)',
  Documento: 'var(--accent-primary)',
  Colección: 'var(--accent-primary)',
  Patrimonio: 'var(--accent-dorado)',
  'Datos Abiertos': 'var(--accent-primary)',
};

function DatasetCard({ dataset, index }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={`${styles.card} reveal reveal-delay-${(index % 3) + 1} ${inView ? 'visible' : ''}`}
    >
      <div className={styles.cardTop}>
        <span
          className={styles.type}
          style={{
            background: typeColors[dataset.type] || 'var(--accent-tag-bg)',
            color: typeText[dataset.type] || 'var(--accent-tag-text)',
          }}
        >
          {dataset.type}
        </span>
      </div>
      <h3 className={styles.name}>{dataset.name}</h3>
      <p className={styles.desc}>{dataset.description}</p>
    </div>
  );
}

export default function Datasets() {
  return (
    <section className="section section-b" id="datos">
      <div className="container">
        <SectionHeader
          label="Bases de Datos"
          title="Seis acervos reales, listos para ingestar"
          subtitle="Glifo no trabaja con datos inventados. Cada base de datos proviene de instituciones culturales reales con patrimonio documentado."
        />
        <div className={styles.grid}>
          {datasets.map((d, i) => (
            <DatasetCard key={d.name} dataset={d} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
