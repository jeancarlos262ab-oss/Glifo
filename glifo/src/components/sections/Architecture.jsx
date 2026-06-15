import { techStack } from '../../data';
import SectionHeader from '../ui/SectionHeader';
import { useInView } from '../../hooks/useInView';
import styles from './Architecture.module.css';

function LayerCard({ layer, index }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={`${styles.layer} reveal reveal-delay-${index + 1} ${inView ? 'visible' : ''}`}
    >
      <div className={styles.layerHeader}>
        <div className={styles.layerDot} style={{ background: layer.color }} />
        <span className={styles.layerName}>{layer.layer}</span>
      </div>
      <div className={styles.tools}>
        {layer.tools.map(tool => (
          <div key={tool.name} className={styles.tool}>
            <span className={styles.toolName}>{tool.name}</span>
            <span className={styles.toolDesc}>{tool.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Architecture() {
  return (
    <section className="section section-c" id="arquitectura">
      <div className="container">
        <SectionHeader
          label="Arquitectura Técnica"
          title="Cuatro capas, una plataforma coherente"
          subtitle="Cada capa tiene una responsabilidad específica. Juntas forman un sistema que puede desplegarse con un solo comando."
        />

        <div className={styles.stack}>
          {techStack.map((layer, i) => (
            <LayerCard key={layer.layer} layer={layer} index={i} />
          ))}
        </div>

        <ModelTable />
      </div>
    </section>
  );
}

const models = [
  { name: 'llama3.2', purpose: 'Clasificación, resumen, extracción de entidades', install: 'ollama pull llama3.2' },
  { name: 'llava', purpose: 'Descripción automática de imágenes', install: 'ollama pull llava' },
  { name: 'nomic-embed-text', purpose: 'Embeddings para búsqueda semántica', install: 'ollama pull nomic-embed-text' },
  { name: 'Whisper.cpp', purpose: 'Transcripción de audio y video', install: 'Compilación local (MIT)' },
  { name: 'Spacy ES', purpose: 'NLP en español, reconocimiento de entidades', install: 'pip install spacy es_core_news_lg' },
];

function ModelTable() {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} className={`${styles.modelSection} reveal ${inView ? 'visible' : ''}`}>
      <p className="section-label" style={{ marginBottom: '20px' }}>Modelos de IA — 100% Local</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Propósito</th>
              <th>Instalación</th>
            </tr>
          </thead>
          <tbody>
            {models.map(m => (
              <tr key={m.name}>
                <td className={styles.modelName}>{m.name}</td>
                <td className={styles.modelPurpose}>{m.purpose}</td>
                <td><code className={styles.code}>{m.install}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.costBadge}>
        Costo total de API: <strong>$0.00</strong> &nbsp;·&nbsp; Sin límites de uso &nbsp;·&nbsp; Funciona sin internet &nbsp;·&nbsp; Datos privados y seguros
      </div>
    </div>
  );
}
