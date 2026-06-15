import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import styles from './Auth.module.css';

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function Auth({ initialMode = 'login', onSuccess, onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    nombre: '', apellido: '', institucion: '',
    email: '', password: '', confirm: '', terms: false,
  });

  const isLogin = mode === 'login';

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
    setError('');
  };

  const handleSubmit = async () => {
    setError('');

    if (!form.email || !form.password) {
      setError('Completa todos los campos requeridos.');
      return;
    }

    if (!isLogin) {
      if (!form.nombre || !form.apellido) {
        setError('Ingresa tu nombre completo.');
        return;
      }
      if (form.password !== form.confirm) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (!form.terms) {
        setError('Debes aceptar los términos de uso.');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/health');
      if (!res.ok) throw new Error('Backend no disponible');
    } catch {
      console.warn('Backend no disponible — modo demo');
    }

    await new Promise(r => setTimeout(r, 600));
    setLoading(false);

    sessionStorage.setItem('glifo_user', JSON.stringify({
      nombre: isLogin ? (form.email.split('@')[0]) : `${form.nombre} ${form.apellido}`,
      email: form.email,
      institucion: isLogin ? 'BUAP' : (form.institucion || 'BUAP'),
      rol: 'Admin',
    }));

    onSuccess?.();
  };

  return (
    <div className={styles.root}>
      {/* Logo BUAP gigante al fondo */}
      <div className={styles.buapLogoContainer}>
        <img 
          src="/logo.svg" 
          alt="Escudo BUAP" 
          className={styles.buapLogo}
        />
      </div>

      <div className={styles.bgType} aria-hidden>
        <div className={styles.bgLeft}>
          <span className={styles.wordBenemerita}>Benemérita</span>
          <span className={styles.wordUniversidad}>Universidad</span>
          <span className={styles.wordAutonoma}>Autónoma</span>
          <span className={styles.wordDe}>de</span>
          <span className={styles.wordPuebla}>Puebla</span>
        </div>
        <div className={styles.bgRight}>
          <span className={styles.bgBUAP}>B U A P</span>
          <div className={styles.bgMaximaGroup}>
            <span className={styles.bgNuestra}>Nuestra</span>
            <span className={styles.bgMaxima}>MÁXIMA</span>
            <span className={styles.bgCasa}>Casa</span>
            <span className={styles.bgDeEstudios}>De</span>
            <span className={styles.bgEstudios}>Estudios</span>
          </div>
        </div>
      </div>

      <div className={styles.gridBg} aria-hidden />

      <a href="#" onClick={e => { e.preventDefault(); onBack?.(); }} className={styles.logoLink}>
        <span className={styles.logoGlyph}>G</span>
        <span className={styles.logoText}>lifo</span>
      </a>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <p className={styles.cardLabel}>
            {isLogin ? 'Acceso institucional' : 'Nueva cuenta'}
          </p>
          <h1 className={styles.cardTitle}>
            {isLogin ? 'Bienvenido de vuelta' : 'Únete a Glifo'}
          </h1>
          <p className={styles.cardSub}>
            {isLogin
              ? 'Accede al acervo cultural de tu institución'
              : 'Comienza a preservar patrimonio cultural hoy'}
          </p>
        </div>

        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${isLogin ? styles.toggleActive : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Iniciar sesión
          </button>
          <button
            className={`${styles.toggleBtn} ${!isLogin ? styles.toggleActive : ''}`}
            onClick={() => { setMode('signup'); setError(''); }}
          >
            Registrarse
          </button>
        </div>

        <div className={`${styles.form} ${!isLogin ? styles.formSignup : ''}`}>
          {!isLogin && (
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Nombre</label>
                <input type="text" className={styles.input} placeholder="Edgar" value={form.nombre} onChange={set('nombre')} autoComplete="given-name" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Apellido</label>
                <input type="text" className={styles.input} placeholder="Vázquez" value={form.apellido} onChange={set('apellido')} autoComplete="family-name" />
              </div>
            </div>
          )}

          {!isLogin && (
            <div className={styles.field}>
              <label className={styles.label}>Institución</label>
              <input type="text" className={styles.input} placeholder="BUAP, INAH, Museo de Antropología…" value={form.institucion} onChange={set('institucion')} />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Correo electrónico</label>
            <input
              type="email"
              className={styles.input}
              placeholder={isLogin ? 'tu@institución.edu.mx' : 'correo@institución.edu.mx'}
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Contraseña
              {isLogin && <a href="#" className={styles.forgotLink}>¿Olvidaste tu contraseña?</a>}
            </label>
            <div className={styles.inputWrap}>
              <input
                type={showPass ? 'text' : 'password'}
                className={`${styles.input} ${styles.inputPadded}`}
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className={styles.field}>
              <label className={styles.label}>Confirmar contraseña</label>
              <div className={styles.inputWrap}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className={`${styles.input} ${styles.inputPadded}`}
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={set('confirm')}
                  autoComplete="new-password"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {!isLogin && (
            <label className={styles.checkRow}>
              <input type="checkbox" className={styles.checkbox} checked={form.terms} onChange={set('terms')} />
              <span className={styles.checkText}>
                Acepto los <a href="#" className={styles.link}>términos de uso</a> y la{' '}
                <a href="#" className={styles.link}>política de privacidad</a>
              </span>
            </label>
          )}

          {error && <div className={styles.errorMsg}>{error}</div>}

          <div className={styles.submitRow}>
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <><Loader2 size={16} className={styles.spin} /> Verificando…</>
                : <>{isLogin ? 'Entrar al acervo' : 'Crear cuenta'}<ArrowRight size={16} /></>
              }
            </button>
          </div>

          <div className={styles.socialDivider}>
            <span className={styles.socialDividerLine} />
            <span className={styles.socialDividerText}>o continúa con</span>
            <span className={styles.socialDividerLine} />
          </div>

          <div className={styles.socialBtns}>
            <button
              type="button"
              className={styles.socialBtn}
              onClick={handleSubmit}
              aria-label="Continuar con Google"
              title="Continuar con Google"
            >
              <GoogleIcon />
              <span>Google</span>
            </button>
            <button
              type="button"
              className={styles.socialBtn}
              onClick={handleSubmit}
              aria-label="Continuar con GitHub"
              title="Continuar con GitHub"
            >
              <GithubIcon />
              <span>GitHub</span>
            </button>
          </div>
        </div>

        <p className={styles.switchText}>
          {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            className={styles.switchLink}
            onClick={() => { setMode(isLogin ? 'signup' : 'login'); setError(''); }}
          >
            {isLogin ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}