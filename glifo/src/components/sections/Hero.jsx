import { ArrowDown } from 'lucide-react';
import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.gridBg} aria-hidden />
      <div className={styles.gradientBlob} aria-hidden />

      <img
        src="/logo.svg"
        alt=""
        className={styles.escudo}
        aria-hidden="true"
      />

      <div className={`container ${styles.content}`}>

        <h1 className={styles.headline}>
          <span className={styles.headlineAccent}>Memoria viva</span>
          <br />
          del patrimonio
          <br />
          <span className={styles.headlineLight}>cultural mexicano</span>
        </h1>

        <p className={styles.subtitle}>
          Glifo procesa, conecta y abre cualquier acervo cultural mediante inteligencia
          artificial que corre completamente en local — sin costos de API, sin dependencia
          de internet.
        </p>

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>$0.00</span>
            <span className={styles.statLabel}>Costo de API</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>100%</span>
            <span className={styles.statLabel}>Local y privado</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>6+</span>
            <span className={styles.statLabel}>Acervos integrados</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>4</span>
            <span className={styles.statLabel}>Formatos de ingesta</span>
          </div>
        </div>

        <div className={styles.cta}>
          <a href="#funcionalidades" className={styles.ctaPrimary}>
            Ver funcionalidades
          </a>
          <a href="#demo" className={styles.ctaSecondary}>
            Ver demo
          </a>
        </div>
      </div>

      <a href="#funcionalidades" className={styles.scrollIndicator} aria-label="Bajar">
        <ArrowDown size={16} />
      </a>

      {/* Columna derecha: tipografía BUAP + floating cards */}
      <div className={styles.rightCol} aria-hidden>

        {/* Tipografía atlética encima de los cards */}
        <div className={styles.buapType}>
          <div className={styles.buapLine1}>
            <span className={styles.buapBenemérita}>Benemérita</span>
            <span className={styles.buapUniversidad}>Universidad</span>
          </div>
          <div className={styles.buapLine2}>
            <span className={styles.buapAutónoma}>Autónoma</span>
            <span className={styles.buapDe}>de</span>
            <span className={styles.buapPuebla}>Puebla</span>
          </div>
        </div>

        {/* Floating cards */}
        <div className={styles.floatingCards}>
          <div className={`${styles.floatCard} ${styles.floatCard1}`}>
            <span className={styles.floatLabel}>grafo activo</span>
            <span className={styles.floatValue}>1,247 conexiones</span>
          </div>
          <div className={`${styles.floatCard} ${styles.floatCard2}`}>
            <span className={styles.floatLabel}>piezas procesadas</span>
            <span className={styles.floatValue}>342 documentos</span>
          </div>
          <div className={`${styles.floatCard} ${styles.floatCard3}`}>
            <span className={styles.floatLabel}>modelos activos</span>
            <span className={styles.floatValue}>llama3.2 · llava · whisper</span>
          </div>
        </div>

      </div>
    </section>
  );
}
