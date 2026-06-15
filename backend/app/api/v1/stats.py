"""
Router de Estadísticas y Colecciones — datos para el Dashboard Overview.

Endpoints:
  GET /stats/overview   → estadísticas generales (totales, estados, tipos)
  GET /stats/colecciones → lista de colecciones con conteos
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models.piece import Pieza, TipoPieza, EstadoProcesamiento
from app.services.graph_service import estadisticas_grafo
from app.services.search_service import estadisticas_indice

router = APIRouter(prefix="/stats", tags=["Estadísticas"])


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)):
    """
    Datos para el panel Overview del dashboard.
    Compatible con los stat cards del frontend.
    """
    # Total piezas
    total = (await db.execute(select(func.count(Pieza.id)))).scalar_one()

    # Por estado
    estados = {}
    for est in EstadoProcesamiento:
        cnt = (await db.execute(
            select(func.count(Pieza.id)).where(Pieza.estado == est)
        )).scalar_one()
        estados[est.value] = cnt

    # Por tipo
    tipos = {}
    for tipo in TipoPieza:
        cnt = (await db.execute(
            select(func.count(Pieza.id)).where(Pieza.tipo == tipo)
        )).scalar_one()
        tipos[tipo.value] = cnt

    # Piezas esta semana
    semana_pasada = datetime.now(timezone.utc) - timedelta(days=7)
    esta_semana = (await db.execute(
        select(func.count(Pieza.id)).where(Pieza.creado_en >= semana_pasada)
    )).scalar_one()

    # Piezas recientes
    recientes_q = await db.execute(
        select(Pieza).order_by(Pieza.creado_en.desc()).limit(6)
    )
    recientes = recientes_q.scalars().all()

    # Datos del grafo
    grafo = estadisticas_grafo()
    indice = estadisticas_indice()

    return {
        "total_piezas": total,
        "esta_semana": esta_semana,
        "estados": estados,
        "tipos": tipos,
        "costo_api": "$0.00",
        "grafo": grafo,
        "indice_semantico": indice,
        "piezas_recientes": [
            {
                "id": p.id,
                "titulo": p.titulo,
                "tipo": p.tipo.value,
                "coleccion": p.coleccion,
                "estado": p.estado.value,
                "progreso": p.progreso,
                "creado_en": p.creado_en.isoformat(),
            }
            for p in recientes
        ],
    }


@router.get("/colecciones")
async def colecciones(db: AsyncSession = Depends(get_db)):
    """Lista de colecciones con conteo de piezas."""
    result = await db.execute(
        select(Pieza.coleccion, func.count(Pieza.id).label("total"))
        .group_by(Pieza.coleccion)
        .order_by(func.count(Pieza.id).desc())
    )
    rows = result.all()
    total_global = sum(r.total for r in rows)

    colecciones_lista = []
    for row in rows:
        pct = round((row.total / total_global * 100) if total_global else 0)
        colecciones_lista.append({
            "nombre": row.coleccion,
            "total": row.total,
            "porcentaje": pct,
        })

    return {"colecciones": colecciones_lista, "total_global": total_global}
