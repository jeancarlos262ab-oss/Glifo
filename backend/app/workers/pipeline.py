"""
Worker de procesamiento async — el corazón del pipeline de Glifo.

Pipeline para cada tipo de archivo:
  PDF       → extraer_texto → OCR si escaneado → clasificar → NER → embedding → grafo
  Imagen    → describir_llava → clasificar → NER → embedding → grafo
  Audio     → (transcripción pendiente Whisper) → clasificar → NER → embedding → grafo
  Video     → (extracción frames + audio) → describir → clasificar → NER → embedding → grafo
"""
from __future__ import annotations
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.piece import Pieza, EstadoProcesamiento, TipoPieza
from app.models.job import Job, EstadoJob, TipoJob
from app.services import ollama_service, pdf_service, graph_service, search_service

log = logging.getLogger(__name__)
settings = get_settings()

# ── Cola interna en memoria ──────────────────────────────────────
_cola: asyncio.Queue[str] = asyncio.Queue()
_semaphore: Optional[asyncio.Semaphore] = None

PASOS_PDF    = ["Extracción texto", "OCR/Análisis", "Clasificación IA", "Entidades NER", "Embedding", "Grafo"]
PASOS_IMAGEN = ["Carga", "Descripción visual", "Clasificación IA", "Entidades NER", "Embedding", "Grafo"]
PASOS_AUDIO  = ["Carga", "Transcripción Whisper", "Clasificación IA", "Entidades NER", "Embedding", "Grafo"]
PASOS_VIDEO  = ["Extracción frames", "Transcripción audio", "Descripción", "Clasificación IA", "Entidades NER", "Embedding", "Grafo"]


def get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(settings.worker_concurrency)
    return _semaphore


async def encolar_job(pieza_id: str) -> str:
    """Encola una pieza para procesamiento. Retorna el job_id."""
    job_id = str(uuid.uuid4())
    async with AsyncSessionLocal() as db:
        pieza = await db.get(Pieza, pieza_id)
        if not pieza:
            raise ValueError(f"Pieza {pieza_id} no encontrada")

        tipo_job_map = {
            TipoPieza.documento: TipoJob.ingesta_pdf,
            TipoPieza.imagen:    TipoJob.ingesta_imagen,
            TipoPieza.audio:     TipoJob.ingesta_audio,
            TipoPieza.video:     TipoJob.ingesta_video,
        }

        job = Job(
            id=job_id,
            pieza_id=pieza_id,
            tipo=tipo_job_map.get(pieza.tipo, TipoJob.ingesta_pdf),
            estado=EstadoJob.pendiente,
            pasos_totales=_pasos_para_tipo(pieza.tipo),
            pasos_completados=[],
        )
        db.add(job)
        await db.commit()

    await _cola.put(pieza_id)
    log.info(f"Job {job_id[:8]} encolado para pieza {pieza_id[:8]}")
    asyncio.create_task(_ejecutar_job(pieza_id, job_id))
    return job_id


def _pasos_para_tipo(tipo: TipoPieza) -> list[str]:
    mapping = {
        TipoPieza.documento:  PASOS_PDF,
        TipoPieza.imagen:     PASOS_IMAGEN,
        TipoPieza.audio:      PASOS_AUDIO,
        TipoPieza.video:      PASOS_VIDEO,
    }
    return mapping.get(tipo, PASOS_PDF)


async def _actualizar_progreso(
    db: AsyncSession,
    pieza: Pieza,
    job: Job,
    paso: str,
    progreso: int,
) -> None:
    """Actualiza el estado de progreso en DB."""
    pieza.paso_actual = paso
    pieza.progreso = progreso
    pieza.estado = EstadoProcesamiento.procesando

    job.paso_actual = paso
    job.progreso = progreso
    job.estado = EstadoJob.ejecutando
    if not job.pasos_completados:
        job.pasos_completados = []
    if paso not in job.pasos_completados:
        job.pasos_completados.append(paso)

    await db.commit()
    log.debug(f"Pieza {pieza.id[:8]}: {paso} ({progreso}%)")


