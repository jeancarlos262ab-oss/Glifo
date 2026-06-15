import { workPlan } from '../../data';
import SectionHeader from '../ui/SectionHeader';
import { useInView } from '../../hooks/useInView';
import styles from './WorkPlan.module.css';

const phaseColors = {
  'Setup': 'var(--accent-primary)',
  'Backend Core': 'var(--accent-primary)',
  'IA Pipeline': 'var(--accent-azul-claro)',
  'Grafo + Búsqueda': 'var(--accent-dorado)',
  'Frontend': 'var(--accent-primary)',
  'Integración': 'var(--accent-primary)',
  'Grafo Visual': 'var(--accent-dorado)',
  'Datos Reales': 'var(--accent-azul-claro)',
  'Demo y Pulido': 'var(--accent-primary)',
};

const team = [
  { role: 'Dev 1 — Backend Lead', first: 'Pipeline ingesta + workers async + PostgreSQL', second: 'API pública REST + GraphQL + documentación' },
  { role: 'Dev 2 — IA Lead', first: 'Ollama + Whisper + llava + embeddings', second: 'Grafo de conocimiento + relaciones automáticas' },
  { role: 'Dev 3 — Frontend Lead', first: 'UI ingesta + buscador + visor de resultados', second: 'Visualización del grafo (D3.js / Cytoscape)' },
  { role: 'Dev 4 — DevOps/Demo', first: 'Docker Compose + entorno + datos de prueba', second: 'Demo pulida + presentación + README' },
];

function PlanRow({ item, index }) {
  const [ref, inView] = useInView();
  const color = phaseColors[item.phase] || 'var(--accent-primary)';

  return (
    <div
      ref={ref}
      className={`${styles.row} reveal reveal-delay-${(index % 4) + 1} ${inView ? 'visible' : ''}`}
    >
      <span className={styles.hours}>{item.hours}</span>
      <span className={styles.phase} style={{ color }}>
        {item.phase}
      </span>
      <span className={styles.activities}>{item.activities}</span>
    </div>
  );
}

export default function WorkPlan() {
  const [teamRef, teamInView] = useInView();

  return (
    <section className="section section-c" id="plan">
      <div className="container">
        <SectionHeader
          label="Plan de Trabajo"
          title="48 horas, nueve fases, un sistema funcional"
          subtitle="Cada fase tiene entregables claros. El equipo trabaja en paralelo para maximizar el avance."
        />

        <div className={styles.planGrid}>
          {workPlan.map((item, i) => (
            <PlanRow key={i} item={item} index={i} />
          ))}
        </div>

        <div
          ref={teamRef}
          className={`${styles.teamSection} reveal ${teamInView ? 'visible' : ''}`}
        >
          <p className="section-label" style={{ marginBottom: '20px' }}>División del Equipo</p>
          <div className={styles.teamGrid}>
            {team.map((member, i) => (
              <div key={i} className={styles.memberCard}>
                <h4 className={styles.memberRole}>{member.role}</h4>
                <div className={styles.period}>
                  <span className={styles.periodLabel}>Primeras 24h</span>
                  <span className={styles.periodText}>{member.first}</span>
                </div>
                <div className={styles.period}>
                  <span className={styles.periodLabel}>Segundas 24h</span>
                  <span className={styles.periodText}>{member.second}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
