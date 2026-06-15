"""
Modelo Job — representa un trabajo de procesamiento en la cola.
Cada pieza puede tener múltiples jobs (reintentos).
"""
from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlalchemy import String, Text, Integer, DateTime, JSON, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.database import Base


class EstadoJob(str, enum.Enum):
    pendiente = "pendiente"
    ejecutando = "ejecutando"
    completado = "completado"
    fallido = "fallido"
    cancelado = "cancelado"


class TipoJob(str, enum.Enum):
    ingesta_pdf = "ingesta_pdf"
    ingesta_imagen = "ingesta_imagen"
    ingesta_audio = "ingesta_audio"
    ingesta_video = "ingesta_video"
    generacion_embedding = "generacion_embedding"
    extraccion_entidades = "extraccion_entidades"
    actualizacion_grafo = "actualizacion_grafo"


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    pieza_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("piezas.id", ondelete="CASCADE"),
        index=True, nullable=True
    )
    tipo: Mapped[TipoJob] = mapped_column(SAEnum(TipoJob), nullable=False, index=True)
    estado: Mapped[EstadoJob] = mapped_column(
        SAEnum(EstadoJob), default=EstadoJob.pendiente, index=True
    )

    # ── Progreso ─────────────────────────────────────────────────
    progreso: Mapped[int] = mapped_column(Integer, default=0)
    paso_actual: Mapped[Optional[str]] = mapped_column(String(128))
    pasos_completados: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    pasos_totales: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # ── Resultado / Error ─────────────────────────────────────────
    resultado: Mapped[Optional[dict]] = mapped_column(JSON)
    error_msg: Mapped[Optional[str]] = mapped_column(Text)
    intentos: Mapped[int] = mapped_column(Integer, default=0)

    # ── Timestamps ───────────────────────────────────────────────
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    iniciado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completado_en: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # ── Relación ─────────────────────────────────────────────────
    pieza: Mapped[Optional["Pieza"]] = relationship(  # noqa: F821
        "Pieza", back_populates="jobs"
    )

    def __repr__(self) -> str:
        return f"<Job {self.id[:8]} | {self.tipo} | {self.estado}>"
