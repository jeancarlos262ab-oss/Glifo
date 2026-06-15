"""
Router de Piezas — CRUD completo + upload de archivos.

Endpoints:
  GET    /piezas               → listar con filtros y paginación
  GET    /piezas/{id}          → detalle de una pieza
  POST   /piezas               → crear pieza manual (sin archivo)
  POST   /piezas/upload        → subir archivo + crear pieza
  PATCH  /piezas/{id}          → actualizar metadata
  DELETE /piezas/{id}          → eliminar pieza
  POST   /piezas/{id}/reprocesar → re-ejecutar pipeline de IA
"""
from __future__ import annotations
import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.piece import Pieza, TipoPieza, EstadoProcesamiento
from app.schemas.piece import PiezaRead, PiezaCreate, PiezaUpdate, PiezaResumen, PaginatedPiezas
from app.services import storage_service
from app.workers.pipeline import encolar_job

router = APIRouter(prefix="/piezas", tags=["Piezas"])

BASE_URL = "http://localhost:8000"


def _archivo_url(pieza: Pieza) -> Optional[str]:
    """Construye la URL pública del archivo original.

    - Si archivo_ruta es una URL externa (http/https) la devuelve tal cual.
      Esto aplica a piezas cargadas desde APIs abiertas de museos (Met, AIC, CMA).
    - Si es una ruta local la construye relativa al servidor.
    """
    if not pieza.archivo_ruta:
        return None
    ruta = pieza.archivo_ruta.strip()
    # URL externa → devolver directo
    if ruta.startswith("http://") or ruta.startswith("https://"):
        return ruta
    # Ruta local → normalizar y construir URL del servidor
    ruta = ruta.replace("\\", "/")
    for prefix in ("./", "/"):
        if ruta.startswith(prefix):
            ruta = ruta[len(prefix):]
    return f"{BASE_URL}/{ruta}"


def _to_resumen(pieza: Pieza) -> PiezaResumen:
    data = PiezaResumen.model_validate(pieza)
    data.archivo_url = _archivo_url(pieza)
    return data


def _to_read(pieza: Pieza) -> PiezaRead:
    data = PiezaRead.model_validate(pieza)
    data.archivo_url = _archivo_url(pieza)
    return data


