"""
Servicio de transcripción de audio y video.

Estrategia:
  1. Intentar usar whisper.cpp (binario compilado)
  2. Fallback: openai-whisper (pip install openai-whisper) si está disponible
  3. Fallback final: placeholder con metadata del archivo

Para instalar whisper en desarrollo:
  pip install openai-whisper --break-system-packages
  (requiere ffmpeg: sudo apt install ffmpeg)
"""
from __future__ import annotations
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)


# ── Detección de backends disponibles ────────────────────────────
def _tiene_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def _tiene_whisper_cpp() -> bool:
    return shutil.which("whisper") is not None or shutil.which("whisper.cpp") is not None


def _tiene_openai_whisper() -> bool:
    try:
        import whisper  # noqa: F401
        return True
    except ImportError:
        return False


# ── Extracción de audio desde video ──────────────────────────────
def extraer_audio_de_video(ruta_video: str | Path, dir_salida: str | Path) -> Optional[Path]:
    """
    Usa ffmpeg para extraer la pista de audio de un video.
    Retorna la ruta del archivo .wav generado.
    """
    if not _tiene_ffmpeg():
        log.warning("ffmpeg no encontrado. Instala con: sudo apt install ffmpeg")
        return None

    salida = Path(dir_salida) / "audio_extraido.wav"
    salida.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-i", str(ruta_video),
        "-vn",                     # sin video
        "-acodec", "pcm_s16le",   # WAV PCM
        "-ar", "16000",            # 16kHz (óptimo para Whisper)
        "-ac", "1",                # mono
        "-y",                      # sobrescribir
        str(salida),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=300)
        if result.returncode == 0 and salida.exists():
            log.info(f"Audio extraído: {salida}")
            return salida
        else:
            log.error(f"ffmpeg error: {result.stderr.decode()[:200]}")
            return None
    except subprocess.TimeoutExpired:
        log.error("ffmpeg: timeout al extraer audio")
        return None
    except Exception as e:
        log.error(f"ffmpeg: {e}")
        return None


def extraer_frames_video(
    ruta_video: str | Path,
    dir_salida: str | Path,
    fps: float = 0.5,
    max_frames: int = 10,
) -> list[Path]:
    """
    Extrae fotogramas representativos del video usando ffmpeg.
    fps=0.5 → 1 frame cada 2 segundos.
    """
    if not _tiene_ffmpeg():
        return []

    salida = Path(dir_salida)
    salida.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-i", str(ruta_video),
        "-vf", f"fps={fps}",
        "-vframes", str(max_frames),
        str(salida / "frame_%04d.jpg"),
        "-y",
    ]
    try:
        subprocess.run(cmd, capture_output=True, timeout=120)
        frames = sorted(salida.glob("frame_*.jpg"))
        log.info(f"Frames extraídos: {len(frames)}")
        return frames
    except Exception as e:
        log.error(f"Error extrayendo frames: {e}")
        return []


# ── Transcripción con openai-whisper ─────────────────────────────
async def transcribir_con_openai_whisper(
    ruta_audio: str | Path,
    idioma: str = "es",
) -> str:
    """
    Transcribe audio con openai-whisper (modelo 'base' por defecto).
    Funciona en CPU sin GPU.
    """
    try:
        import whisper
        import asyncio

        def _transcribir() -> str:
            modelo = whisper.load_model("base")
            resultado = modelo.transcribe(
                str(ruta_audio),
                language=idioma,
                task="transcribe",
            )
            return resultado.get("text", "")

        # Ejecutar en thread para no bloquear el event loop
        loop = asyncio.get_event_loop()
        texto = await loop.run_in_executor(None, _transcribir)
        log.info(f"Transcripción completada: {len(texto)} chars")
        return texto
    except ImportError:
        log.warning("openai-whisper no instalado: pip install openai-whisper")
        return ""
    except Exception as e:
        log.error(f"Error transcribiendo con Whisper: {e}")
        return ""


# ── Transcripción con whisper.cpp ─────────────────────────────────
async def transcribir_con_whisper_cpp(
    ruta_audio: str | Path,
    modelo: str = "base",
) -> str:
    """
    Transcribe usando el binario de whisper.cpp compilado localmente.
    Más rápido que openai-whisper en CPU.
    """
    import asyncio

    binario = shutil.which("whisper") or shutil.which("whisper.cpp") or "./whisper.cpp/main"
    if not Path(binario).exists():
        return ""

    cmd = [binario, "-m", f"models/ggml-{modelo}.bin", "-f", str(ruta_audio), "-l", "es"]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=300)
        return stdout.decode("utf-8", errors="ignore")
    except Exception as e:
        log.error(f"whisper.cpp error: {e}")
        return ""


# ── Función pública: transcribir cualquier archivo ────────────────
async def transcribir(
    ruta: str | Path,
    es_video: bool = False,
    idioma: str = "es",
) -> dict:
    """
    Punto de entrada unificado.
    Detecta el backend disponible y transcribe.

    Retorna:
    {
        "texto": str,
        "idioma": str,
        "backend": "openai-whisper" | "whisper.cpp" | "sin_transcripcion",
        "disponible": bool,
    }
    """
    ruta = Path(ruta)

    # Si es video, extraer audio primero
    ruta_audio = ruta
    if es_video:
        with tempfile.TemporaryDirectory() as tmp:
            audio = extraer_audio_de_video(ruta, tmp)
            if audio:
                ruta_audio = audio
            else:
                return {
                    "texto": f"[Video sin transcripción — ffmpeg no disponible: {ruta.name}]",
                    "idioma": idioma,
                    "backend": "sin_transcripcion",
                    "disponible": False,
                }

    # Intentar backends en orden de preferencia
    if _tiene_openai_whisper():
        texto = await transcribir_con_openai_whisper(ruta_audio, idioma)
        if texto:
            return {"texto": texto, "idioma": idioma, "backend": "openai-whisper", "disponible": True}

    if _tiene_whisper_cpp():
        texto = await transcribir_con_whisper_cpp(ruta_audio)
        if texto:
            return {"texto": texto, "idioma": idioma, "backend": "whisper.cpp", "disponible": True}

    # Fallback
    log.warning(
        "Sin backend de transcripción. "
        "Instala con: pip install openai-whisper --break-system-packages"
    )
    return {
        "texto": (
            f"[Transcripción pendiente — archivo: {ruta.name}]\n"
            "Para activar: pip install openai-whisper"
        ),
        "idioma": idioma,
        "backend": "sin_transcripcion",
        "disponible": False,
    }


def backends_disponibles() -> dict:
    """Retorna qué backends de audio/video están instalados."""
    return {
        "ffmpeg": _tiene_ffmpeg(),
        "openai_whisper": _tiene_openai_whisper(),
        "whisper_cpp": _tiene_whisper_cpp(),
        "instalacion_recomendada": {
            "ffmpeg": "sudo apt install ffmpeg",
            "whisper": "pip install openai-whisper --break-system-packages",
        },
    }