async def _ejecutar_job(pieza_id: str, job_id: str) -> None:
    """Ejecuta el pipeline completo para una pieza."""
    async with get_semaphore():
        async with AsyncSessionLocal() as db:
            pieza = await db.get(Pieza, pieza_id)
            job = await db.get(Job, job_id)

            if not pieza or not job:
                log.error(f"Pieza o job no encontrado: {pieza_id}, {job_id}")
                return

            job.estado = EstadoJob.ejecutando
            job.iniciado_en = datetime.now(timezone.utc)
            job.intentos += 1
            await db.commit()

            try:
                if pieza.tipo == TipoPieza.documento:
                    await _pipeline_pdf(db, pieza, job)
                elif pieza.tipo == TipoPieza.imagen:
                    await _pipeline_imagen(db, pieza, job)
                elif pieza.tipo == TipoPieza.audio:
                    await _pipeline_audio(db, pieza, job)
                elif pieza.tipo == TipoPieza.video:
                    await _pipeline_video(db, pieza, job)
                else:
                    await _pipeline_generico(db, pieza, job)

                # ── Marcar como completado ────────────────────────
                pieza.estado = EstadoProcesamiento.listo
                pieza.progreso = 100
                pieza.paso_actual = "Completado"
                job.estado = EstadoJob.completado
                job.progreso = 100
                job.completado_en = datetime.now(timezone.utc)
                await db.commit()
                log.info(f"✓ Pieza {pieza.id[:8]} procesada correctamente")

            except Exception as e:
                log.error(f"✗ Error procesando pieza {pieza_id}: {e}", exc_info=True)
                pieza.estado = EstadoProcesamiento.error
                pieza.error_msg = str(e)
                job.estado = EstadoJob.fallido
                job.error_msg = str(e)
                job.completado_en = datetime.now(timezone.utc)
                await db.commit()


# ── Pipelines por tipo ────────────────────────────────────────────

async def _pipeline_pdf(db: AsyncSession, pieza: Pieza, job: Job) -> None:
    pasos = PASOS_PDF
    total = len(pasos)

    # 1. Extracción de texto
    await _actualizar_progreso(db, pieza, job, pasos[0], int(1/total*100))
    texto = ""
    if pieza.archivo_ruta and Path(pieza.archivo_ruta).exists():
        texto = pdf_service.extraer_texto_pdf(pieza.archivo_ruta)
        meta_pdf = pdf_service.extraer_metadata_pdf(pieza.archivo_ruta)
        if meta_pdf.get("titulo_pdf") and not pieza.titulo:
            pieza.titulo = meta_pdf["titulo_pdf"]

    # 2. OCR / Análisis visual si PDF escaneado
    await _actualizar_progreso(db, pieza, job, pasos[1], int(2/total*100))
    if pdf_service.necesita_ocr(texto) and pieza.archivo_ruta:
        # Convertir páginas a imagen y describir con llava
        dir_tmp = Path(pieza.archivo_ruta).parent / "paginas"
        paginas = pdf_service.pdf_a_imagenes(pieza.archivo_ruta, dir_tmp)
        descripciones = []
        for pag in paginas[:5]:  # máximo 5 páginas en demo
            desc = await ollama_service.describir_imagen(pag)
            descripciones.append(desc)
        texto = "\n\n".join(descripciones)

    pieza.texto_extraido = texto

    # 3. Clasificación con IA
    await _actualizar_progreso(db, pieza, job, pasos[2], int(3/total*100))
    clasificacion = await ollama_service.clasificar_pieza(pieza.titulo, texto)
    if clasificacion.get("anio") and not pieza.anio:
        pieza.anio = clasificacion.get("anio")
    if clasificacion.get("idioma"):
        pieza.idioma = clasificacion["idioma"]
    if clasificacion.get("resumen_breve"):
        pieza.descripcion = clasificacion["resumen_breve"]

    # 4. Extracción de entidades NER
    await _actualizar_progreso(db, pieza, job, pasos[3], int(4/total*100))
    entidades = await ollama_service.extraer_entidades(texto)
    pieza.entidades = entidades

    # 5. Resumen + Tags
    resumen = await ollama_service.generar_resumen(texto, pieza.titulo)
    pieza.resumen = resumen
    tags_ia = await ollama_service.generar_tags(pieza.titulo, pieza.descripcion or "", entidades)
    pieza.tags = list(set((pieza.tags or []) + tags_ia))

    # 6. Embedding + indexación semántica
    await _actualizar_progreso(db, pieza, job, pasos[4], int(5/total*100))
    texto_para_embed = f"{pieza.titulo} {pieza.descripcion or ''} {pieza.resumen or ''} {texto[:2000]}"
    await search_service.indexar_pieza(pieza.id, texto_para_embed, {
        "titulo": pieza.titulo,
        "tipo": pieza.tipo.value,
        "coleccion": pieza.coleccion,
        "anio": pieza.anio,
        "tags": pieza.tags,
        "entidades": entidades,
        "descripcion": pieza.descripcion,
        "num_conexiones": pieza.num_conexiones,
    })

    # 7. Grafo de conocimiento
    await _actualizar_progreso(db, pieza, job, pasos[5], int(6/total*100))
    graph_service.agregar_nodo(pieza.id, {
        "titulo": pieza.titulo,
        "tipo": pieza.tipo.value,
        "coleccion": pieza.coleccion,
        "tags": pieza.tags,
        "entidades": entidades,
        "anio": pieza.anio,
    })
    graph_service.construir_relaciones_automaticas(pieza.id, entidades, pieza.tags or [])
    pieza.num_conexiones = graph_service.calcular_conexiones(pieza.id)

    await db.commit()


