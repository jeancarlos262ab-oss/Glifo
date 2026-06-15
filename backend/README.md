# ■■ Glifo — Backend

**Plataforma de Preservación Activa del Patrimonio Cultural**  
HackatónARPA · BUAP 2026 · Dev 1 + Dev 2

---

## Arquitectura

```
glifo-backend/
├── app/
│   ├── api/v1/
│   │   ├── pieces.py      # CRUD + upload de archivos
│   │   ├── search.py      # Búsqueda semántica y por imagen
│   │   ├── graph.py       # Grafo de conocimiento
│   │   ├── jobs.py        # Cola de procesamiento
│   │   ├── stats.py       # Dashboard / overview
│   │   └── ai.py          # Estado y test de modelos IA
│   ├── core/
│   │   └── config.py      # Configuración (pydantic-settings)
│   ├── db/
│   │   └── database.py    # Motor async SQLAlchemy
│   ├── models/
│   │   ├── piece.py       # Modelo Pieza (tabla piezas)
│   │   └── job.py         # Modelo Job (cola async)
│   ├── schemas/
│   │   ├── piece.py       # Schemas Pydantic entrada/salida
│   │   └── job.py         # Schemas Job
│   ├── services/
│   │   ├── ollama_service.py   # LLM + visión + embeddings
│   │   ├── pdf_service.py      # Extracción PDF con PyMuPDF
│   │   ├── graph_service.py    # Grafo NetworkX (persistido en JSON)
│   │   ├── search_service.py   # Búsqueda semántica vectorial
│   │   └── storage_service.py  # Almacenamiento de archivos
│   ├── workers/
│   │   └── pipeline.py    # Worker async — pipeline completo
│   └── main.py            # FastAPI app + lifespan
├── data/
│   ├── grafo.json         # Grafo persistido (auto-generado)
│   └── embeddings.json    # Índice vectorial (auto-generado)
├── uploads/               # Archivos originales
├── setup.sql              # Paso 1: usuario + base de datos (superusuario)
├── setup_schema.sql       # Paso 2: esquema + datos de demo (DB glifo)
├── setup.bat              # ← Windows: ejecuta los dos pasos automáticamente
├── setup.sh               # Linux/Mac: script asistido de instalación
├── .env                   # Configuración local
├── requirements.txt
└── run.py                 # Servidor de desarrollo
```

---

## Instalación rápida

### 1. Dependencias Python
```bash
pip install -r requirements.txt
```

### 2. PostgreSQL — setup de base de datos

**Windows** (doble clic o desde cmd en la carpeta del proyecto):
```bat
setup.bat
```

**Linux / Mac:**
```bash
psql -U postgres -f setup.sql
psql -U postgres -d glifo -f setup_schema.sql
# O con el script asistido (también instala Python y verifica Ollama):
bash setup.sh
```

Los scripts crean el usuario `glifo`, la base de datos `glifo`, todo el
esquema (ENUMs, tablas, índices, permisos) y cargan las 12 piezas de demo
del acervo ARPA. Solo hay que ejecutarlos una vez.
### 3. Ollama (modelos de IA)
```bash
# Instalar Ollama: https://ollama.ai
ollama serve

# En otra terminal, descargar modelos:
ollama pull llama3.2          # Clasificación, resumen, NER (~2 GB)
ollama pull llava              # Descripción de imágenes (~4 GB)
ollama pull nomic-embed-text   # Embeddings semánticos (~274 MB)
```

### 4. Iniciar el backend
```bash
python run.py
```

Abre http://localhost:8000/docs para la documentación interactiva.

---

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/piezas/upload` | **Subir archivo** (PDF/imagen/audio/video) |
| `GET`  | `/api/v1/piezas` | Listar piezas con filtros |
| `GET`  | `/api/v1/piezas/{id}` | Detalle de pieza |
| `POST` | `/api/v1/buscar` | **Búsqueda semántica** en lenguaje natural |
| `POST` | `/api/v1/buscar/imagen` | Búsqueda por imagen |
| `GET`  | `/api/v1/grafo` | Datos del grafo (D3.js / Cytoscape) |
| `GET`  | `/api/v1/grafo/{id}/vecinos` | Piezas relacionadas |
| `GET`  | `/api/v1/jobs/cola` | Estado de la cola de procesamiento |
| `GET`  | `/api/v1/stats/overview` | Stats del dashboard |
| `GET`  | `/api/v1/ai/status` | Estado de modelos Ollama |
| `GET`  | `/health` | Health check general |

---

## Pipeline de procesamiento (async)

Cuando subes un archivo, el sistema:

```
Archivo subido
    │
    ├─ PDF      → PyMuPDF (texto) → OCR con llava si escaneado
    ├─ Imagen   → llava (descripción visual)
    ├─ Audio    → Whisper.cpp (transcripción) [requiere compilar]
    └─ Video    → ffmpeg (frames) + Whisper (audio)
         │
         ├─ llama3.2  → clasificación + resumen + extracción de entidades
         ├─ nomic-embed-text → embedding vectorial
         └─ NetworkX  → actualización del grafo de conocimiento
```

**Costo total: $0.00** — todo corre 100% local con Ollama.

---

## Variables de entorno (.env)

```env
DATABASE_URL=postgresql+asyncpg://glifo:glifo@localhost:5432/glifo
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3.2
OLLAMA_VISION_MODEL=llava
OLLAMA_EMBED_MODEL=nomic-embed-text
CORS_ORIGINS=["http://localhost:5173"]
```

---

## Demo WOW (48h Hackathon)

```bash
# 1. Iniciar backend (datos de demo ya cargados por setup.sql)
python run.py

# 2. Hacer búsqueda semántica
curl -X POST http://localhost:8000/api/v1/buscar \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué piezas hablan del movimiento estudiantil?"}'

# 3. Ver el grafo de conocimiento
curl http://localhost:8000/api/v1/grafo

# 4. Subir una foto escaneada del 68
curl -X POST http://localhost:8000/api/v1/piezas/upload \
  -F "archivo=@foto_68.jpg" \
  -F "coleccion=Archivo del 68"
```

---

Edgar Vazquez Mora · vm202379434@alm.buap.mx
