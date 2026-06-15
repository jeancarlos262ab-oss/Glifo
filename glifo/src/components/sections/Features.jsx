import { FileText, Cpu, Share2, Search, Globe, Server } from 'lucide-react';
import { features } from '../../data';
import Tag from '../ui/Tag';
import SectionHeader from '../ui/SectionHeader';
import { useInView } from '../../hooks/useInView';
import styles from './Features.module.css';

const icons = {
  ingesta: FileText,
  ia: Cpu,
  grafo: Share2,
  busqueda: Search,
  api: Globe,
  deploy: Server,
};

function FeatureCard({ feature, index }) {
  const [ref, inView] = useInView();
  const Icon = icons[feature.id];

  return (
    <div
      ref={ref}
      className={`${styles.card} reveal reveal-delay-${(index % 3) + 1} ${inView ? 'visible' : ''}`}
    >
      <div
        className={styles.iconWrap}
        style={{
          '--ic': feature.color,
          background: `color-mix(in srgb, ${feature.color} 12%, transparent)`,
          color: feature.color,
        }}
      >
        {Icon && <Icon size={20} strokeWidth={1.5} />}
      </div>
      <h3 className={styles.cardTitle}>{feature.title}</h3>
      <p className={styles.cardDesc}>{feature.description}</p>
      <div className={styles.tags}>
        {feature.tags.map(tag => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
    </div>
  );
}

export default function Features() {
  return (
    <section className="section section-b" id="funcionalidades">
      <div className="container">
        <SectionHeader
          label="Funcionalidades"
          title="Todo lo que un acervo cultural necesita"
          subtitle="De la pieza cruda al conocimiento conectado, Glifo automatiza cada paso del proceso de preservación."
        />
        <div className={styles.grid}>
          {features.map((f, i) => (
            <FeatureCard key={f.id} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
