"""
Glifo — Backend Principal
Plataforma de Preservación Activa del Patrimonio Cultural
HackatónARPA · BUAP 2026
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import get_settings
from app.db.database import init_db
from app.api.v1 import api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
log = logging.getLogger("glifo")
settings = get_settings()


# ── Ciclo de vida ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("▶ Iniciando Glifo Backend...")

    try:
        await init_db()
        log.info("✓ Base de datos lista")
    except Exception as e:
        log.warning(f"⚠ Base de datos no disponible: {e}")
        log.warning("  Ejecuta: sudo -u postgres psql -f setup.sql  (o ajusta DATABASE_URL en .env)")

    for d in ["./uploads", "./data"]:
        Path(d).mkdir(parents=True, exist_ok=True)

    from app.services.ollama_service import check_ollama, list_models
    ollama_ok = await check_ollama()
    if ollama_ok:
        modelos = await list_models()
        log.info(f"✓ Ollama activo. Modelos: {modelos}")
    else:
        log.warning("⚠ Ollama no disponible. Inicia con: ollama serve")
        log.warning("  Luego: ollama pull llama3.2 && ollama pull llava && ollama pull nomic-embed-text")

    log.info(f"✓ Glifo listo en http://localhost:8000")
    log.info(f"  Docs: http://localhost:8000/docs")
    yield

    log.info("◾ Glifo detenido.")


# ── Aplicación ────────────────────────────────────────────────────
app = FastAPI(
    title="Glifo API",
    description=(
        "Plataforma de Preservación Activa del Patrimonio Cultural Mexicano. "
        "Procesamiento multimodal 100% local con IA (Ollama)."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rutas API ─────────────────────────────────────────────────────
app.include_router(api_router, prefix=settings.api_v1_prefix)

# ── Archivos estáticos (uploads) ──────────────────────────────────
app.mount("/uploads", StaticFiles(directory="./uploads"), name="uploads")


# ── Health check ─────────────────────────────────────────────────
@app.get("/health", tags=["Sistema"])
async def health():
    from app.services.ollama_service import check_ollama
    from app.services.graph_service import estadisticas_grafo
    from app.services.search_service import estadisticas_indice

    return {
        "status": "ok",
        "servicio": "Glifo Backend",
        "version": "1.0.0",
        "ollama": await check_ollama(),
        "grafo": estadisticas_grafo(),
        "indice": estadisticas_indice(),
    }


@app.get("/", tags=["Sistema"])
async def raiz():
    return {
        "nombre": "Glifo",
        "descripcion": "Plataforma de Preservación Activa del Patrimonio Cultural",
        "hackaton": "ARPA · BUAP 2026",
        "docs": "/docs",
        "api": "/api/v1",
        "costo_api": "$0.00",
    }