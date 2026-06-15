"""
Router de Jobs — monitoreo de la cola de procesamiento.

Endpoints:
  GET  /jobs           → lista de jobs (cola de procesamiento)
  GET  /jobs/{id}      → estado de un job específico
  GET  /jobs/cola      → resumen del estado de la cola
  POST /jobs/{id}/cancelar → cancelar un job pendiente
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models.job import Job, EstadoJob
from app.schemas.job import JobRead, ColaEstado

router = APIRouter(prefix="/jobs", tags=["Jobs / Cola"])


# ── Lista de jobs ─────────────────────────────────────────────────
@router.get("", response_model=list[JobRead])
async def listar_jobs(
    estado: Optional[EstadoJob] = None,
    pieza_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    filtros = []
    if estado:
        filtros.append(Job.estado == estado)
    if pieza_id:
        filtros.append(Job.pieza_id == pieza_id)

    condicion = and_(*filtros) if filtros else True
    result = await db.execute(
        select(Job).where(condicion).order_by(desc(Job.creado_en)).limit(limit)
    )
    return [JobRead.model_validate(j) for j in result.scalars().all()]


# ── Detalle de un job ─────────────────────────────────────────────
@router.get("/cola", response_model=ColaEstado)
async def estado_cola(db: AsyncSession = Depends(get_db)):
    """Resumen del estado actual de la cola."""
    hoy = datetime.now(timezone.utc) - timedelta(hours=24)

    pendientes = (await db.execute(
        select(func.count(Job.id)).where(Job.estado == EstadoJob.pendiente)
    )).scalar_one()

    ejecutando = (await db.execute(
        select(func.count(Job.id)).where(Job.estado == EstadoJob.ejecutando)
    )).scalar_one()

    completados = (await db.execute(
        select(func.count(Job.id)).where(
            and_(Job.estado == EstadoJob.completado, Job.completado_en >= hoy)
        )
    )).scalar_one()

    fallidos = (await db.execute(
        select(func.count(Job.id)).where(Job.estado == EstadoJob.fallido)
    )).scalar_one()

    # Jobs activos (últimos 20)
    activos = (await db.execute(
        select(Job)
        .where(Job.estado.in_([EstadoJob.pendiente, EstadoJob.ejecutando]))
        .order_by(desc(Job.creado_en)).limit(20)
    )).scalars().all()

    return ColaEstado(
        pendientes=pendientes,
        ejecutando=ejecutando,
        completados_hoy=completados,
        fallidos=fallidos,
        jobs=[JobRead.model_validate(j) for j in activos],
    )


@router.get("/{job_id}", response_model=JobRead)
async def obtener_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return JobRead.model_validate(job)


# ── Cancelar job ──────────────────────────────────────────────────
@router.post("/{job_id}/cancelar", response_model=JobRead)
async def cancelar_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    if job.estado not in [EstadoJob.pendiente]:
        raise HTTPException(
            status_code=409,
            detail=f"Solo se pueden cancelar jobs pendientes. Estado actual: {job.estado}"
        )
    job.estado = EstadoJob.cancelado
    await db.commit()
    await db.refresh(job)
    return JobRead.model_validate(job)