# ── Listar piezas con filtros ─────────────────────────────────────
@router.get("", response_model=PaginatedPiezas)
async def listar_piezas(
    tipo: Optional[TipoPieza] = None,
    coleccion: Optional[str] = None,
    estado: Optional[EstadoProcesamiento] = None,
    q: Optional[str] = Query(None, description="Búsqueda por título"),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filtros = []
    if tipo:
        filtros.append(Pieza.tipo == tipo)
    if coleccion:
        filtros.append(Pieza.coleccion.ilike(f"%{coleccion}%"))
    if estado:
        filtros.append(Pieza.estado == estado)
    if q:
        filtros.append(Pieza.titulo.ilike(f"%{q}%"))

    condicion = and_(*filtros) if filtros else True

    total_q = await db.execute(select(func.count(Pieza.id)).where(condicion))
    total = total_q.scalar_one()

    offset = (pagina - 1) * por_pagina
    result = await db.execute(
        select(Pieza).where(condicion)
        .order_by(Pieza.creado_en.desc())
        .offset(offset).limit(por_pagina)
    )
    piezas = result.scalars().all()

    return PaginatedPiezas(
        items=[_to_resumen(p) for p in piezas],
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
        paginas=math.ceil(total / por_pagina) if total else 0,
    )


# ── Detalle de una pieza ──────────────────────────────────────────
@router.get("/{pieza_id}", response_model=PiezaRead)
async def obtener_pieza(pieza_id: str, db: AsyncSession = Depends(get_db)):
    pieza = await db.get(Pieza, pieza_id)
    if not pieza:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    return _to_read(pieza)


# ── Upload de archivo ─────────────────────────────────────────────
@router.post("/upload", response_model=PiezaRead, status_code=status.HTTP_201_CREATED)
async def subir_archivo(
    archivo: UploadFile = File(...),
    titulo: str = Form(""),
    coleccion: str = Form("Sin colección"),
    db: AsyncSession = Depends(get_db),
):
    """
    Sube un archivo, crea la pieza y encola el procesamiento con IA.
    El procesamiento ocurre en background — la pieza se retorna inmediatamente
    con estado 'pendiente'.
    """
    contenido = await archivo.read()

    valido, error = storage_service.validar_archivo(archivo.filename or "", len(contenido))
    if not valido:
        raise HTTPException(status_code=400, detail=error)

    mimetype = storage_service.obtener_mimetype(archivo.filename or "")
    tipo_pieza = storage_service.detectar_tipo_pieza(mimetype)

    pieza_id = str(uuid.uuid4())
    titulo_final = titulo.strip() or (archivo.filename or "Sin título").rsplit(".", 1)[0]

    pieza = Pieza(
        id=pieza_id,
        titulo=titulo_final,
        tipo=TipoPieza(tipo_pieza),
        coleccion=coleccion,
        archivo_nombre=archivo.filename,
        archivo_mimetype=mimetype,
        archivo_tamano=len(contenido),
        estado=EstadoProcesamiento.pendiente,
        progreso=0,
    )
    db.add(pieza)
    await db.flush()

    ruta = await storage_service.guardar_archivo(contenido, pieza_id, archivo.filename or "archivo")
    pieza.archivo_ruta = str(ruta)

    await db.commit()
    await db.refresh(pieza)

    await encolar_job(pieza_id)

    return _to_read(pieza)


# ── Crear pieza manual ────────────────────────────────────────────
@router.post("", response_model=PiezaRead, status_code=status.HTTP_201_CREATED)
async def crear_pieza(data: PiezaCreate, db: AsyncSession = Depends(get_db)):
    pieza = Pieza(
        id=str(uuid.uuid4()),
        **data.model_dump(exclude_none=True),
        estado=EstadoProcesamiento.listo,
        progreso=100,
    )
    db.add(pieza)
    await db.commit()
    await db.refresh(pieza)
    return _to_read(pieza)


# ── Actualizar metadata ───────────────────────────────────────────
@router.patch("/{pieza_id}", response_model=PiezaRead)
async def actualizar_pieza(
    pieza_id: str,
    data: PiezaUpdate,
    db: AsyncSession = Depends(get_db),
):
    pieza = await db.get(Pieza, pieza_id)
    if not pieza:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")

    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(pieza, campo, valor)

    await db.commit()
    await db.refresh(pieza)
    return _to_read(pieza)


# ── Eliminar pieza ────────────────────────────────────────────────
@router.delete("/{pieza_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_pieza(pieza_id: str, db: AsyncSession = Depends(get_db)):
    pieza = await db.get(Pieza, pieza_id)
    if not pieza:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")

    if pieza.archivo_ruta and pieza.archivo_nombre:
        storage_service.eliminar_archivo(pieza_id, pieza.archivo_nombre)

    from app.services.search_service import eliminar_del_indice
    eliminar_del_indice(pieza_id)

    await db.delete(pieza)
    await db.commit()


# ── Re-procesar ───────────────────────────────────────────────────
@router.post("/{pieza_id}/reprocesar", response_model=dict)
async def reprocesar_pieza(pieza_id: str, db: AsyncSession = Depends(get_db)):
    pieza = await db.get(Pieza, pieza_id)
    if not pieza:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    if pieza.estado == EstadoProcesamiento.procesando:
        raise HTTPException(status_code=409, detail="La pieza ya está siendo procesada")

    pieza.estado = EstadoProcesamiento.pendiente
    pieza.progreso = 0
    pieza.error_msg = None
    await db.commit()

    job_id = await encolar_job(pieza_id)
    return {"mensaje": "Re-procesamiento encolado", "job_id": job_id}