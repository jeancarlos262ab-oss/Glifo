"""
seed_opendata.py — Glifo · Cargador de datos desde APIs abiertas de museos
==========================================================================
Fuentes:
  1. The Metropolitan Museum of Art   (sin API key)
  2. Art Institute of Chicago         (sin API key)
  3. Cleveland Museum of Art          (sin API key)

GARANTIZA imagen en todas las piezas insertadas.

Uso:
  python seed_opendata.py                        # carga todo (20 por fuente)
  python seed_opendata.py --limit 100            # 100 por fuente
  python seed_opendata.py --fuente cma           # solo Cleveland
  python seed_opendata.py --limpiar-sin-imagen   # borra piezas sin imagen de la BD
  python seed_opendata.py --dry-run              # muestra sin insertar

Requisitos:
  pip install requests psycopg2-binary python-dotenv
"""

import argparse
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import requests
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

RAW_URL = os.getenv(
    "DATABASE_SYNC_URL",
    os.getenv("DATABASE_URL", "postgresql://glifo:glifo@localhost:5432/glifo"),
)
DB_URL = RAW_URL.replace("postgresql+asyncpg://", "postgresql://").replace(
    "postgresql+psycopg2://", "postgresql://"
)

TIMEOUT = 15
DELAY   = 0.2

# ── Terminal ──────────────────────────────────────────────────────────────────
def ok(msg):  print(f"  \033[32m✓\033[0m {msg}")
def err(msg): print(f"  \033[31m✗\033[0m {msg}")
def inf(msg): print(f"  \033[34m→\033[0m {msg}")
def warn(msg):print(f"  \033[33m!\033[0m {msg}")
def hdr(msg): print(f"\n\033[1m{msg}\033[0m")

