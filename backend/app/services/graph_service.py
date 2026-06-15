"""
Servicio de Grafo de Conocimiento.
Usa NetworkX en memoria como sustituto ligero de Neo4j.
NO persiste el grafo en disco - solo en RAM.
"""
from __future__ import annotations
import logging
from typing import Optional
import networkx as nx

log = logging.getLogger(__name__)

_grafo: Optional[nx.Graph] = None


def _cargar_grafo() -> nx.Graph:
    """Crea o retorna el grafo en memoria (sin disco)."""
    global _grafo
    if _grafo is None:
        _grafo = nx.Graph()
        log.info("Grafo inicializado en memoria (sin persistencia)")
    return _grafo


def resetear_grafo() -> None:
    """Descarta completamente el grafo en memoria."""
    global _grafo
    _grafo = nx.Graph()
    log.info("Grafo reiniciado en memoria")


def agregar_nodo(pieza_id: str, metadata: dict) -> None:
    """Agrega o actualiza un nodo en el grafo."""
    g = _cargar_grafo()
    g.add_node(pieza_id, **metadata)


def agregar_nodos_batch(nodos: list[tuple[str, dict]]) -> None:
    """Agrega múltiples nodos en un solo paso."""
    g = _cargar_grafo()
    for pieza_id, metadata in nodos:
        g.add_node(pieza_id, **metadata)


def agregar_relacion(id_origen: str, id_destino: str, tipo: str, peso: float = 1.0) -> None:
    """Crea una arista entre dos piezas."""
    g = _cargar_grafo()
    if g.has_node(id_origen) and g.has_node(id_destino):
        if g.has_edge(id_origen, id_destino):
            g[id_origen][id_destino]["peso"] = max(
                g[id_origen][id_destino].get("peso", 1.0), peso
            )
        else:
            g.add_edge(id_origen, id_destino, tipo=tipo, peso=peso)


def encontrar_relacionados(pieza_id: str, profundidad: int = 2) -> list[dict]:
    """
    Retorna nodos relacionados hasta N niveles de profundidad.
    Incluye el tipo y peso de cada relación.
    """
    g = _cargar_grafo()
    if not g.has_node(pieza_id):
        return []

    relacionados = []
    visitados = {pieza_id}

    cola = [(pieza_id, 0)]
    while cola:
        nodo_actual, nivel = cola.pop(0)
        if nivel >= profundidad:
            continue
        for vecino in g.neighbors(nodo_actual):
            if vecino not in visitados:
                visitados.add(vecino)
                arista = g[nodo_actual][vecino]
                nodo_data = dict(g.nodes[vecino])
                relacionados.append({
                    "id": vecino,
                    "titulo": nodo_data.get("titulo", vecino),
                    "tipo": nodo_data.get("tipo", "desconocido"),
                    "coleccion": nodo_data.get("coleccion", ""),
                    "relacion_tipo": arista.get("tipo", "relacionado"),
                    "relacion_peso": arista.get("peso", 1.0),
                    "nivel": nivel + 1,
                })
                cola.append((vecino, nivel + 1))

    return sorted(relacionados, key=lambda x: -x["relacion_peso"])


def calcular_conexiones(pieza_id: str) -> int:
    """Retorna el número de conexiones directas de una pieza."""
    g = _cargar_grafo()
    if not g.has_node(pieza_id):
        return 0
    return g.degree(pieza_id)


def datos_grafo_completo() -> dict:
    """Retorna nodos y aristas para visualización en D3.js / Cytoscape."""
    g = _cargar_grafo()
    nodos = []
    for nodo_id, data in g.nodes(data=True):
        nodos.append({
            "id": nodo_id,
            "titulo": data.get("titulo", nodo_id),
            "tipo": data.get("tipo", "documento"),
            "coleccion": data.get("coleccion", ""),
            "tags": data.get("tags", []),
            "conexiones": g.degree(nodo_id),
        })

    aristas = []
    for origen, destino, data in g.edges(data=True):
        aristas.append({
            "source": origen,
            "target": destino,
            "tipo": data.get("tipo", "relacionado"),
            "peso": data.get("peso", 1.0),
        })

    return {
        "nodos": nodos,
        "aristas": aristas,
        "total_nodos": g.number_of_nodes(),
        "total_aristas": g.number_of_edges(),
    }


