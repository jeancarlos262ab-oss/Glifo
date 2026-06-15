"""
Router de IA — estado de los modelos Ollama, Whisper y utilidades de debug.

Endpoints:
  GET  /ai/status          → estado de todos los modelos y backends
  POST /ai/test/embed      → probar generación de embedding
  POST /ai/test/classify   → probar clasificación de texto
  POST /ai/test/entities   → probar extracción de entidades
  GET  /ai/backends        → qué backends de audio/video están disponibles
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import ollama_service
from app.services.whisper_service import backends_disponibles

router = APIRouter(prefix="/ai", tags=["IA / Modelos"])


class TextoInput(BaseModel):
    texto: str
    titulo: str = ""


@router.get("/status")
async def estado_ia():
    ollama_ok = await ollama_service.check_ollama()
    modelos = await ollama_service.list_models() if ollama_ok else []

    from app.core.config import get_settings
    settings = get_settings()

    def modelo_disponible(nombre: str) -> bool:
        return any(nombre in m for m in modelos)

    backends = backends_disponibles()

    return {
        "ollama_activo": ollama_ok,
        "ollama_url": settings.ollama_base_url,
        "modelos_instalados": modelos,
        "modelos_requeridos": {
            settings.ollama_llm_model: {
                "disponible": modelo_disponible(settings.ollama_llm_model),
                "uso": "Clasificación, resumen, extracción de entidades",
                "instalar": f"ollama pull {settings.ollama_llm_model}",
            },
            settings.ollama_vision_model: {
                "disponible": modelo_disponible(settings.ollama_vision_model),
                "uso": "Descripción de imágenes",
                "instalar": f"ollama pull {settings.ollama_vision_model}",
            },
            settings.ollama_embed_model: {
                "disponible": modelo_disponible(settings.ollama_embed_model),
                "uso": "Embeddings semánticos (768 dims)",
                "instalar": f"ollama pull {settings.ollama_embed_model}",
            },
        },
        "audio_video": backends,
        "costo_total_api": "$0.00",
        "modo": "100% local, sin internet",
    }


@router.get("/backends")
async def backends():
    return backends_disponibles()


@router.post("/test/embed")
async def test_embed(body: TextoInput):
    if not await ollama_service.check_ollama():
        raise HTTPException(503, detail="Ollama no disponible. Ejecuta: ollama serve")
    vector = await ollama_service.embed_texto(body.texto)
    return {
        "texto": body.texto[:100],
        "dimension": len(vector),
        "preview": vector[:5],
        "norma": round(sum(x**2 for x in vector) ** 0.5, 4),
    }


@router.post("/test/classify")
async def test_classify(body: TextoInput):
    if not await ollama_service.check_ollama():
        raise HTTPException(503, detail="Ollama no disponible")
    return await ollama_service.clasificar_pieza(body.titulo, body.texto)


@router.post("/test/entities")
async def test_entities(body: TextoInput):
    if not await ollama_service.check_ollama():
        raise HTTPException(503, detail="Ollama no disponible")
    return await ollama_service.extraer_entidades(body.texto)
