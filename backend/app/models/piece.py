"""
Modelo SQLAlchemy para Pieza cultural.
Almacena metadata estructurada + vector de embedding (pgvector).
"""
from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlalchemy import (
    String, Text, Integer, Float, DateTime, JSON,
    Enum as SAEnum, ForeignKey, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import enum

from app.db.database import Base


class TipoPieza(str, enum.Enum):
    documento = "documento"
    imagen = "imagen"
    audio = "audio"
    video = "video"
    objeto = "objeto"
    patrimonio = "patrimonio"


class EstadoProcesamiento(str, enum.Enum):
    pendiente = "pendiente"
    procesando = "procesando"
    listo = "listo"
    error = "error"


class Pieza(Base):
    __tablename__ = "piezas"

    # ── Identidad ────────────────────────────────────────────────
    id: Mapped[str] = mapped_column(
        String(64), primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    titulo: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    tipo: Mapped[TipoPieza] = mapped_column(SAEnum(TipoPieza), nullable=False, index=True)
    coleccion: Mapped[str] = mapped_column(String(256), nullable=False, index=True)

    # ── Contenido ─────────────────────────────────────────────────
    descripcion: Mapped[Optional[str]] = mapped_column(Text)
    texto_extraido: Mapped[Optional[str]] = mapped_column(Text)   # OCR / transcripción
    resumen: Mapped[Optional[str]] = mapped_column(Text)
    # Renombrado: año → anio  (evita corrupción UTF-8 en Windows)
    anio: Mapped[Optional[int]] = mapped_column(Integer, name="anio")

    # ── Metadata enriquecida por IA ──────────────────────────────
    entidades: Mapped[Optional[dict]] = mapped_column(
        JSON, default=dict,
        comment="{'personas': [], 'lugares': [], 'fechas': [], 'eventos': []}"
    )
    tags: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    idioma: Mapped[Optional[str]] = mapped_column(String(32))
    score_relevancia: Mapped[float] = mapped_column(Float, default=1.0)

    # ── Archivo original ─────────────────────────────────────────
    archivo_nombre: Mapped[Optional[str]] = mapped_column(String(512))
    archivo_ruta: Mapped[Optional[str]] = mapped_column(String(1024))
    # Renombrado: archivo_tamaño → archivo_tamano
    archivo_tamano: Mapped[Optional[int]] = mapped_column(Integer, name="archivo_tamano")   # bytes
    archivo_mimetype: Mapped[Optional[str]] = mapped_column(String(128))

    # ── Estado de procesamiento ───────────────────────────────────
    estado: Mapped[EstadoProcesamiento] = mapped_column(
        SAEnum(EstadoProcesamiento),
        default=EstadoProcesamiento.pendiente,
        index=True,
    )
    progreso: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    paso_actual: Mapped[Optional[str]] = mapped_column(String(128))
    error_msg: Mapped[Optional[str]] = mapped_column(Text)

    # ── Relaciones en el grafo ────────────────────────────────────
    num_conexiones: Mapped[int] = mapped_column(Integer, default=0)

    # ── Timestamps ───────────────────────────────────────────────
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── Jobs relacionados ─────────────────────────────────────────
    jobs: Mapped[list["Job"]] = relationship(  # noqa: F821
        "Job", back_populates="pieza", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_piezas_tipo_estado", "tipo", "estado"),
        Index("ix_piezas_coleccion_anio", "coleccion", "anio"),
    )

    def __repr__(self) -> str:
        return f"<Pieza {self.id[:8]} | {self.tipo} | {self.titulo[:40]}>"
