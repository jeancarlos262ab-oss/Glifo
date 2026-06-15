"""
Schemas Pydantic para Pieza.
Separamos lo que entra (Create/Update) de lo que sale (Read).
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

from app.models.piece import TipoPieza, EstadoProcesamiento


# ── Base ─────────────────────────────────────────────────────────
class PiezaBase(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=512)
    tipo: TipoPieza
    coleccion: str = Field(..., min_length=1, max_length=256)
    descripcion: Optional[str] = None
    anio: Optional[int] = Field(None, ge=1, le=2100)
    tags: Optional[List[str]] = Field(default_factory=list)
    idioma: Optional[str] = None


# ── Creación manual (sin archivo) ─────────────────────────────────
class PiezaCreate(PiezaBase):
    pass


# ── Actualización parcial ─────────────────────────────────────────
class PiezaUpdate(BaseModel):
    titulo: Optional[str] = Field(None, min_length=1, max_length=512)
    descripcion: Optional[str] = None
    coleccion: Optional[str] = None
    tags: Optional[List[str]] = None
    anio: Optional[int] = None


# ── Respuesta completa ────────────────────────────────────────────
class PiezaRead(PiezaBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    texto_extraido: Optional[str] = None
    resumen: Optional[str] = None
    entidades: Optional[Dict[str, Any]] = None
    score_relevancia: float = 1.0
    archivo_nombre: Optional[str] = None
    archivo_tamano: Optional[int] = None
    archivo_mimetype: Optional[str] = None
    archivo_url: Optional[str] = None
    estado: EstadoProcesamiento
    progreso: int
    paso_actual: Optional[str] = None
    error_msg: Optional[str] = None
    num_conexiones: int
    creado_en: datetime
    actualizado_en: datetime


# ── Respuesta resumida (para listas) ─────────────────────────────
class PiezaResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titulo: str
    tipo: TipoPieza
    coleccion: str
    anio: Optional[int] = None
    tags: Optional[List[str]] = None
    estado: EstadoProcesamiento
    progreso: int
    num_conexiones: int
    creado_en: datetime
    archivo_mimetype: Optional[str] = None
    archivo_url: Optional[str] = None


# ── Paginación ────────────────────────────────────────────────────
class PaginatedPiezas(BaseModel):
    items: List[PiezaResumen]
    total: int
    pagina: int
    por_pagina: int
    paginas: int


# ── Resultado de búsqueda semántica ──────────────────────────────
class ResultadoBusqueda(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titulo: str
    tipo: TipoPieza
    coleccion: str
    descripcion: Optional[str] = None
    anio: Optional[int] = None
    tags: Optional[List[str]] = None
    entidades: Optional[Dict[str, Any]] = None
    num_conexiones: int
    score: float = Field(..., description="Similitud semántica 0-1")