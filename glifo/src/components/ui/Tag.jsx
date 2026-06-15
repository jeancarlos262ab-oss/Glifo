import styles from './Tag.module.css';

export default function Tag({ children, color }) {
  return (
    <span className={styles.tag} style={color ? { '--tag-color': color } : {}}>
      {children}
    </span>
  );
}
