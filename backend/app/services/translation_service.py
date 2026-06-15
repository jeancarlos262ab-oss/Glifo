"""
translation_service.py — Glifo · Traducción automático EN→ES
=============================================================
Usa deep-translator (GoogleTranslator) con fallback graceful.

Instalación:
    pip install deep-translator

Si no hay conexión de red (ej. entorno offline), los textos
se devuelven sin modificar y se registra una advertencia.
"""

import logging
import time
from typing import Optional

log = logging.getLogger("glifo.translation")

# ── Estado de disponibilidad ──────────────────────────────────────
_translator_disponible: Optional[bool] = None   # None = no se ha probado todavía
_translator = None


def _init_translator():
    """Inicializa el traductor y cachea el resultado (disponible o no)."""
    global _translator_disponible, _translator
    if _translator_disponible is not None:
        return _translator_disponible

    try:
        from deep_translator import GoogleTranslator
        _translator = GoogleTranslator(source="en", target="es")
        # Prueba rápida
        _translator.translate("test")
        _translator_disponible = True
        log.info("✓ deep-translator activo (GoogleTranslator en→es)")
    except ImportError:
        log.warning("⚠ deep-translator no instalado. Ejecuta: pip install deep-translator")
        _translator_disponible = False
    except Exception as e:
        log.warning(f"⚠ deep-translator no disponible (sin red?): {e}")
        _translator_disponible = False

    return _translator_disponible


# ── Caché para evitar traducir lo mismo dos veces ─────────────────
_cache: dict[str, str] = {}
MAX_CACHE = 2000          # límite para no crecer indefinidamente


def traducir(texto: str, delay: float = 0.15) -> str:
    """
    Traduce texto de inglés a español.

    - Si el texto está vacío o ya en caché, lo devuelve directamente.
    - Si el traductor no está disponible, devuelve el texto original.
    - El parámetro `delay` da un respiro entre peticiones para no ser
      bloqueado por Google; 0.15 s es suficiente para uso en scripts.
    """
    if not texto or not texto.strip():
        return texto

    key = texto[:500]   # clave de caché (truncada para textos largos)
    if key in _cache:
        return _cache[key]

    if not _init_translator():
        return texto                 # fallback: devolver original

    try:
        # GoogleTranslator tiene límite de ~5 000 caracteres por llamada
        fragmento = texto[:4900] if len(texto) > 4900 else texto
        resultado = _translator.translate(fragmento)
        if delay:
            time.sleep(delay)

        if resultado:
            if len(_cache) >= MAX_CACHE:
                # Limpiar la mitad más vieja
                keys = list(_cache.keys())
                for k in keys[: MAX_CACHE // 2]:
                    del _cache[k]
            _cache[key] = resultado
            return resultado
    except Exception as e:
        log.debug(f"Error traduciendo: {e!r}  → usando original")

    return texto


def traducir_lista(items: list[str], delay: float = 0.1) -> list[str]:
    """Traduce una lista de strings cortos (p.ej. tags)."""
    return [traducir(i, delay) for i in items if i]


def traducir_entidades(entidades: dict) -> dict:
    """
    Traduce los valores de texto dentro del dict de entidades.

    Solo traduce listas de strings; las claves no se tocan para
    que el esquema siga siendo compatible con el modelo Pydantic.

    Ejemplo:
        {'persons': ['Aztec sculptor'], 'lugares': ['Mexico City']}
        → {'persons': ['Escultor azteca'], 'lugares': ['Ciudad de México']}
    """
    if not entidades:
        return entidades
    resultado = {}
    for clave, valor in entidades.items():
        if isinstance(valor, list):
            resultado[clave] = [traducir(v, delay=0.05) for v in valor if v]
        else:
            resultado[clave] = valor
    return resultado
