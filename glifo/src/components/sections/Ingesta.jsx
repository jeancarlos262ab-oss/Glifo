import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, Mic, Video, CheckCircle, Loader, ChevronRight } from 'lucide-react';
import SectionHeader from '../ui/SectionHeader';
import styles from './Ingesta.module.css';

const FILE_TYPES = [
  { id: 'pdf',   label: 'PDF / Documento', icon: FileText, accept: '.pdf,.txt,.doc' },
  { id: 'image', label: 'Imagen / Escaneo', icon: Image,    accept: 'image/*' },
  { id: 'audio', label: 'Audio / Testimonio', icon: Mic,   accept: 'audio/*' },
  { id: 'video', label: 'Video',             icon: Video,   accept: 'video/*' },
];

const PIPELINE_STEPS = {
  pdf: [
    { id: 'extract',   label: 'Extracción de texto',        tool: 'PyMuPDF',          duration: 900 },
    { id: 'ocr',       label: 'OCR de imágenes internas',   tool: 'Tesseract',        duration: 1400 },
    { id: 'entities',  label: 'Extracción de entidades',    tool: 'llama3.2 + Spacy', duration: 1800 },
    { id: 'embed',     label: 'Generación de embeddings',   tool: 'nomic-embed-text', duration: 700 },
    { id: 'graph',     label: 'Integración al grafo',       tool: 'Neo4j / NetworkX', duration: 600 },
  ],
  image: [
    { id: 'load',      label: 'Carga y preprocesamiento',   tool: 'PIL / OpenCV',     duration: 500 },
    { id: 'describe',  label: 'Descripción visual con IA',  tool: 'llava',            duration: 2200 },
    { id: 'entities',  label: 'Extracción de entidades',    tool: 'llama3.2',         duration: 1600 },
    { id: 'embed',     label: 'Generación de embeddings',   tool: 'nomic-embed-text', duration: 700 },
    { id: 'graph',     label: 'Integración al grafo',       tool: 'Neo4j / NetworkX', duration: 600 },
  ],
  audio: [
    { id: 'extract',   label: 'Extracción de audio',        tool: 'ffmpeg',           duration: 800 },
    { id: 'transcribe','label': 'Transcripción',            tool: 'Whisper.cpp',      duration: 3200 },
    { id: 'entities',  label: 'Extracción de entidades',    tool: 'llama3.2 + Spacy', duration: 1800 },
    { id: 'embed',     label: 'Generación de embeddings',   tool: 'nomic-embed-text', duration: 700 },
    { id: 'graph',     label: 'Integración al grafo',       tool: 'Neo4j / NetworkX', duration: 600 },
  ],
  video: [
    { id: 'frames',    label: 'Extracción de frames',       tool: 'ffmpeg',           duration: 1100 },
    { id: 'audio',     label: 'Extracción de audio',        tool: 'ffmpeg',           duration: 600 },
    { id: 'transcribe','label': 'Transcripción',            tool: 'Whisper.cpp',      duration: 3200 },
    { id: 'describe',  label: 'Descripción de frames clave', tool: 'llava',           duration: 2400 },
    { id: 'entities',  label: 'Extracción de entidades',    tool: 'llama3.2',         duration: 1800 },
    { id: 'embed',     label: 'Generación de embeddings',   tool: 'nomic-embed-text', duration: 700 },
    { id: 'graph',     label: 'Integración al grafo',       tool: 'Neo4j / NetworkX', duration: 600 },
  ],
};