def construir_relaciones_automaticas(pieza_id: str, entidades: dict, tags: list[str]) -> None:
    """
    Conecta automáticamente una pieza nueva con piezas existentes
    basándose en entidades y tags compartidos.
    """
    g = _cargar_grafo()
    if not g.has_node(pieza_id):
        return

    tags_set = set(t.lower() for t in (tags or []))
    entidades_set = set()
    for vals in (entidades or {}).values():
        if isinstance(vals, list):
            entidades_set.update(v.lower() for v in vals)

    for otro_id, data in g.nodes(data=True):
        if otro_id == pieza_id:
            continue

        otro_tags = set(t.lower() for t in data.get("tags", []))
        otro_entidades_raw = data.get("entidades", {})
        otro_entidades = set()
        if isinstance(otro_entidades_raw, dict):
            for vals in otro_entidades_raw.values():
                if isinstance(vals, list):
                    otro_entidades.update(v.lower() for v in vals)

        tags_comunes = tags_set & otro_tags
        entidades_comunes = entidades_set & otro_entidades
        total_comunes = len(tags_comunes) + len(entidades_comunes) * 2

        if total_comunes >= 2:
            tipo_relacion = "entidad_compartida" if entidades_comunes else "tags_compartidos"
            peso = min(1.0, total_comunes / 10)
            if g.has_edge(pieza_id, otro_id):
                g[pieza_id][otro_id]["peso"] = max(
                    g[pieza_id][otro_id].get("peso", 1.0), peso
                )
            else:
                g.add_edge(pieza_id, otro_id, tipo=tipo_relacion, peso=peso)


def construir_todas_relaciones_y_guardar(piezas_meta: list[dict]) -> int:
    """
    Reconstruye TODAS las relaciones automáticas de golpe.
    piezas_meta: lista de dicts con keys pieza_id, entidades, tags.
    Retorna el número de aristas creadas.
    """
    g = _cargar_grafo()
    antes = g.number_of_edges()

    for item in piezas_meta:
        pieza_id = item["pieza_id"]
        entidades = item.get("entidades") or {}
        tags = item.get("tags") or []

        if not g.has_node(pieza_id):
            continue

        tags_set = set(t.lower() for t in tags)
        entidades_set = set()
        for vals in entidades.values():
            if isinstance(vals, list):
                entidades_set.update(v.lower() for v in vals)

        for otro_id, data in g.nodes(data=True):
            if otro_id == pieza_id:
                continue

            otro_tags = set(t.lower() for t in data.get("tags", []))
            otro_ent_raw = data.get("entidades", {})
            otro_ent = set()
            if isinstance(otro_ent_raw, dict):
                for vals in otro_ent_raw.values():
                    if isinstance(vals, list):
                        otro_ent.update(v.lower() for v in vals)

            tags_comunes = tags_set & otro_tags
            ent_comunes = entidades_set & otro_ent
            total = len(tags_comunes) + len(ent_comunes) * 2

            if total >= 2:
                tipo_rel = "entidad_compartida" if ent_comunes else "tags_compartidos"
                peso = min(1.0, total / 10)
                if g.has_edge(pieza_id, otro_id):
                    g[pieza_id][otro_id]["peso"] = max(
                        g[pieza_id][otro_id].get("peso", 1.0), peso
                    )
                else:
                    g.add_edge(pieza_id, otro_id, tipo=tipo_rel, peso=peso)

    return g.number_of_edges() - antes


def estadisticas_grafo() -> dict:
    """Estadísticas generales del grafo."""
    g = _cargar_grafo()
    if g.number_of_nodes() == 0:
        return {"nodos": 0, "aristas": 0, "densidad": 0, "componentes": 0}

    try:
        componentes = nx.number_connected_components(g)
    except Exception:
        componentes = 0

    # Obtener nodo más conectado de forma segura
    if g.number_of_nodes() > 0:
        nodo_mas_conectado = max(g.degree(), key=lambda x: x[1], default=("", 0))[0]
    else:
        nodo_mas_conectado = ""

    return {
        "nodos": g.number_of_nodes(),
        "aristas": g.number_of_edges(),
        "densidad": round(nx.density(g), 4),
        "componentes": componentes,
        "nodo_mas_conectado": nodo_mas_conectado,
    }


def limpiar_grafo() -> None:
    """Elimina todos los nodos y aristas del grafo en memoria."""
    global _grafo
    _grafo = nx.Graph()
    log.info("Grafo limpiado completamente")


def obtener_tamanio_memoria_estimado() -> int:
    """Retorna tamaño estimado del grafo en número de elementos."""
    g = _cargar_grafo()
    return g.number_of_nodes() + g.number_of_edges()