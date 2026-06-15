"""
fix_pieces.py — Parcha _archivo_url en app/api/v1/pieces.py
para que devuelva URLs externas (http/https) tal cual,
sin pegarles el prefijo del servidor local.

Uso:  python fix_pieces.py
"""
import sys
from pathlib import Path

TARGET = Path("app/api/v1/pieces.py")

if not TARGET.exists():
    print(f"ERROR: No encuentro {TARGET}")
    print("Asegúrate de correr este script desde la raíz del proyecto (donde está run.py)")
    sys.exit(1)

OLD = '''def _archivo_url(pieza: Pieza) -> Optional[str]:
    """Construye la URL pública del archivo original."""
    if not pieza.archivo_ruta:
        return None
    ruta = pieza.archivo_ruta.replace("\\\\", "/")
    # Normalizar: quitar ./ o / del inicio y dejar uploads/...
    for prefix in ("./", "/"):
        if ruta.startswith(prefix):
            ruta = ruta[len(prefix):]
    return f"{BASE_URL}/{ruta}"'''

NEW = '''def _archivo_url(pieza: Pieza) -> Optional[str]:
    """Construye la URL pública del archivo original.

    - Si archivo_ruta es una URL externa (http/https) la devuelve tal cual.
      Esto aplica a piezas cargadas desde APIs abiertas de museos (Met, AIC, CMA).
    - Si es una ruta local la construye relativa al servidor.
    """
    if not pieza.archivo_ruta:
        return None
    ruta = pieza.archivo_ruta.strip()
    # URL externa → devolver directo
    if ruta.startswith("http://") or ruta.startswith("https://"):
        return ruta
    # Ruta local → normalizar y construir URL del servidor
    ruta = ruta.replace("\\\\", "/")
    for prefix in ("./", "/"):
        if ruta.startswith(prefix):
            ruta = ruta[len(prefix):]
    return f"{BASE_URL}/{ruta}"'''

content = TARGET.read_text(encoding="utf-8")

if OLD not in content:
    # Verificar si ya fue aplicado
    if "URL externa → devolver directo" in content:
        print("✓ El parche ya estaba aplicado, no se necesita nada.")
    else:
        print("ERROR: No se encontró el bloque exacto a reemplazar.")
        print("Puede que pieces.py haya sido modificado. Aplica manualmente:")
        print()
        print(NEW)
    sys.exit(0)

patched = content.replace(OLD, NEW)
TARGET.write_text(patched, encoding="utf-8")
print(f"✓ {TARGET} parcheado correctamente.")
print("  Las URLs externas de imagen ahora se devuelven tal cual en archivo_url.")