const MOCK_RESULTS = {
  pdf: {
    title: 'Manifiesto_Estudiantil_1968.pdf',
    description: 'Documento histórico del movimiento estudiantil mexicano de 1968. Contiene las seis demandas principales del Consejo Nacional de Huelga dirigidas al Secretario de Gobernación Luis Echeverría.',
    entities: {
      personas: ['Heberto Castillo', 'Luis Echeverría', 'Eli de Gortari', 'CNH'],
      lugares: ['Ciudad de México', 'UNAM', 'IPN', 'Zócalo'],
      fechas: ['26 julio 1968', '1 agosto 1968', '2 octubre 1968'],
      temas: ['huelga general', 'pliego petitorio', 'diálogo público', 'represión'],
    },
    connections: 7,
    newConnections: ['Fotografía Tlatelolco', 'Testimonio Oral #12', 'Cortometraje Memoria Viva', 'Mural Resistencia'],
  },
  image: {
    title: 'fotografia_mural_1975.jpg',
    description: 'Fotografía de mural de gran formato en técnica mixta. Representa figuras humanas estilizadas con iconografía prehispánica en tonos terracota y ocre. Posible influencia siqueiriana. Condición: buena, algunas eflorescencias en esquina inferior derecha.',
    entities: {
      personas: ['Colectivo Tláloc'],
      lugares: ['Facultad de Artes BUAP', 'Puebla'],
      fechas: ['ca. 1975'],
      temas: ['muralismo', 'identidad poblana', 'iconografía prehispánica'],
    },
    connections: 5,
    newConnections: ['Mural Cosmovisión', 'Códice Mesoamericano Basel', 'Máscara Ritual Rietberg'],
  },
  audio: {
    title: 'testimonio_anonimo_1969.mp3',
    description: 'Testimonio oral de testigo presente en Tlatelolco el 2 de octubre de 1968. Narración en primera persona de los eventos desde las 17:00 hasta las 21:30 horas. Calidad de audio: media, con ruido de fondo.',
    entities: {
      personas: ['Testigo anónimo', 'soldados del Ejército'],
      lugares: ['Plaza de las Tres Culturas', 'Tlatelolco', 'Hospital Rubén Leñero'],
      fechas: ['2 octubre 1968', '1969'],
      temas: ['represión', 'testimonio directo', 'movimiento estudiantil'],
    },
    connections: 4,
    newConnections: ['Fotografía Tlatelolco', 'Manifiesto Estudiantil', 'Carta al Rector UNAM'],
  },
  video: {
    title: 'documental_raices_2021.mp4',
    description: 'Documental etnográfico sobre comunidades nahuas del municipio de Cuetzalan, Puebla. Incluye entrevistas en náhuatl clásico con subtítulos en español. 14 hablantes documentados, 3 ceremonias registradas.',
    entities: {
      personas: ['Comunidad de Cuetzalan', 'Doña María Xochitl'],
      lugares: ['Cuetzalan del Progreso', 'Sierra Norte de Puebla'],
      fechas: ['2021'],
      temas: ['náhuatl', 'lengua en riesgo', 'ritual agrícola', 'Tonantzin'],
    },
    connections: 6,
    newConnections: ['Documental Raíces Vivas', 'Archivo Etnográfico Neuchâtel', 'INAH — Lenguas Indígenas'],
  },
};

