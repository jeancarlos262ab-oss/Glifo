export const features = [
  {
    id: 'ingesta',
    title: 'Ingesta Multimodal',
    description: 'PDF, imágenes escaneadas, audio en lenguas indígenas, testimonios y video. Un solo punto de entrada para cualquier tipo de archivo cultural.',
    tags: ['PDF', 'Imagen', 'Audio', 'Video'],
    color: '#4A9EE0',
  },
  {
    id: 'ia',
    title: 'IA 100% Local',
    description: 'OCR automático, descripción visual con llava, transcripción con Whisper y extracción de entidades con llama3.2. Sin costos de API, sin internet requerido.',
    tags: ['llama3.2', 'llava', 'Whisper', 'Spacy'],
    color: '#A07BE8',
  },
  {
    id: 'grafo',
    title: 'Grafo de Conocimiento',
    description: 'Cada pieza se conecta automáticamente con otras relacionadas. Un mural de 1975 aparece vinculado a documentos del 68 y piezas en museos suizos.',
    tags: ['Neo4j', 'NetworkX', 'pgvector'],
    color: '#3EC98E',
  },
  {
    id: 'busqueda',
    title: 'Búsqueda Semántica',
    description: 'Consultas en lenguaje natural, búsqueda por imagen similar, o preguntas directas sobre el acervo. El sistema entiende el significado, no solo palabras clave.',
    tags: ['Semántica', 'Multimodal', 'NLP'],
    color: '#E8A838',
  },
  {
    id: 'api',
    title: 'API Pública Abierta',
    description: 'Todos los datos y relaciones expuestos via REST y GraphQL. Investigadores, instituciones y desarrolladores pueden consumir el acervo libremente.',
    tags: ['REST', 'GraphQL', 'Abierto'],
    color: '#E85C78',
  },
  {
    id: 'deploy',
    title: 'Despliegue Institucional',
    description: 'Un solo comando con Docker Compose. Cualquier museo, archivo o universidad puede instalar Glifo en horas con recursos de servidor modestos.',
    tags: ['Docker', 'PostgreSQL', 'MinIO'],
    color: '#38C4B8',
  },
];

export const techStack = [
  {
    layer: 'Ingesta',
    color: 'var(--accent-primary)',
    tools: [
      { name: 'PyMuPDF', desc: 'Extracción de texto y páginas de PDFs' },
      { name: 'Ollama llava', desc: 'Descripción automática de imágenes' },
      { name: 'Whisper.cpp', desc: 'Transcripción local de audio y video' },
      { name: 'ffmpeg', desc: 'Extracción de frames y audio' },
    ],
  },
  {
    layer: 'IA y Procesamiento',
    color: 'var(--accent-secondary)',
    tools: [
      { name: 'llama3.2', desc: 'Clasificación, resumen, entidades' },
      { name: 'nomic-embed-text', desc: 'Embeddings semánticos' },
      { name: 'Pipeline async', desc: 'Procesamiento en background' },
      { name: 'Spacy ES', desc: 'NER en español' },
    ],
  },
  {
    layer: 'Almacenamiento',
    color: 'var(--accent-azul-claro)',
    tools: [
      { name: 'PostgreSQL', desc: 'Metadata estructurada y relaciones' },
      { name: 'pgvector', desc: 'Búsqueda semántica vectorial' },
      { name: 'Neo4j / NetworkX', desc: 'Grafo de conocimiento' },
      { name: 'MinIO', desc: 'Archivos originales' },
    ],
  },
  {
    layer: 'Presentación',
    color: 'var(--accent-dorado)',
    tools: [
      { name: 'FastAPI', desc: 'Backend REST y GraphQL' },
      { name: 'React + Tailwind', desc: 'Interfaz de usuario' },
      { name: 'D3.js / Cytoscape', desc: 'Visualización del grafo' },
      { name: 'Docker Compose', desc: 'Despliegue con un comando' },
    ],
  },
];

export const datasets = [
  {
    name: 'Acervo Audiovisual ARPA',
    description: '100+ obras de ficción, documental, animación y experimental de estudiantes BUAP desde 2017.',
    type: 'Video',
  },
  {
    name: 'Murales ARPA',
    description: 'Registro fotográfico de murales creados por la comunidad artística de la facultad.',
    type: 'Imagen',
  },
  {
    name: 'Archivo Histórico del 68',
    description: 'Documentos del Movimiento Estudiantil de 1968, disponibles para preservación y difusión digital.',
    type: 'Documento',
  },
  {
    name: 'Colecciones Etnográficas Suizas',
    description: 'Museum der Kulturen Basel, Musée d\'ethnographie de Neuchâtel, Museum Rietberg — acervo mesoamericano.',
    type: 'Colección',
  },
  {
    name: 'INAH — Monumentos Históricos',
    description: 'Registro nacional de monumentos históricos vía datos.gob.mx.',
    type: 'Patrimonio',
  },
  {
    name: 'Portal de Datos Puebla',
    description: 'Datos culturales del estado de Puebla, incluyendo catálogo de Museos Puebla.',
    type: 'Datos Abiertos',
  },
];

export const demoSteps = [
  {
    step: '01',
    title: 'Carga de pieza',
    description: 'Se sube una fotografía escaneada del Archivo del 68.',
  },
  {
    step: '02',
    title: 'Análisis con IA',
    description: 'La IA describe la imagen, identifica personas, lugares y contexto histórico en segundos.',
  },
  {
    step: '03',
    title: 'Grafo en vivo',
    description: 'El grafo se actualiza y conecta la foto con documentos y videos ARPA de la misma época.',
  },
  {
    step: '04',
    title: 'Lenguaje natural',
    description: '"¿Qué piezas hablan del movimiento estudiantil?" — el sistema responde con resultados de todos los formatos.',
  },
  {
    step: '05',
    title: 'API pública',
    description: 'Cualquier desarrollador consume el acervo con una petición HTTP en tiempo real.',
  },
];