async def _pipeline_imagen(db: AsyncSession, pieza: Pieza, job: Job) -> None:
    pasos = PASOS_IMAGEN
    total = len(pasos)

    # 1. Carga
    await _actualizar_progreso(db, pieza, job, pasos[0], int(1/total*100))

    # 2. Descripción visual con llava
    await _actualizar_progreso(db, pieza, job, pasos[1], int(2/total*100))
    descripcion_visual = ""
    if pieza.archivo_ruta and Path(pieza.archivo_ruta).exists():
        descripcion_visual = await ollama_service.describir_imagen(pieza.archivo_ruta)
    pieza.texto_extraido = descripcion_visual
    pieza.descripcion = descripcion_visual[:500]

    # 3-7. Igual que PDF
    await _actualizar_progreso(db, pieza, job, pasos[2], int(3/total*100))
    clasificacion = await ollama_service.clasificar_pieza(pieza.titulo, descripcion_visual)
    if clasificacion.get("anio") and not pieza.anio:
        pieza.anio = clasificacion.get("anio")

    await _actualizar_progreso(db, pieza, job, pasos[3], int(4/total*100))
    entidades = await ollama_service.extraer_entidades(descripcion_visual)
    pieza.entidades = entidades

    tags_ia = await ollama_service.generar_tags(pieza.titulo, pieza.descripcion or "", entidades)
    pieza.tags = list(set((pieza.tags or []) + tags_ia))

    await _actualizar_progreso(db, pieza, job, pasos[4], int(5/total*100))
    texto_embed = f"{pieza.titulo} {descripcion_visual[:2000]}"
    await search_service.indexar_pieza(pieza.id, texto_embed, {
        "titulo": pieza.titulo, "tipo": pieza.tipo.value,
        "coleccion": pieza.coleccion, "anio": pieza.anio,
        "tags": pieza.tags, "entidades": entidades,
        "descripcion": pieza.descripcion, "num_conexiones": 0,
    })

    await _actualizar_progreso(db, pieza, job, pasos[5], int(6/total*100))
    graph_service.agregar_nodo(pieza.id, {
        "titulo": pieza.titulo, "tipo": pieza.tipo.value,
        "coleccion": pieza.coleccion, "tags": pieza.tags,
        "entidades": entidades, "anio": pieza.anio,
    })
    graph_service.construir_relaciones_automaticas(pieza.id, entidades, pieza.tags or [])
    pieza.num_conexiones = graph_service.calcular_conexiones(pieza.id)
    await db.commit()