def get_json(url, params=None):
    try:
        r = requests.get(url, params=params, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        err(f"GET {url[:80]} → {e}")
        return None

def tiene_imagen(url):
    """Verifica que la URL de imagen no esté vacía."""
    return bool(url and url.strip().startswith("http"))


# ══════════════════════════════════════════════════════════════════════════════
# 1. METROPOLITAN MUSEUM OF ART
# ══════════════════════════════════════════════════════════════════════════════
def fetch_met(limit: int) -> list[dict]:
    hdr("Metropolitan Museum of Art")

    # Queries con departamentos específicos para arte precolombino/latinoamericano
    # departmentId=5  → Arts of Africa, Oceania, and the Americas
    # departmentId=6  → Asian Art
    busquedas = [
        {"q": "aztec",           "hasImages": "true", "isPublicDomain": "true", "departmentId": "5"},
        {"q": "maya",            "hasImages": "true", "isPublicDomain": "true", "departmentId": "5"},
        {"q": "mesoamerica",     "hasImages": "true", "isPublicDomain": "true", "departmentId": "5"},
        {"q": "mexico",          "hasImages": "true", "isPublicDomain": "true", "departmentId": "5"},
        {"q": "olmec",           "hasImages": "true", "isPublicDomain": "true", "departmentId": "5"},
        {"q": "teotihuacan",     "hasImages": "true", "isPublicDomain": "true", "departmentId": "5"},
        {"q": "zapotec",         "hasImages": "true", "isPublicDomain": "true", "departmentId": "5"},
        {"q": "mixtec",          "hasImages": "true", "isPublicDomain": "true", "departmentId": "5"},
        {"q": "pre-columbian",   "hasImages": "true", "isPublicDomain": "true"},
        {"q": "colonial mexico", "hasImages": "true", "isPublicDomain": "true"},
    ]

    object_ids = []
    for params in busquedas:
        data = get_json(
            "https://collectionapi.metmuseum.org/public/collection/v1/search",
            params=params,
        )
        if data and data.get("objectIDs"):
            object_ids.extend(data["objectIDs"])
        if len(object_ids) >= limit * 5:
            break
        time.sleep(DELAY)

    object_ids = list(dict.fromkeys(object_ids))
    inf(f"IDs candidatos: {len(object_ids)}")

    piezas = []
    skipped = 0
    for oid in object_ids:
        if len(piezas) >= limit:
            break
        obj = get_json(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}")
        time.sleep(DELAY)
        if not obj or not obj.get("title"):
            continue

        # FILTRO CRÍTICO: saltar si no tiene imagen real
        img_url = obj.get("primaryImage") or ""
        if not tiene_imagen(img_url):
            skipped += 1
            continue

        medium         = (obj.get("medium") or "").lower()
        classification = (obj.get("classification") or "").lower()
        if "paper" in medium or "codex" in classification or "document" in classification:
            tipo = "documento"
        elif "photograph" in classification or "photo" in medium:
            tipo = "imagen"
        elif any(x in medium for x in ["sculpture", "ceramic", "stone", "jade", "gold", "copper"]):
            tipo = "objeto"
        else:
            tipo = "imagen"

        artista = obj.get("artistDisplayName", "")
        cultura = obj.get("culture", "")
        lugar   = obj.get("country") or obj.get("region") or obj.get("city") or ""
        periodo = obj.get("period", "")
        fecha   = obj.get("objectDate", "")

        entidades = {
            "personas":       [artista] if artista else [],
            "lugares":        [x for x in [lugar, cultura] if x],
            "fechas":         [x for x in [fecha, periodo] if x],
            "eventos":        [],
            "organizaciones": ["The Metropolitan Museum of Art"],
        }

        tags = []
        for field in [obj.get("medium"), obj.get("classification"),
                      obj.get("culture"), obj.get("dynasty"), obj.get("reign")]:
            if field:
                tags.append(str(field).lower())
        tags = list(dict.fromkeys(tags))[:8]

        anio = None
        begin = obj.get("objectBeginDate")
        end   = obj.get("objectEndDate")
        if begin and begin > 0:
            anio = begin
        elif end and end > 0:
            anio = end

        desc = (
            f"{obj.get('objectName','')} — {obj.get('culture','')} "
            f"({obj.get('period', obj.get('dynasty',''))}). "
            f"Técnica: {obj.get('medium','N/D')}. "
            f"Dimensiones: {obj.get('dimensions','N/D')}. "
            f"Departamento: {obj.get('department','')}."
        ).strip(" —.")

        piezas.append({
            "id":              f"met-{oid}",
            "titulo":          obj["title"][:512],
            "tipo":            tipo,
            "coleccion":       "Metropolitan Museum of Art",
            "descripcion":     desc[:2000],
            "texto_extraido":  None,
            "resumen":         None,
            "anio":            anio,
            "entidades":       entidades,
            "tags":            tags,
            "idioma":          "en",
            "score_relevancia":1.0,
            "archivo_nombre":  None,
            "archivo_ruta":    img_url,
            "archivo_tamano":  None,
            "archivo_mimetype":"image/jpeg",
            "estado":          "listo",
            "progreso":        100,
            "paso_actual":     None,
            "error_msg":       None,
            "num_conexiones":  0,
        })
        ok(f"[{len(piezas):02d}/{limit}] {obj['title'][:55]}")

    if skipped:
        warn(f"Saltadas {skipped} piezas sin imagen disponible")
    return piezas


# ══════════════════════════════════════════════════════════════════════════════
# 2. ART INSTITUTE OF CHICAGO
# ══════════════════════════════════════════════════════════════════════════════
def fetch_aic(limit: int) -> list[dict]:
    hdr("Art Institute of Chicago")

    fields = (
        "id,title,date_display,date_start,artist_display,place_of_origin,"
        "medium_display,dimensions,description,classification_title,"
        "image_id,artwork_type_title,term_titles,style_title,technique_titles"
    )

    queries = [
        "mexico", "mesoamerica", "aztec", "maya", "olmec",
        "teotihuacan", "zapotec", "mixtec", "pre-columbian",
        "latin america", "colonial", "inca", "moche",
    ]

    object_ids = []
    for q in queries:
        data = get_json(
            "https://api.artic.edu/api/v1/artworks/search",
            params={
                "q": q,
                "fields": "id,image_id",
                "limit": 40,
                "query[term][is_public_domain]": "true",
            },
        )
        if data and data.get("data"):
            # Solo tomar los que ya tienen image_id en la respuesta de búsqueda
            for d in data["data"]:
                if d.get("image_id"):
                    object_ids.append(str(d["id"]))
        if len(object_ids) >= limit * 4:
            break
        time.sleep(DELAY)

    object_ids = list(dict.fromkeys(object_ids))
    inf(f"IDs candidatos (con imagen): {len(object_ids)}")

    piezas = []
    for oid in object_ids:
        if len(piezas) >= limit:
            break
        wrap = get_json(f"https://api.artic.edu/api/v1/artworks/{oid}", params={"fields": fields})
        time.sleep(DELAY)
        if not wrap or not wrap.get("data"):
            continue
        obj = wrap["data"]
        if not obj.get("title") or not obj.get("image_id"):
            continue

        img_url = f"https://www.artic.edu/iiif/2/{obj['image_id']}/full/843,/0/default.jpg"

        art_type = (obj.get("artwork_type_title") or "").lower()
        if any(x in art_type for x in ["painting", "drawing", "print", "photograph"]):
            tipo = "imagen"
        elif any(x in art_type for x in ["sculpture", "vessel", "object", "ceramic", "textile"]):
            tipo = "objeto"
        elif any(x in art_type for x in ["document", "manuscript", "book"]):
            tipo = "documento"
        else:
            tipo = "imagen"

        artista = obj.get("artist_display", "")
        origen  = obj.get("place_of_origin", "")

        entidades = {
            "personas":       [artista.split("\n")[0]] if artista else [],
            "lugares":        [origen] if origen else [],
            "fechas":         [obj.get("date_display", "")] if obj.get("date_display") else [],
            "eventos":        [],
            "organizaciones": ["Art Institute of Chicago"],
        }

        tags = []
        for lst in [obj.get("term_titles", []), obj.get("technique_titles", [])]:
            tags.extend([t.lower() for t in (lst or []) if t])
        if obj.get("style_title"):
            tags.append(obj["style_title"].lower())
        tags = list(dict.fromkeys(tags))[:8]

        raw_desc  = obj.get("description") or ""
        desc_clean = re.sub(r"<[^>]+>", " ", raw_desc).strip()
        if not desc_clean:
            desc_clean = f"{obj.get('medium_display','')}, {obj.get('dimensions','')}".strip(", ")

        piezas.append({
            "id":              f"aic-{oid}",
            "titulo":          obj["title"][:512],
            "tipo":            tipo,
            "coleccion":       "Art Institute of Chicago",
            "descripcion":     desc_clean[:2000],
            "texto_extraido":  None,
            "resumen":         None,
            "anio":            obj.get("date_start"),
            "entidades":       entidades,
            "tags":            tags,
            "idioma":          "en",
            "score_relevancia":1.0,
            "archivo_nombre":  None,
            "archivo_ruta":    img_url,
            "archivo_tamano":  None,
            "archivo_mimetype":"image/jpeg",
            "estado":          "listo",
            "progreso":        100,
            "paso_actual":     None,
            "error_msg":       None,
            "num_conexiones":  0,
        })
        ok(f"[{len(piezas):02d}/{limit}] {obj['title'][:55]}")

    return piezas


# ══════════════════════════════════════════════════════════════════════════════
# 3. CLEVELAND MUSEUM OF ART
# ══════════════════════════════════════════════════════════════════════════════
def fetch_cma(limit: int) -> list[dict]:
    hdr("Cleveland Museum of Art")

    busquedas = [
        {"q": "mexico",        "has_image": 1, "cc0": 1, "limit": 30},
        {"q": "mesoamerica",   "has_image": 1, "cc0": 1, "limit": 30},
        {"q": "aztec",         "has_image": 1, "cc0": 1, "limit": 30},
        {"q": "maya",          "has_image": 1, "cc0": 1, "limit": 30},
        {"q": "pre-columbian", "has_image": 1, "cc0": 1, "limit": 30},
        {"culture": "Americas","has_image": 1, "cc0": 1, "limit": 50},
        {"culture": "Mexican", "has_image": 1, "cc0": 1, "limit": 30},
    ]

    piezas = []
    seen   = set()

    def to_str(v):
        if isinstance(v, list):
            return ", ".join(str(x) for x in v if x)
        return str(v) if v else ""

    for params in busquedas:
        if len(piezas) >= limit:
            break
        data = get_json("https://openaccess-api.clevelandart.org/api/artworks/", params=params)
        time.sleep(DELAY)
        if not data or not data.get("data"):
            continue

        for obj in data["data"]:
            if len(piezas) >= limit:
                break
            oid = obj.get("id")
            if not oid or oid in seen or not obj.get("title"):
                continue
            seen.add(oid)

            # FILTRO CRÍTICO: solo con imagen real
            images  = obj.get("images") or {}
            img_url = None
            for size in ["web", "print", "full"]:
                candidate = images.get(size, {})
                if isinstance(candidate, dict) and candidate.get("url"):
                    img_url = candidate["url"]
                    break
            if not tiene_imagen(img_url):
                continue

            art_type = (obj.get("type") or "").lower()
            if any(x in art_type for x in ["painting", "drawing", "print"]):
                tipo = "imagen"
            elif any(x in art_type for x in ["sculpture", "vessel", "ceramic", "textile"]):
                tipo = "objeto"
            elif any(x in art_type for x in ["manuscript", "document"]):
                tipo = "documento"
            else:
                tipo = "objeto"

            creators = obj.get("creators", []) or []
            artistas = [c.get("description", "") for c in creators if c.get("description")]
            lugar    = to_str(obj.get("culture") or obj.get("country") or "")

            entidades = {
                "personas":       artistas,
                "lugares":        [lugar] if lugar else [],
                "fechas":         [str(obj.get("creation_date", ""))] if obj.get("creation_date") else [],
                "eventos":        [],
                "organizaciones": ["Cleveland Museum of Art"],
            }

            tags_raw = []
            for field in [obj.get("technique"), obj.get("culture"), obj.get("department")]:
                if field:
                    val = to_str(field)
                    if val:
                        tags_raw.append(val.lower())
            tags = list(dict.fromkeys(tags_raw))[:8]

            desc = obj.get("wall_description") or obj.get("did_you_know") or \
                   f"{to_str(obj.get('technique',''))}, {to_str(obj.get('culture',''))}".strip(", ")

            anio = obj.get("creation_date_earliest") or obj.get("creation_date_latest")

            piezas.append({
                "id":              f"cma-{oid}",
                "titulo":          obj["title"][:512],
                "tipo":            tipo,
                "coleccion":       "Cleveland Museum of Art",
                "descripcion":     str(desc)[:2000] if desc else None,
                "texto_extraido":  None,
                "resumen":         None,
                "anio":            anio,
                "entidades":       entidades,
                "tags":            tags,
                "idioma":          "en",
                "score_relevancia":1.0,
                "archivo_nombre":  None,
                "archivo_ruta":    img_url,
                "archivo_tamano":  None,
                "archivo_mimetype":"image/jpeg",
                "estado":          "listo",
                "progreso":        100,
                "paso_actual":     None,
                "error_msg":       None,
                "num_conexiones":  0,
            })
            ok(f"[{len(piezas):02d}/{limit}] {obj['title'][:55]}")

    return piezas


# ══════════════════════════════════════════════════════════════════════════════
# LIMPIAR piezas sin imagen de la BD
# ══════════════════════════════════════════════════════════════════════════════
def limpiar_sin_imagen():
    hdr("Limpiando piezas sin imagen de la BD")
    inf(f"Conectando a: {DB_URL.split('@')[-1]}")
    try:
        conn = psycopg2.connect(DB_URL)
        cur  = conn.cursor()

        # Contar cuántas hay
        cur.execute("""
            SELECT COUNT(*) FROM piezas
            WHERE (archivo_ruta IS NULL OR archivo_ruta = '' OR archivo_ruta NOT LIKE 'http%')
              AND id LIKE 'met-%' OR id LIKE 'aic-%' OR id LIKE 'cma-%'
        """)
        total = cur.fetchone()[0]
        inf(f"Piezas de museos sin imagen: {total}")

        if total == 0:
            ok("No hay piezas sin imagen para limpiar.")
            cur.close(); conn.close()
            return

        cur.execute("""
            DELETE FROM piezas
            WHERE (archivo_ruta IS NULL OR archivo_ruta = '' OR archivo_ruta NOT LIKE 'http%')
              AND (id LIKE 'met-%' OR id LIKE 'aic-%' OR id LIKE 'cma-%')
        """)
        deleted = cur.rowcount
        conn.commit()
        cur.close(); conn.close()
        ok(f"Eliminadas {deleted} piezas sin imagen.")
    except psycopg2.OperationalError as e:
        err(f"No se pudo conectar: {e}")
        sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# INSERCIÓN EN POSTGRESQL
# ══════════════════════════════════════════════════════════════════════════════
INSERT_SQL = """
INSERT INTO piezas (
    id, titulo, tipo, coleccion, descripcion, texto_extraido, resumen,
    anio, entidades, tags, idioma, score_relevancia,
    archivo_nombre, archivo_ruta, archivo_tamano, archivo_mimetype,
    estado, progreso, paso_actual, error_msg, num_conexiones,
    creado_en, actualizado_en
) VALUES (
    %(id)s, %(titulo)s, %(tipo)s, %(coleccion)s, %(descripcion)s,
    %(texto_extraido)s, %(resumen)s, %(anio)s,
    %(entidades)s, %(tags)s, %(idioma)s, %(score_relevancia)s,
    %(archivo_nombre)s, %(archivo_ruta)s, %(archivo_tamano)s, %(archivo_mimetype)s,
    %(estado)s, %(progreso)s, %(paso_actual)s, %(error_msg)s, %(num_conexiones)s,
    %(creado_en)s, %(actualizado_en)s
)
ON CONFLICT (id) DO UPDATE SET
    titulo          = EXCLUDED.titulo,
    descripcion     = EXCLUDED.descripcion,
    entidades       = EXCLUDED.entidades,
    tags            = EXCLUDED.tags,
    archivo_ruta    = EXCLUDED.archivo_ruta,
    archivo_mimetype= EXCLUDED.archivo_mimetype,
    actualizado_en  = EXCLUDED.actualizado_en;
"""

def insertar_piezas(piezas: list[dict], dry_run: bool = False) -> tuple[int, int]:
    ahora = datetime.now(timezone.utc)
    for p in piezas:
        p["creado_en"]      = ahora
        p["actualizado_en"] = ahora
        p["entidades"]      = json.dumps(p["entidades"], ensure_ascii=False)
        p["tags"]           = json.dumps(p["tags"],      ensure_ascii=False)

    if dry_run:
        hdr("DRY RUN — piezas que se insertarían")
        for p in piezas:
            img = "✓ img" if tiene_imagen(p.get("archivo_ruta")) else "✗ sin"
            print(f"  {p['id']:20s} | {p['tipo']:10s} | {img} | {p['titulo'][:45]}")
        return len(piezas), 0

    hdr(f"Insertando {len(piezas)} piezas en PostgreSQL")
    inf(f"Conectando a: {DB_URL.split('@')[-1]}")

    ok_count = err_count = 0
    try:
        conn = psycopg2.connect(DB_URL)
        conn.autocommit = False
        cur  = conn.cursor()

        for p in piezas:
            try:
                cur.execute(INSERT_SQL, p)
                ok_count += 1
            except Exception as e:
                err(f"  {p['id']} → {e}")
                conn.rollback()
                err_count += 1
                continue

        conn.commit()
        cur.close()
        conn.close()
        ok(f"Commit exitoso: {ok_count} insertadas / actualizadas")

    except psycopg2.OperationalError as e:
        err(f"No se pudo conectar a la BD: {e}")
        sys.exit(1)

    return ok_count, err_count


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="Carga datos de museos en Glifo")
    parser.add_argument("--limit",              type=int, default=20)
    parser.add_argument("--fuente",             choices=["met","aic","cma","todas"], default="todas")
    parser.add_argument("--dry-run",            action="store_true")
    parser.add_argument("--skip-met",           action="store_true")
    parser.add_argument("--skip-aic",           action="store_true")
    parser.add_argument("--skip-cma",           action="store_true")
    parser.add_argument("--limpiar-sin-imagen", action="store_true",
                        help="Elimina de la BD las piezas de museos sin imagen y sale")
    args = parser.parse_args()

    print("\n" + "═"*60)
    print("  Glifo — Cargador de datos abiertos de museos")
    print("═"*60)

    if args.limpiar_sin_imagen:
        limpiar_sin_imagen()
        return

    print(f"  Fuentes: {args.fuente} | Límite: {args.limit} | DB: {DB_URL.split('@')[-1]}\n")

    todas = []
    if args.fuente in ("met","todas") and not args.skip_met:
        todas.extend(fetch_met(args.limit))
    if args.fuente in ("aic","todas") and not args.skip_aic:
        todas.extend(fetch_aic(args.limit))
    if args.fuente in ("cma","todas") and not args.skip_cma:
        todas.extend(fetch_cma(args.limit))

    con_img = [p for p in todas if tiene_imagen(p.get("archivo_ruta"))]
    sin_img  = len(todas) - len(con_img)

    print(f"\n  Total obtenido: {len(todas)} | Con imagen: {len(con_img)} | Sin imagen (descartadas): {sin_img}")

    ok_n, err_n = insertar_piezas(con_img, dry_run=args.dry_run)

    print("\n" + "═"*60)
    print(f"  ✓ Completado — {ok_n} insertadas, {err_n} errores")
    print("═"*60 + "\n")

if __name__ == "__main__":
    main()