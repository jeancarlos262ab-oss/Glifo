"""
Router del Grafo de Conocimiento.

Endpoints:
  GET  /grafo                → datos completos (nodos + aristas) para D3.js
  GET  /grafo/stats          → estadísticas del grafo
  POST /grafo/sincronizar    → reconstruye el grafo desde piezas en DB (todas, sin paginación)
  GET  /{pieza_id}/vecinos   → piezas relacionadas con una pieza
  POST /{pieza_id}/conectar  → crear relación manual entre piezas
"""
from fastapi import APIRouter, HTTPException, Query, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.services import graph_service
from app.db.database import get_db

router = APIRouter(prefix="/grafo", tags=["Grafo de Conocimiento"])

BATCH_SIZE = 500   # piezas por lote al leer de la DB


class CrearRelacion(BaseModel):
    destino_id: str
    tipo: str = "relacionado"
    peso: float = 1.0


# ── Datos completos del grafo ─────────────────────────────────────
@router.get("")
async def obtener_grafo(db: AsyncSession = Depends(get_db)):
    """
    Retorna todos los nodos y aristas.
    Si el número de nodos del grafo no coincide con el total de piezas
    en la DB, sincroniza automáticamente desde la DB.
    Formato compatible con D3.js force-directed y Cytoscape.js.
    """
    from app.models.piece import Pieza

    datos = graph_service.datos_grafo_completo()

    # Auto-sincronizar si el grafo está desactualizado respecto a la DB.
    # No basta con comprobar total_nodos == 0: si grafo.json quedó en disco
    # de una sesión anterior (p. ej. cargas manuales), _grafo nunca está
    # vacío aunque el seed_opendata.py haya insertado piezas nuevas
    # directamente en la DB vía psycopg2 (sin pasar por el pipeline que
    # actualiza el grafo). Comparamos el conteo real de la DB contra el
    # número de nodos del grafo para detectar ese desfase.
    total_db = (await db.execute(select(func.count(Pieza.id)))).scalar_one()
    if total_db > 0 and datos["total_nodos"] != total_db:
        await _sincronizar_interno(db)
        datos = graph_service.datos_grafo_completo()

    return datos


# ── Estadísticas ──────────────────────────────────────────────────
@router.get("/stats")
async def estadisticas():
    return graph_service.estadisticas_grafo()


# ── Sincronizar grafo desde DB ────────────────────────────────────
@router.post("/sincronizar")
async def sincronizar_grafo(db: AsyncSession = Depends(get_db)):
    """
    Reconstruye el grafo de conocimiento desde TODAS las piezas en la DB.
    Resetea el grafo antes de reconstruir para evitar nodos huérfanos.
    Procesa en lotes de {BATCH_SIZE} para soportar 300+ piezas sin problema.
    """
    result = await _sincronizar_interno(db)
    return result


async def _sincronizar_interno(db: AsyncSession) -> dict:
    """Lógica compartida de sincronización (usada por obtener_grafo y sincronizar_grafo)."""
    from app.models.piece import Pieza

    # 1. Contar total
    total_q = await db.execute(select(func.count(Pieza.id)))
    total_piezas = total_q.scalar_one()

    # 2. Resetear grafo en memoria y en disco
    graph_service.resetear_grafo()

    # 3. Cargar TODAS las piezas en lotes y agregar nodos en batch
    offset = 0
    nodos_batch: list[tuple[str, dict]] = []
    piezas_meta: list[dict] = []

    while offset < total_piezas:
        result = await db.execute(
            select(Pieza)
            .order_by(Pieza.creado_en)
            .offset(offset)
            .limit(BATCH_SIZE)
        )
        piezas = result.scalars().all()
        if not piezas:
            break

        for pieza in piezas:
            entidades = pieza.entidades if isinstance(pieza.entidades, dict) else {}
            tags = pieza.tags or []

            nodos_batch.append((pieza.id, {
                "titulo": pieza.titulo,
                "tipo": pieza.tipo.value if hasattr(pieza.tipo, "value") else str(pieza.tipo),
                "coleccion": pieza.coleccion or "",
                "tags": tags,
                "entidades": entidades,
                "anio": pieza.anio,
            }))

            piezas_meta.append({
                "pieza_id": pieza.id,
                "entidades": entidades,
                "tags": tags,
            })

        offset += BATCH_SIZE

    # 4. Insertar todos los nodos de una vez
    graph_service.agregar_nodos_batch(nodos_batch)
    agregadas = len(nodos_batch)

    # 5. Construir todas las relaciones automáticas y guardar una sola vez
    relaciones = graph_service.construir_todas_relaciones_y_guardar(piezas_meta)

    stats = graph_service.estadisticas_grafo()
    return {
        "mensaje": f"Grafo sincronizado: {agregadas} nodos procesados",
        "nodos_agregados": agregadas,
        "relaciones_creadas": relaciones,
        "stats": stats,
    }


# ── Vecinos de una pieza ──────────────────────────────────────────
@router.get("/{pieza_id}/vecinos")
async def vecinos(
    pieza_id: str,
    profundidad: int = Query(2, ge=1, le=4),
):
    """Retorna piezas relacionadas con 'pieza_id' hasta N niveles."""
    relacionados = graph_service.encontrar_relacionados(pieza_id, profundidad=profundidad)
    return {
        "pieza_id": pieza_id,
        "profundidad": profundidad,
        "total": len(relacionados),
        "relacionados": relacionados,
    }


# ── Crear relación manual ─────────────────────────────────────────
@router.post("/{pieza_id}/conectar")
async def conectar(pieza_id: str, body: CrearRelacion):
    graph_service.agregar_relacion(pieza_id, body.destino_id, body.tipo, body.peso)
    return {
        "mensaje": "Relación creada",
        "origen": pieza_id,
        "destino": body.destino_id,
        "tipo": body.tipo,
    }