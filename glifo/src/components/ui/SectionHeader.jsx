import { useInView } from '../../hooks/useInView';
import styles from './SectionHeader.module.css';

export default function SectionHeader({ label, title, subtitle, align = 'left' }) {
  const [ref, inView] = useInView();

  return (
    <div
      ref={ref}
      className={`${styles.header} ${styles[align]} reveal ${inView ? 'visible' : ''}`}
    >
      {label && <p className="section-label">{label}</p>}
      <h2 className={styles.title}>{title}</h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