async def _pipeline_audio(db: AsyncSession, pieza: Pieza, job: Job) -> None:
    """Pipeline para audio — usa Whisper (openai-whisper o whisper.cpp)."""
    from app.services.whisper_service import transcribir
    pasos = PASOS_AUDIO
    total = len(pasos)

    await _actualizar_progreso(db, pieza, job, pasos[0], int(1/total*100))

    await _actualizar_progreso(db, pieza, job, pasos[1], int(2/total*100))
    resultado_transcripcion = {"texto": "", "backend": "sin_transcripcion", "disponible": False}
    if pieza.archivo_ruta and Path(pieza.archivo_ruta).exists():
        resultado_transcripcion = await transcribir(pieza.archivo_ruta, es_video=False)

    texto = resultado_transcripcion["texto"]
    pieza.texto_extraido = texto
    pieza.descripcion = texto[:500] if texto else f"Archivo de audio: {pieza.archivo_nombre}"
    pieza.idioma = resultado_transcripcion.get("idioma", "es")

    await _pipeline_generico(db, pieza, job)


async def _pipeline_video(db: AsyncSession, pieza: Pieza, job: Job) -> None:
    """Pipeline para video — ffmpeg para frames + Whisper para audio."""
    from app.services.whisper_service import transcribir, extraer_frames_video
    pasos = PASOS_VIDEO

    await _actualizar_progreso(db, pieza, job, pasos[0], 15)

    # Extraer frames representativos para describir con llava
    descripciones_visuales = []
    if pieza.archivo_ruta and Path(pieza.archivo_ruta).exists():
        dir_tmp = Path(pieza.archivo_ruta).parent / "frames"
        frames = extraer_frames_video(pieza.archivo_ruta, dir_tmp, fps=0.5, max_frames=10)
    for i, frame in enumerate(frames[:8]):
        desc = await ollama_service.describir_imagen(frame, contexto=f"frame {i+1} of a video")
        if desc and "no encontrada" not in desc.lower():
            descripciones_visuales.append(f"[Escena {i+1}] {desc}")

    await _actualizar_progreso(db, pieza, job, pasos[1], 30)

    # Transcribir audio del video
    resultado_transcripcion = {"texto": "", "disponible": False}
    if pieza.archivo_ruta and Path(pieza.archivo_ruta).exists():
        resultado_transcripcion = await transcribir(pieza.archivo_ruta, es_video=True)

    # Combinar descripción visual + transcripción
    partes = []
    if descripciones_visuales:
        partes.append("DESCRIPCIÓN VISUAL:\n" + "\n".join(descripciones_visuales))
    if resultado_transcripcion["texto"]:
        partes.append("TRANSCRIPCIÓN:\n" + resultado_transcripcion["texto"])

    texto_combinado = "\n\n".join(partes) if partes else f"Video: {pieza.archivo_nombre}"
    pieza.texto_extraido = texto_combinado
    pieza.descripcion = (descripciones_visuales[0][:500] if descripciones_visuales else texto_combinado[:500])

    await _pipeline_generico(db, pieza, job)


async def _pipeline_generico(db: AsyncSession, pieza: Pieza, job: Job) -> None:
    """Pasos finales comunes: NER + embedding + grafo."""
    texto = pieza.texto_extraido or pieza.titulo

    entidades = await ollama_service.extraer_entidades(texto)
    pieza.entidades = entidades

    tags_ia = await ollama_service.generar_tags(pieza.titulo, pieza.descripcion or "", entidades)
    pieza.tags = list(set((pieza.tags or []) + tags_ia))

    await search_service.indexar_pieza(pieza.id, f"{pieza.titulo} {texto[:2000]}", {
        "titulo": pieza.titulo, "tipo": pieza.tipo.value,
        "coleccion": pieza.coleccion, "anio": pieza.anio,
        "tags": pieza.tags, "entidades": entidades,
        "descripcion": pieza.descripcion, "num_conexiones": 0,
    })

    graph_service.agregar_nodo(pieza.id, {
        "titulo": pieza.titulo, "tipo": pieza.tipo.value,
        "coleccion": pieza.coleccion, "tags": pieza.tags,
        "entidades": entidades, "anio": pieza.anio,
    })
    graph_service.construir_relaciones_automaticas(pieza.id, entidades, pieza.tags or [])
    pieza.num_conexiones = graph_service.calcular_conexiones(pieza.id)
    await db.commit()