export default function Ingesta() {
  const [selectedType, setSelectedType] = useState('pdf');
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | processing | done
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const inputRef = useRef(null);

  const runPipeline = useCallback((fileObj) => {
    setFile(fileObj);
    setStage('processing');
    setCompletedSteps([]);
    const steps = PIPELINE_STEPS[selectedType];
    let delay = 0;
    steps.forEach((step, i) => {
      setTimeout(() => setCurrentStep(step.id), delay);
      delay += step.duration;
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, step.id]);
        if (i === steps.length - 1) {
          setTimeout(() => setStage('done'), 400);
        }
      }, delay);
    });
  }, [selectedType]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) runPipeline(f);
  }, [runPipeline]);

  const handleChange = (e) => {
    const f = e.target.files[0];
    if (f) runPipeline(f);
  };

  const reset = () => {
    setFile(null);
    setStage('idle');
    setCompletedSteps([]);
    setCurrentStep(null);
  };

  const steps = PIPELINE_STEPS[selectedType];
  const result = MOCK_RESULTS[selectedType];
  const TypeIcon = FILE_TYPES.find(t => t.id === selectedType)?.icon || FileText;

  return (
    <section className="section section-a" id="ingesta">
      <div className="container">
        <SectionHeader
          label="UI de Ingesta"
          title="Un punto de entrada para cualquier pieza"
          subtitle="Sube un documento, imagen, audio o video. La IA procesa automáticamente en local, sin APIs externas."
        />

        <div className={styles.wrapper}>
          {/* Type selector */}
          <div className={styles.typeSelector}>
            {FILE_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`${styles.typeBtn} ${selectedType === t.id ? styles.typeBtnActive : ''}`}
                  onClick={() => { setSelectedType(t.id); reset(); }}
                >
                  <Icon size={15} strokeWidth={1.5} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className={styles.body}>
            {/* Left: drop zone or pipeline */}
            <div className={styles.left}>
              {stage === 'idle' && (
                <div
                  className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={FILE_TYPES.find(t => t.id === selectedType)?.accept}
                    style={{ display: 'none' }}
                    onChange={handleChange}
                  />
                  <div className={styles.dropIcon}>
                    <Upload size={28} strokeWidth={1.2} />
                  </div>
                  <p className={styles.dropTitle}>Arrastra tu archivo aquí</p>
                  <p className={styles.dropSub}>o haz clic para seleccionar</p>
                  <div className={styles.dropDemo} onClick={(e) => { e.stopPropagation(); runPipeline({ name: 'demo_archivo.pdf', size: 204800 }); }}>
                    Usar archivo de demo
                  </div>
                </div>
              )}

              {(stage === 'processing' || stage === 'done') && (
                <div className={styles.pipeline}>
                  <div className={styles.pipelineHeader}>
                    <div className={styles.fileInfo}>
                      <TypeIcon size={14} strokeWidth={1.5} />
                      <span className={styles.fileName}>{file?.name || 'demo_archivo'}</span>
                      <span className={styles.fileSize}>
                        {file?.size ? `${(file.size / 1024).toFixed(0)} KB` : '200 KB'}
                      </span>
                    </div>
                    {stage === 'done' && (
                      <button className={styles.resetBtn} onClick={reset}>Nueva ingesta</button>
                    )}
                  </div>

                  <div className={styles.steps}>
                    {steps.map((step) => {
                      const done = completedSteps.includes(step.id);
                      const active = currentStep === step.id && !done;
                      return (
                        <div
                          key={step.id}
                          className={`${styles.step} ${done ? styles.stepDone : ''} ${active ? styles.stepActive : ''}`}
                        >
                          <div className={styles.stepIcon}>
                            {done
                              ? <CheckCircle size={14} strokeWidth={2} />
                              : active
                              ? <Loader size={14} className={styles.spin} />
                              : <span className={styles.stepDot} />
                            }
                          </div>
                          <div className={styles.stepContent}>
                            <span className={styles.stepLabel}>{step.label}</span>
                            <span className={styles.stepTool}>{step.tool}</span>
                          </div>
                          {active && (
                            <div className={styles.progressBar}>
                              <div className={styles.progressFill} style={{ animationDuration: `${step.duration}ms` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {stage === 'done' && (
                    <div className={styles.doneTag}>
                      <CheckCircle size={13} />
                      Procesado y agregado al grafo — {result.connections} conexiones encontradas
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: result preview */}
            <div className={`${styles.right} ${stage === 'done' ? styles.rightVisible : ''}`}>
              {stage !== 'done' ? (
                <div className={styles.previewPlaceholder}>
                  <p>El análisis aparecerá aquí una vez procesado el archivo</p>
                </div>
              ) : (
                <ResultCard result={result} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultCard({ result }) {
  return (
    <div className={styles.resultCard}>
      <p className={styles.resultTitle}>{result.title}</p>
      <p className={styles.resultDesc}>{result.description}</p>

      <div className={styles.entitiesGrid}>
        {Object.entries(result.entities).map(([key, vals]) => vals.length > 0 && (
          <div key={key} className={styles.entityGroup}>
            <span className={styles.entityLabel}>{key}</span>
            <div className={styles.entityTags}>
              {vals.map(v => <span key={v} className={styles.entityTag}>{v}</span>)}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.connections}>
        <span className={styles.connectionsLabel}>
          <ChevronRight size={11} /> Nuevas conexiones en el grafo
        </span>
        {result.newConnections.map(c => (
          <div key={c} className={styles.connectionItem}>
            <span className={styles.connectionDot} />
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}
