"""
Punto de entrada para desarrollo.
Ejecutar: python run.py
"""
import uvicorn

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════╗
║  ■■ GLIFO — Backend                              ║
║  Plataforma de Preservación del Patrimonio       ║
║  HackatónARPA · BUAP 2026                        ║
╠══════════════════════════════════════════════════╣
║  API:  http://localhost:8000/api/v1              ║
║  Docs: http://localhost:8000/docs                ║
║  Health: http://localhost:8000/health            ║
╚══════════════════════════════════════════════════╝
""")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
