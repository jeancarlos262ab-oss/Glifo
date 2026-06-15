import { useState, useEffect, useCallback } from 'react';
import {
  Sun, Moon, Bell, Shield, Database, User, Globe, ChevronRight,
  Loader2, CheckCircle2, XCircle, RefreshCw, Cpu
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { iaApi, healthApi } from '../../services/api';
import { useNotif } from '../../context/NotifContext';
import styles from './PanelSettings.module.css';

function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, description, children }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLeft}>
        <div className={styles.rowIcon}><Icon size={16} /></div>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>{label}</span>
          {description && <span className={styles.rowDesc}>{description}</span>}
        </div>
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

function ModelStatusBadge({ available }) {
  return available
    ? <span className={styles.badgeOk}><CheckCircle2 size={12} /> Activo</span>
    : <span className={styles.badgeErr}><XCircle size={12} /> No disponible</span>;
}

export default function PanelSettings() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { push } = useNotif();

  const [iaStatus, setIaStatus] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [loadingIa, setLoadingIa] = useState(true);
  const [notifProcessing, setNotifProcessing] = useState(true);
  const [notifQueue, setNotifQueue] = useState(true);
  const [notifModels, setNotifModels] = useState(false);

  const user = (() => {
    try { return JSON.parse(sessionStorage.getItem('glifo_user') || '{}'); }
    catch { return {}; }
  })();

  const loadIaStatus = useCallback(async () => {
    setLoadingIa(true);
    try {
      const [ia, h] = await Promise.all([
        iaApi.status().catch(() => null),
        healthApi.check().catch(() => null),
      ]);
      setIaStatus(ia);
      setHealthData(h);
    } catch (e) {
      push(`Error cargando estado de IA: ${e.message}`, 'error');
    } finally {
      setLoadingIa(false);
    }
  }, []);

  useEffect(() => { loadIaStatus(); }, [loadIaStatus]);

  const modelos = iaStatus?.modelos_requeridos ?? {};
  const ollamaOk = iaStatus?.ollama_activo ?? false;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Sistema</span>
        <h1 className={styles.headerTitle}>Configuración</h1>
        <p className={styles.headerSub}>Personaliza tu experiencia en Glifo</p>
      </div>

      {/* Apariencia */}
      <Section title="Apariencia">
        <div className={styles.themeCards}>
          <button
            className={`${styles.themeCard} ${!isDark ? styles.themeCardActive : ''}`}
            onClick={() => isDark && toggleTheme()}
          >
            <div className={`${styles.themePreview} ${styles.themePreviewLight}`}>
              <div className={styles.previewBar} />
              <div className={styles.previewContent}>
                <div className={styles.previewLine} />
                <div className={styles.previewLine} style={{ width: '60%' }} />
              </div>
            </div>
            <div className={styles.themeCardLabel}>
              <Sun size={14} />
              <span>Claro</span>
              {!isDark && <span className={styles.themeCardBadge}>activo</span>}
            </div>
          </button>

          <button
            className={`${styles.themeCard} ${isDark ? styles.themeCardActive : ''}`}
            onClick={() => !isDark && toggleTheme()}
          >
            <div className={`${styles.themePreview} ${styles.themePreviewDark}`}>
              <div className={`${styles.previewBar} ${styles.previewBarDark}`} />
              <div className={styles.previewContent}>
                <div className={`${styles.previewLine} ${styles.previewLineDark}`} />
                <div className={`${styles.previewLine} ${styles.previewLineDark}`} style={{ width: '60%' }} />
              </div>
            </div>
            <div className={styles.themeCardLabel}>
              <Moon size={14} />
              <span>Oscuro</span>
              {isDark && <span className={styles.themeCardBadge}>activo</span>}
            </div>
          </button>
        </div>

        <SettingRow
          icon={isDark ? Moon : Sun}
          label="Tema actual"
          description={isDark ? 'Modo oscuro activado' : 'Modo claro activado'}
        >
          <button className={styles.toggleThemeBtn} onClick={toggleTheme}>
            {isDark ? 'Cambiar a claro' : 'Cambiar a oscuro'}
          </button>
        </SettingRow>
      </Section>

      {/* Notificaciones */}
      <Section title="Notificaciones">
        <SettingRow icon={Bell} label="Notificaciones del sistema" description="Alertas de ingesta y procesamiento">
          <Toggle checked={notifProcessing} onChange={setNotifProcessing} />
        </SettingRow>
        <SettingRow icon={Bell} label="Cola de procesamiento" description="Avisar cuando los modelos terminen">
          <Toggle checked={notifQueue} onChange={setNotifQueue} />
        </SettingRow>
        <SettingRow icon={Globe} label="Actualizaciones de modelos" description="Nuevas versiones de Ollama disponibles">
          <Toggle checked={notifModels} onChange={setNotifModels} />
        </SettingRow>
      </Section>

      {/* Modelos de IA */}
      <Section title="Modelos de IA">
        <div className={styles.iaHeader}>
          <div className={styles.iaStatus}>
            <span className={`${styles.iaDot} ${ollamaOk ? styles.iaDotOk : styles.iaDotErr}`} />
            <span className={styles.iaStatusText}>
              Ollama — {ollamaOk ? 'activo' : 'no disponible'}
            </span>
            {iaStatus?.ollama_url && (
              <span className={styles.iaUrl}>{iaStatus.ollama_url}</span>
            )}
          </div>
          <button className={styles.iaRefreshBtn} onClick={loadIaStatus} disabled={loadingIa}>
            {loadingIa
              ? <Loader2 size={13} className={styles.spin} />
              : <RefreshCw size={13} />
            }
          </button>
        </div>

        {loadingIa ? (
          <div className={styles.loadingRow}>
            <Loader2 size={16} className={styles.spin} />
            <span>Verificando modelos…</span>
          </div>
        ) : Object.keys(modelos).length === 0 ? (
          <div className={styles.iaOffline}>
            Ollama no está disponible. Ejecuta: <code>ollama serve</code>
          </div>
        ) : (
          Object.entries(modelos).map(([nombre, info]) => (
            <SettingRow
              key={nombre}
              icon={Cpu}
              label={nombre}
              description={info.uso}
            >
              <ModelStatusBadge available={info.disponible} />
            </SettingRow>
          ))
        )}

        {iaStatus?.audio_video && (
          <SettingRow icon={Database} label="Backends de audio/video" description="Disponibles para transcripción">
            <span className={styles.backendsText}>
              {Object.entries(iaStatus.audio_video)
                .filter(([, ok]) => ok)
                .map(([k]) => k)
                .join(', ') || 'ninguno'}
            </span>
          </SettingRow>
        )}

        <SettingRow icon={Globe} label="Costo total de API" description="Sin dependencias de nube">
          <span className={styles.costBadge}>$0.00</span>
        </SettingRow>
      </Section>

      {/* Health del sistema */}
      {healthData && (
        <Section title="Estado del sistema">
          <SettingRow icon={Database} label="Nodos en grafo" description="Relaciones cargadas en memoria">
            <span className={styles.statVal}>{healthData.grafo?.nodos ?? '—'}</span>
          </SettingRow>
          <SettingRow icon={Database} label="Aristas en grafo" description="Conexiones entre piezas">
            <span className={styles.statVal}>{healthData.grafo?.aristas ?? '—'}</span>
          </SettingRow>
          <SettingRow icon={Database} label="Piezas en índice semántico" description="Embeddings vectoriales indexados">
            <span className={styles.statVal}>{healthData.indice?.piezas_indexadas ?? '—'}</span>
          </SettingRow>
        </Section>
      )}

      {/* Cuenta */}
      <Section title="Cuenta">
        <SettingRow
          icon={User}
          label={user.nombre || 'Usuario'}
          description={`${user.rol || 'Admin'} · ${user.institucion || 'BUAP'} — ${user.email || ''}`}
        >
          <button className={styles.linkBtn}>Editar perfil</button>
        </SettingRow>
        <SettingRow icon={Shield} label="Seguridad" description="Contraseña y autenticación de dos factores">
          <button className={styles.linkBtn}>Gestionar</button>
        </SettingRow>
      </Section>

      <div className={styles.about}>
        <span className={styles.aboutLine}>Glifo · v1.0.0 · Hackatón ARPA · BUAP 2026</span>
        <span className={styles.aboutLine}>Desarrollado en la BUAP · Puebla, México</span>
        <span className={styles.aboutLine}>Ejecutándose 100% en local · Sin dependencias de nube</span>
      </div>
    </div>
  );
}
