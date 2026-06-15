"""
Servicio de Búsqueda Semántica.
Almacena embeddings en archivo JSON como fallback ligero cuando no hay pgvector.
Para producción real usar pgvector (la función SQL está comentada al fondo).
"""
from __future__ import annotations
import json
import logging
import math
from pathlib import Path
from typing import Optional

from app.services.ollama_service import embed_texto

log = logging.getLogger(__name__)

EMBEDDINGS_PATH = Path("./data/embeddings.json")


def _cargar_embeddings() -> dict[str, list[float]]:
    """Carga el índice de embeddings desde disco."""
    if EMBEDDINGS_PATH.exists():
        try:
            with open(EMBEDDINGS_PATH) as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _guardar_embeddings(index: dict[str, list[float]]) -> None:
    EMBEDDINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(EMBEDDINGS_PATH, "w") as f:
        json.dump(index, f)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Similitud coseno entre dos vectores."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


async def indexar_pieza(pieza_id: str, texto: str, metadata: dict) -> bool:
    """
    Genera el embedding de una pieza y lo añade al índice.
    El texto debe ser la concatenación de título + descripción + texto extraído.
    """
    try:
        embedding = await embed_texto(texto)
        index = _cargar_embeddings()
        index[pieza_id] = {
            "vector": embedding,
            "titulo": metadata.get("titulo", ""),
            "tipo": metadata.get("tipo", ""),
            "coleccion": metadata.get("coleccion", ""),
            "anio": metadata.get("anio"),
            "tags": metadata.get("tags", []),
            "entidades": metadata.get("entidades", {}),
            "descripcion": metadata.get("descripcion", ""),
            "num_conexiones": metadata.get("num_conexiones", 0),
        }
        _guardar_embeddings(index)
        log.info(f"Pieza {pieza_id[:8]} indexada en búsqueda semántica")
        return True
    except Exception as e:
        log.error(f"Error indexando pieza {pieza_id}: {e}")
        return False


async def buscar_semantico(
    query: str,
    top_k: int = 10,
    tipo_filtro: Optional[str] = None,
    coleccion_filtro: Optional[str] = None,
) -> list[dict]:
    """
    Busca piezas semánticamente similares a la query.
    Retorna lista ordenada por score descendente.
    """
    if not query.strip():
        return []

    query_vec = await embed_texto(query)
    index = _cargar_embeddings()

    resultados = []
    for pieza_id, data in index.items():
        # Aplicar filtros
        if tipo_filtro and data.get("tipo") != tipo_filtro:
            continue
        if coleccion_filtro and data.get("coleccion") != coleccion_filtro:
            continue

        vec = data.get("vector", [])
        score = _cosine_similarity(query_vec, vec)

        if score > 0.3:  # umbral mínimo de relevancia
            resultados.append({
                "id": pieza_id,
                "titulo": data.get("titulo", ""),
                "tipo": data.get("tipo", "documento"),
                "coleccion": data.get("coleccion", ""),
                "descripcion": data.get("descripcion", ""),
                "anio": data.get("anio"),
                "tags": data.get("tags", []),
                "entidades": data.get("entidades", {}),
                "num_conexiones": data.get("num_conexiones", 0),
                "score": round(score, 4),
            })

    resultados.sort(key=lambda x: -x["score"])
    return resultados[:top_k]


async def buscar_por_imagen(ruta_imagen: str, top_k: int = 5) -> list[dict]:
    """
    Búsqueda por similitud visual.
    Genera descripción de la imagen con llava y luego busca semánticamente.
    """
    from app.services.ollama_service import describir_imagen
    descripcion = await describir_imagen(ruta_imagen)
    return await buscar_semantico(descripcion, top_k=top_k)


def eliminar_del_indice(pieza_id: str) -> None:
    """Elimina una pieza del índice de búsqueda."""
    index = _cargar_embeddings()
    if pieza_id in index:
        del index[pieza_id]
        _guardar_embeddings(index)


def estadisticas_indice() -> dict:
    index = _cargar_embeddings()
    tipos: dict[str, int] = {}
    for data in index.values():
        t = data.get("tipo", "desconocido")
        tipos[t] = tipos.get(t, 0) + 1
    return {"total_indexadas": len(index), "por_tipo": tipos}
