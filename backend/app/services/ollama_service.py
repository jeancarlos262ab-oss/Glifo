"""
Servicio Ollama — interfaz unificada con todos los modelos locales.

Modelos usados:
  - llama3.2      → clasificación, resumen, extracción de entidades
  - llava          → descripción de imágenes
  - nomic-embed-text → embeddings semánticos (768 dims)
"""
from __future__ import annotations
import base64
import json
import logging
from pathlib import Path
from typing import Optional
from deep_translator import GoogleTranslator
import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


async def _post(endpoint: str, payload: dict) -> dict:
    """Hace POST a Ollama y devuelve el JSON de respuesta."""
    url = f"{settings.ollama_base_url}{endpoint}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        return r.json()


# ── Verificar que Ollama está activo ─────────────────────────────
async def check_ollama() -> bool:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            r = await client.get(f"{settings.ollama_base_url}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def list_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            r = await client.get(f"{settings.ollama_base_url}/api/tags")
            data = r.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        return []


# ── Generación de embeddings ─────────────────────────────────────
async def embed_texto(texto: str) -> list[float]:
    """
    Genera embedding vectorial con nomic-embed-text.
    Retorna lista de 768 floats.
    """
    if not texto or not texto.strip():
        return [0.0] * settings.embedding_dim
    try:
        data = await _post("/api/embeddings", {
            "model": settings.ollama_embed_model,
            "prompt": texto[:8000],  # límite seguro
        })
        return data.get("embedding", [0.0] * settings.embedding_dim)
    except Exception as e:
        log.error(f"Error generando embedding: {e}")
        return [0.0] * settings.embedding_dim


# ── LLM general (llama3.2) ────────────────────────────────────────
async def completar(prompt: str, system: str = "") -> str:
    """Llamada básica al LLM. Retorna texto de respuesta."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        data = await _post("/api/chat", {
            "model": settings.ollama_llm_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 1024},
        })
        return data.get("message", {}).get("content", "")
    except Exception as e:
        log.error(f"Error en completar(): {e}")
        return ""


# ── Clasificación de tipo de pieza ───────────────────────────────
async def clasificar_pieza(titulo: str, texto: str) -> dict:
    """
    Clasifica una pieza y extrae metadata básica.
    Retorna: {tipo, coleccion_sugerida, anio, idioma, tags, resumen_breve}
    """
    prompt = f"""Analiza esta pieza cultural y responde SOLO con JSON válido, sin markdown.

Título: {titulo}
Texto (primeros 500 chars): {texto[:500]}

Responde con este JSON exacto:
{{
  "tipo": "documento|imagen|audio|video|objeto|patrimonio",
  "coleccion_sugerida": "nombre de la colección más apropiada",
  "anio": 1968,
  "idioma": "es|nahuatl|en|otro",
  "tags": ["tag1","tag2","tag3"],
  "resumen_breve": "Una oración describiendo la pieza"
}}"""

    respuesta = await completar(prompt)
    try:
        # Limpiar posibles backticks de markdown
        limpio = respuesta.strip().strip("```json").strip("```").strip()
        return json.loads(limpio)
    except Exception:
        return {"tipo": "documento", "tags": [], "resumen_breve": titulo}


# ── Extracción de entidades (NER con LLM) ─────────────────────────
async def extraer_entidades(texto: str) -> dict:
    """
    Extrae entidades nombradas del texto.
    Retorna: {personas, lugares, fechas, eventos, organizaciones}
    """
    if not texto or len(texto.strip()) < 50:
        return {"personas": [], "lugares": [], "fechas": [], "eventos": [], "organizaciones": []}

    prompt = f"""Extrae entidades nombradas del siguiente texto. Responde SOLO con JSON, sin explicaciones.

TEXTO:
{texto[:3000]}

Formato requerido:
{{
  "personas": ["nombre1", "nombre2"],
  "lugares": ["lugar1", "lugar2"],
  "fechas": ["fecha1", "fecha2"],
  "eventos": ["evento1", "evento2"],
  "organizaciones": ["org1", "org2"]
}}"""

    respuesta = await completar(prompt, system="Eres un extractor de entidades nombradas especializado en patrimonio cultural mexicano.")
    try:
        limpio = respuesta.strip().strip("```json").strip("```").strip()
        data = json.loads(limpio)
        # Normalizar: asegurar que todos los campos existen
        for campo in ["personas", "lugares", "fechas", "eventos", "organizaciones"]:
            if campo not in data or not isinstance(data[campo], list):
                data[campo] = []
        return data
    except Exception as e:
        log.warning(f"Error parseando entidades: {e}")
        return {"personas": [], "lugares": [], "fechas": [], "eventos": [], "organizaciones": []}


# ── Resumen inteligente ───────────────────────────────────────────
async def generar_resumen(texto: str, titulo: str = "") -> str:
    """Genera un resumen conciso de la pieza en español."""
    if not texto or len(texto.strip()) < 100:
        return titulo

    prompt = f"""Resume el siguiente texto cultural en 2-3 oraciones en español.
Título: {titulo}

TEXTO:
{texto[:4000]}

Responde SOLO con el resumen, sin introducción."""

    return await completar(prompt, system="Eres un archivista especializado en patrimonio cultural mexicano. Eres conciso y preciso.")


async def describir_imagen(ruta_imagen: str | Path, contexto: str = "video frame") -> str:
    """
    Usa llava para describir una imagen en inglés y traduce al español.
    """
    ruta = Path(ruta_imagen)
    if not ruta.exists():
        return "Imagen no encontrada"

    with open(ruta, "rb") as f:
        imagen_b64 = base64.b64encode(f.read()).decode()

    try:
        data = await _post("/api/chat", {
            "model": settings.ollama_vision_model,
            "messages": [{
                "role": "user",
                "content": (
                    f"This is a {contexto}. "
                    "Describe everything you see: people, places, objects, actions, colors, approximate era. "
                    "If there is visible text, transcribe it. "
                    "Ignore watermarks or overlays and describe the underlying visual content only."
                ),
                "images": [imagen_b64],
            }],
            "stream": False,
            "options": {"temperature": 0.1},
        })
        texto_en = data.get("message", {}).get("content", "")
        if not texto_en:
            return "Sin descripción disponible"

        # Traducir al español
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            texto_es = await loop.run_in_executor(
                None,
                lambda: GoogleTranslator(source="en", target="es").translate(texto_en)
            )
            return texto_es or texto_en
        except Exception as e:
            log.warning(f"Traducción fallida, usando inglés: {e}")
            return texto_en

    except Exception as e:
        log.error(f"Error describiendo imagen con llava: {e}")
        return "Error al procesar imagen con IA visual"


# ── Tags automáticos ──────────────────────────────────────────────
async def generar_tags(titulo: str, descripcion: str, entidades: dict) -> list[str]:
    """Genera tags relevantes combinando título, descripción y entidades."""
    contexto = f"Título: {titulo}\nDescripción: {descripcion[:300]}"
    entidades_texto = ", ".join(
        v for vals in entidades.values() for v in (vals if isinstance(vals, list) else [])
    )
    if entidades_texto:
        contexto += f"\nEntidades: {entidades_texto}"

    prompt = f"""Genera entre 3 y 8 tags relevantes para catalogar esta pieza cultural.
{contexto}

Responde SOLO con JSON: ["tag1", "tag2", "tag3"]
Los tags deben ser palabras clave en minúsculas, relevantes para búsqueda en patrimonio cultural."""

    respuesta = await completar(prompt)
    try:
        limpio = respuesta.strip().strip("```json").strip("```").strip()
        tags = json.loads(limpio)
        return [t.lower().strip() for t in tags if isinstance(t, str)][:8]
    except Exception:
        return []
