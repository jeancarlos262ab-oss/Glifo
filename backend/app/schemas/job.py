"""Schemas Pydantic para Job de procesamiento."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.models.job import TipoJob, EstadoJob


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pieza_id: Optional[str] = None
    tipo: TipoJob
    estado: EstadoJob
    progreso: int
    paso_actual: Optional[str] = None
    pasos_completados: Optional[List[str]] = None
    pasos_totales: Optional[List[str]] = None
    resultado: Optional[Dict[str, Any]] = None
    error_msg: Optional[str] = None
    intentos: int
    creado_en: datetime
    iniciado_en: Optional[datetime] = None
    completado_en: Optional[datetime] = None


class ColaEstado(BaseModel):
    """Estado general de la cola de procesamiento."""
    pendientes: int
    ejecutando: int
    completados_hoy: int
    fallidos: int
    jobs: List[JobRead]
