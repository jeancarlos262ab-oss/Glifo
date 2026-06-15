"""
Servicio de ingesta de PDF.
Usa PyMuPDF para extracción de texto y páginas.
"""
from __future__ import annotations
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)


def extraer_texto_pdf(ruta: str | Path) -> str:
    """
    Extrae todo el texto de un PDF usando PyMuPDF.
    Maneja PDFs escaneados (retorna string vacío si no hay texto).
    """
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(ruta))
        partes = []
        for pagina in doc:
            texto = pagina.get_text("text")
            if texto.strip():
                partes.append(texto)
        doc.close()
        return "\n\n".join(partes)
    except Exception as e:
        log.error(f"Error extrayendo texto de PDF {ruta}: {e}")
        return ""


def extraer_metadata_pdf(ruta: str | Path) -> dict:
    """Extrae metadata del PDF (autor, título, fecha de creación, nº páginas)."""
    try:
        import fitz
        doc = fitz.open(str(ruta))
        meta = doc.metadata or {}
        resultado = {
            "paginas": len(doc),
            "titulo_pdf": meta.get("title", ""),
            "autor": meta.get("author", ""),
            "creador": meta.get("creator", ""),
            "fecha_creacion": meta.get("creationDate", ""),
        }
        doc.close()
        return resultado
    except Exception as e:
        log.error(f"Error extrayendo metadata de PDF {ruta}: {e}")
        return {}


def extraer_imagenes_pdf(ruta: str | Path, directorio_salida: str | Path) -> list[Path]:
    """
    Extrae imágenes incrustadas en un PDF.
    Guarda en directorio_salida. Retorna lista de rutas.
    """
    import fitz
    salida = Path(directorio_salida)
    salida.mkdir(parents=True, exist_ok=True)
    rutas: list[Path] = []

    try:
        doc = fitz.open(str(ruta))
        for pag_num, pagina in enumerate(doc):
            imagenes = pagina.get_images(full=True)
            for img_num, img_info in enumerate(imagenes):
                xref = img_info[0]
                base_img = doc.extract_image(xref)
                img_bytes = base_img["image"]
                ext = base_img["ext"]
                nombre = salida / f"pagina_{pag_num+1}_img_{img_num+1}.{ext}"
                with open(nombre, "wb") as f:
                    f.write(img_bytes)
                rutas.append(nombre)
        doc.close()
    except Exception as e:
        log.error(f"Error extrayendo imágenes de PDF {ruta}: {e}")

    return rutas


def pdf_a_imagenes(ruta: str | Path, directorio_salida: str | Path, dpi: int = 150) -> list[Path]:
    """
    Convierte páginas de PDF a imágenes PNG (útil para PDFs escaneados sin texto).
    """
    import fitz
    salida = Path(directorio_salida)
    salida.mkdir(parents=True, exist_ok=True)
    rutas: list[Path] = []

    try:
        doc = fitz.open(str(ruta))
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        for pag_num, pagina in enumerate(doc):
            pixmap = pagina.get_pixmap(matrix=mat)
            nombre = salida / f"pagina_{pag_num+1}.png"
            pixmap.save(str(nombre))
            rutas.append(nombre)
        doc.close()
    except Exception as e:
        log.error(f"Error convirtiendo PDF a imágenes {ruta}: {e}")

    return rutas


def necesita_ocr(texto: str, min_chars: int = 100) -> bool:
    """Determina si un PDF necesita OCR (poco o nulo texto extraído)."""
    return len(texto.strip()) < min_chars
