import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.left}>
          <span className={styles.logoGlyph}>G</span>
          <span className={styles.logoText}>lifo</span>
          <span className={styles.sep}>/</span>
          <span className={styles.tagline}>Plataforma de Preservación Activa del Patrimonio Cultural</span>
        </div>
        <div className={styles.right}>
          <span className={styles.event}>BUAP · Benemérita Universidad Autónoma de Puebla</span>
          <a href="mailto:vm202379434@alm.buap.mx" className={styles.email}>
            vm202379434@alm.buap.mx
          </a>
        </div>
      </div>
      <div className={`container ${styles.bottom}`}>
        <span>Edgar Vazquez Mora</span>
        <span className={styles.cost}>Costo total de API: $0.00</span>
      </div>
    </footer>
  );
}
