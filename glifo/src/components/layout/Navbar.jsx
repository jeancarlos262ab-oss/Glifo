import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import styles from './Navbar.module.css';

const navLinks = [
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#ingesta',         label: 'Ingesta' },
  { href: '#buscador',        label: 'Buscador' },
  { href: '#grafo',           label: 'Grafo' },
  { href: '#api',             label: 'API' },
  { href: '#demo-flow',       label: 'Demo' },
];

export default function Navbar({ onLogin, onRegister }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const close = () => setOpen(false);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={`container ${styles.inner}`}>

        {/* Logo — izquierda */}
        <a href="#" className={styles.logo}>
          <span className={styles.logoGlyph}>G</span>
          <span className={styles.logoText}>lifo</span>
        </a>

        {/* Nav — centro */}
        <nav className={`${styles.nav} ${open ? styles.navOpen : ''}`}>
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={styles.navLink}
              onClick={close}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Auth buttons — siempre pegados a la derecha, grupo independiente */}
        <div className={styles.authGroup}>
          <button className={styles.registerBtn} onClick={onRegister}>
            Regístrate
          </button>
          <button className={styles.loginBtn} onClick={onLogin}>
            Iniciar sesión
          </button>
        </div>

        {/* Hamburger mobile */}
        <button
          className={styles.menuBtn}
          onClick={() => setOpen(o => !o)}
          aria-label="Menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

      </div>
    </header>
  );
}
