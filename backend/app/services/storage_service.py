"""
Servicio de almacenamiento de archivos.
Guarda los archivos subidos en el sistema de archivos local.
En producción se puede reemplazar por MinIO.
"""
from __future__ import annotations
import hashlib
import logging
import mimetypes
import shutil
import uuid
from pathlib import Path

import aiofiles

from app.core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

UPLOAD_ROOT = Path(settings.upload_dir)
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

# Tipos permitidos
MIMETYPES_PERMITIDOS = {
    # Documentos
    "application/pdf": "documento",
    "application/msword": "documento",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "documento",
    "text/plain": "documento",
    "text/markdown": "documento",
    # Imágenes
    "image/jpeg": "imagen",
    "image/png": "imagen",
    "image/tiff": "imagen",
    "image/webp": "imagen",
    "image/gif": "imagen",
    # Audio
    "audio/mpeg": "audio",
    "audio/wav": "audio",
    "audio/ogg": "audio",
    "audio/mp4": "audio",
    "audio/x-m4a": "audio",
    "audio/flac": "audio",
    # Video
    "video/mp4": "video",
    "video/quicktime": "video",
    "video/x-msvideo": "video",
    "video/x-matroska": "video",
    "video/webm": "video",
}


def detectar_tipo_pieza(mimetype: str) -> str:
    """Infiere el tipo de pieza desde el MIME type."""
    return MIMETYPES_PERMITIDOS.get(mimetype, "documento")


def obtener_mimetype(nombre_archivo: str) -> str:
    """Detecta MIME type desde la extensión del archivo."""
    tipo, _ = mimetypes.guess_type(nombre_archivo)
    return tipo or "application/octet-stream"


def ruta_para_pieza(pieza_id: str, nombre_original: str) -> Path:
    """Genera la ruta de almacenamiento para una pieza."""
    ext = Path(nombre_original).suffix
    return UPLOAD_ROOT / pieza_id[:2] / pieza_id / f"original{ext}"


async def guardar_archivo(contenido: bytes, pieza_id: str, nombre_original: str) -> Path:
    """
    Guarda el archivo en disco de forma async.
    Organiza en subdirectorios por los primeros 2 chars del ID.
    """
    ruta = ruta_para_pieza(pieza_id, nombre_original)
    ruta.parent.mkdir(parents=True, exist_ok=True)

    async with aiofiles.open(ruta, "wb") as f:
        await f.write(contenido)

    log.info(f"Archivo guardado: {ruta} ({len(contenido):,} bytes)")
    return ruta


def eliminar_archivo(pieza_id: str, nombre_original: str) -> bool:
    """Elimina el archivo de disco."""
    ruta = ruta_para_pieza(pieza_id, nombre_original)
    try:
        if ruta.exists():
            ruta.unlink()
        # Eliminar directorio si queda vacío
        if ruta.parent.exists() and not any(ruta.parent.iterdir()):
            shutil.rmtree(ruta.parent, ignore_errors=True)
        return True
    except Exception as e:
        log.error(f"Error eliminando archivo {ruta}: {e}")
        return False


def tamano_archivo(ruta: str | Path) -> int:
    """Retorna tamaño del archivo en bytes."""
    p = Path(ruta)
    return p.stat().st_size if p.exists() else 0


def hash_archivo(ruta: str | Path) -> str:
    """Calcula SHA-256 del archivo para detectar duplicados."""
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def validar_archivo(nombre: str, tamaño_bytes: int) -> tuple[bool, str]:
    """
    Valida que el archivo sea permitido y no exceda el límite de tamaño.
    Retorna (es_valido, mensaje_error).
    """
    mimetype = obtener_mimetype(nombre)
    if mimetype not in MIMETYPES_PERMITIDOS:
        return False, f"Tipo de archivo no permitido: {mimetype}"

    limite = settings.max_file_size_mb * 1024 * 1024
    if tamaño_bytes > limite:
        return False, f"Archivo demasiado grande ({tamaño_bytes/(1024**2):.1f} MB). Límite: {settings.max_file_size_mb} MB"

    return True, ""


def listar_uploads() -> list[dict]:
    """Lista todos los archivos en la carpeta de uploads."""
    archivos = []
    for ruta in UPLOAD_ROOT.rglob("*"):
        if ruta.is_file():
            archivos.append({
                "ruta": str(ruta),
                "nombre": ruta.name,
                "tamano": ruta.stat().st_size,
            })
    return archivos
