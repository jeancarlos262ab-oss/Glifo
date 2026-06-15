"""
Router de Búsqueda Semántica.

Endpoints:
  POST /buscar          → búsqueda por texto en lenguaje natural
  POST /buscar/imagen   → búsqueda por imagen (llava + semántica)
  GET  /buscar/stats    → estadísticas del índice
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel

from app.schemas.piece import ResultadoBusqueda
from app.services import search_service, storage_service
import uuid
import tempfile
from pathlib import Path

router = APIRouter(prefix="/buscar", tags=["Búsqueda"])


class QueryBusqueda(BaseModel):
    query: str
    top_k: int = 10
    tipo: Optional[str] = None
    coleccion: Optional[str] = None


class RespuestaBusqueda(BaseModel):
    query: str
    total: int
    resultados: list[ResultadoBusqueda]


# ── Búsqueda semántica por texto ─────────────────────────────────
@router.post("", response_model=RespuestaBusqueda)
async def buscar(body: QueryBusqueda):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="La query no puede estar vacía")

    resultados_raw = await search_service.buscar_semantico(
        query=body.query,
        top_k=body.top_k,
        tipo_filtro=body.tipo,
        coleccion_filtro=body.coleccion,
    )

    resultados = [ResultadoBusqueda(**r) for r in resultados_raw]
    return RespuestaBusqueda(
        query=body.query,
        total=len(resultados),
        resultados=resultados,
    )


# ── Búsqueda por imagen ───────────────────────────────────────────
@router.post("/imagen", response_model=RespuestaBusqueda)
async def buscar_por_imagen(
    imagen: UploadFile = File(...),
    top_k: int = Query(5, ge=1, le=20),
):
    """
    Sube una imagen → llava la describe → búsqueda semántica con esa descripción.
    """
    contenido = await imagen.read()
    valido, error = storage_service.validar_archivo(imagen.filename or "imagen.jpg", len(contenido))
    if not valido:
        raise HTTPException(status_code=400, detail=error)

    # Guardar temporalmente
    with tempfile.NamedTemporaryFile(
        suffix=Path(imagen.filename or "img.jpg").suffix,
        delete=False
    ) as tmp:
        tmp.write(contenido)
        ruta_tmp = tmp.name

    try:
        resultados_raw = await search_service.buscar_por_imagen(ruta_tmp, top_k=top_k)
    finally:
        Path(ruta_tmp).unlink(missing_ok=True)

    resultados = [ResultadoBusqueda(**r) for r in resultados_raw]
    return RespuestaBusqueda(
        query="[búsqueda por imagen]",
        total=len(resultados),
        resultados=resultados,
    )


# ── Estadísticas del índice ───────────────────────────────────────
@router.get("/stats")
async def estadisticas_busqueda():
    return search_service.estadisticas_indice()
