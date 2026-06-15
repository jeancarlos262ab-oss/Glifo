import { comparison } from '../../data';
import SectionHeader from '../ui/SectionHeader';
import { useInView } from '../../hooks/useInView';
import { Check, X } from 'lucide-react';
import styles from './Comparison.module.css';

export default function Comparison() {
  const [ref, inView] = useInView();

  return (
    <section className="section section-d" id="comparativo">
      <div className="container">
        <SectionHeader
          label="Por Qué Glifo Destaca"
          title="No es un catálogo. Es una plataforma inteligente."
          subtitle="Una comparación directa con el tipo de solución que típicamente se presenta en hackathons."
        />

        <div
          ref={ref}
          className={`${styles.tableWrap} reveal ${inView ? 'visible' : ''}`}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Criterio</th>
                <th className={styles.colOthers}>Otros equipos</th>
                <th className={styles.colGlifo}>
                  <span className={styles.glifoLabel}>Glifo</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={i}>
                  <td className={styles.criteria}>{row.criteria}</td>
                  <td className={styles.others}>
                    <span className={styles.xIcon}><X size={12} strokeWidth={2.5} /></span>
                    {row.others}
                  </td>
                  <td className={styles.glifo}>
                    <span className={styles.checkIcon}><Check size={12} strokeWidth={2.5} /></span>
                    {row.glifo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
