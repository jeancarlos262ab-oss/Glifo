import SectionHeader from '../ui/SectionHeader';
import { useInView } from '../../hooks/useInView';
import styles from './Demo.module.css';

export default function Demo() {
  const [ref, inView] = useInView();

  return (
    <section className="section section-a" id="demo">
      <div className="container">
        <SectionHeader
          label="Demostración"
          title="Sistema funcional, datos reales."
          subtitle="No slides. No mockups. Un flujo de demostración con acervos reales del patrimonio cultural."
        />

        <div
          ref={ref}
          className={`${styles.demoBox} reveal ${inView ? 'visible' : ''}`}
        >
          <div className={styles.terminal}>
            <div className={styles.terminalBar}>
              <span className={styles.dot} style={{ background: '#003D7C' }} />
              <span className={styles.dot} style={{ background: '#1A5EA8' }} />
              <span className={styles.dot} style={{ background: '#2E7DD1' }} />
              <span className={styles.terminalTitle}>glifo — demo en vivo</span>
            </div>
            <div className={styles.terminalBody}>
              <p><span className={styles.prompt}>$</span> docker compose up</p>
              <p className={styles.comment}># Iniciando servicios...</p>
              <p className={styles.success}>✓ PostgreSQL + pgvector listo</p>
              <p className={styles.success}>✓ Neo4j iniciado</p>
              <p className={styles.success}>✓ Ollama cargando llama3.2...</p>
              <p className={styles.success}>✓ FastAPI corriendo en :8000</p>
              <p className={styles.success}>✓ Frontend en :5173</p>
              <p><span className={styles.prompt}>$</span> <span className={styles.cursor}>_</span></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
