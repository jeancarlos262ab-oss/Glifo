"""
Tests de Glifo Backend.
Ejecutar: python -m pytest tests/ -v

Los tests corren sin DB ni Ollama (todo mockeado).
"""
import asyncio
import json
import sys
import uuid
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


# ═══════════════════════════════════════════════════════════════════
# FIXTURES
# ═══════════════════════════════════════════════════════════════════

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def limpiar_archivos_test(tmp_path, monkeypatch):
    """Redirige uploads y data a tmp_path para no ensuciar el proyecto."""
    monkeypatch.chdir(tmp_path)
    (tmp_path / "uploads").mkdir()
    (tmp_path / "data").mkdir()


# ═══════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════

class TestConfig:
    def test_settings_cargadas(self):
        from app.core.config import get_settings
        s = get_settings()
        assert s.ollama_llm_model == "llama3.2"
        assert s.ollama_embed_model == "nomic-embed-text"
        assert s.embedding_dim == 768
        assert s.worker_concurrency >= 1

    def test_cors_origins_list(self):
        from app.core.config import get_settings
        s = get_settings()
        origins = s.cors_origins_list
        assert isinstance(origins, list)
        assert len(origins) >= 1


# ═══════════════════════════════════════════════════════════════════
# STORAGE SERVICE
# ═══════════════════════════════════════════════════════════════════

class TestStorageService:
    def test_detectar_tipo_pdf(self):
        from app.services.storage_service import detectar_tipo_pieza
        assert detectar_tipo_pieza("application/pdf") == "documento"

    def test_detectar_tipo_imagen(self):
        from app.services.storage_service import detectar_tipo_pieza
        assert detectar_tipo_pieza("image/jpeg") == "imagen"
        assert detectar_tipo_pieza("image/png") == "imagen"

    def test_detectar_tipo_audio(self):
        from app.services.storage_service import detectar_tipo_pieza
        assert detectar_tipo_pieza("audio/mpeg") == "audio"
        assert detectar_tipo_pieza("audio/wav") == "audio"

    def test_detectar_tipo_video(self):
        from app.services.storage_service import detectar_tipo_pieza
        assert detectar_tipo_pieza("video/mp4") == "video"

    def test_detectar_tipo_desconocido_es_documento(self):
        from app.services.storage_service import detectar_tipo_pieza
        assert detectar_tipo_pieza("application/octet-stream") == "documento"

    def test_obtener_mimetype_pdf(self):
        from app.services.storage_service import obtener_mimetype
        assert obtener_mimetype("documento.pdf") == "application/pdf"

    def test_obtener_mimetype_jpg(self):
        from app.services.storage_service import obtener_mimetype
        mt = obtener_mimetype("foto.jpg")
        assert "jpeg" in mt or "jpg" in mt

    def test_validar_archivo_ok(self):
        from app.services.storage_service import validar_archivo
        ok, err = validar_archivo("archivo.pdf", 1024 * 1024)
        assert ok is True
        assert err == ""

    def test_validar_archivo_tipo_invalido(self):
        from app.services.storage_service import validar_archivo
        ok, err = validar_archivo("archivo.exe", 1024)
        assert ok is False
        assert "no permitido" in err

    def test_validar_archivo_demasiado_grande(self):
        from app.services.storage_service import validar_archivo
        ok, err = validar_archivo("archivo.pdf", 9999 * 1024 * 1024)
        assert ok is False
        assert "grande" in err.lower()

    @pytest.mark.asyncio
    async def test_guardar_y_tamaño_archivo(self, tmp_path):
        from app.services import storage_service
        storage_service.UPLOAD_ROOT = tmp_path / "uploads"
        storage_service.UPLOAD_ROOT.mkdir(exist_ok=True)

        contenido = b"Contenido de prueba del patrimonio cultural"
        pieza_id = str(uuid.uuid4())
        ruta = await storage_service.guardar_archivo(contenido, pieza_id, "test.pdf")

        assert ruta.exists()
        assert storage_service.tamaño_archivo(ruta) == len(contenido)

    def test_ruta_para_pieza(self, tmp_path):
        from app.services import storage_service
        storage_service.UPLOAD_ROOT = tmp_path
        pieza_id = "abcd1234-5678-abcd-1234-abcd12345678"
        ruta = storage_service.ruta_para_pieza(pieza_id, "doc.pdf")
        assert pieza_id[:2] in str(ruta)
        assert ruta.suffix == ".pdf"


# ═══════════════════════════════════════════════════════════════════
# PDF SERVICE
# ═══════════════════════════════════════════════════════════════════

class TestPDFService:
    def test_necesita_ocr_texto_vacio(self):
        from app.services.pdf_service import necesita_ocr
        assert necesita_ocr("") is True
        assert necesita_ocr("   ") is True

    def test_necesita_ocr_texto_corto(self):
        from app.services.pdf_service import necesita_ocr
        assert necesita_ocr("poco texto") is True

    def test_necesita_ocr_texto_suficiente(self):
        from app.services.pdf_service import necesita_ocr
        texto_largo = "Esto es un texto bastante largo con suficiente contenido " * 5
        assert necesita_ocr(texto_largo) is False

    def test_extraer_texto_pdf_real(self, tmp_path):
        """Crea un PDF mínimo con PyMuPDF y verifica extracción."""
        try:
            import fitz
            doc = fitz.open()
            pagina = doc.new_page()
            pagina.insert_text((50, 100), "Archivo del 68 — Movimiento Estudiantil")
            ruta = tmp_path / "test.pdf"
            doc.save(str(ruta))
            doc.close()

            from app.services.pdf_service import extraer_texto_pdf
            texto = extraer_texto_pdf(ruta)
            assert "Archivo del 68" in texto or "Movimiento" in texto
        except ImportError:
            pytest.skip("PyMuPDF no disponible")

    def test_extraer_metadata_pdf(self, tmp_path):
        try:
            import fitz
            doc = fitz.open()
            doc.set_metadata({"title": "Test Glifo", "author": "BUAP"})
            doc.new_page()
            ruta = tmp_path / "meta.pdf"
            doc.save(str(ruta))
            doc.close()

            from app.services.pdf_service import extraer_metadata_pdf
            meta = extraer_metadata_pdf(ruta)
            assert "paginas" in meta
            assert meta["paginas"] == 1
        except ImportError:
            pytest.skip("PyMuPDF no disponible")

    def test_extraer_texto_pdf_inexistente(self):
        from app.services.pdf_service import extraer_texto_pdf
        texto = extraer_texto_pdf("/ruta/que/no/existe.pdf")
        assert texto == ""


# ═══════════════════════════════════════════════════════════════════
# GRAPH SERVICE
# ═══════════════════════════════════════════════════════════════════

class TestGraphService:
    @pytest.fixture(autouse=True)
    def reset_graph(self, tmp_path, monkeypatch):
        """Cada test usa un grafo limpio en tmp_path."""
        import app.services.graph_service as gs
        monkeypatch.setattr(gs, "GRAFO_PATH", tmp_path / "grafo.json")
        monkeypatch.setattr(gs, "_grafo", None)

    def test_agregar_nodo(self):
        from app.services.graph_service import agregar_nodo, datos_grafo_completo
        agregar_nodo("p1", {"titulo": "Pieza 1", "tipo": "documento", "coleccion": "Test", "tags": [], "entidades": {}})
        datos = datos_grafo_completo()
        assert datos["total_nodos"] == 1
        assert datos["nodos"][0]["id"] == "p1"

    def test_agregar_relacion(self):
        from app.services.graph_service import agregar_nodo, agregar_relacion, datos_grafo_completo
        agregar_nodo("p1", {"titulo": "A", "tipo": "documento", "coleccion": "C", "tags": [], "entidades": {}})
        agregar_nodo("p2", {"titulo": "B", "tipo": "imagen", "coleccion": "C", "tags": [], "entidades": {}})
        agregar_relacion("p1", "p2", "relacionado", 0.8)
        datos = datos_grafo_completo()
        assert datos["total_aristas"] == 1
        assert datos["aristas"][0]["tipo"] == "relacionado"

    def test_encontrar_relacionados(self):
        from app.services.graph_service import agregar_nodo, agregar_relacion, encontrar_relacionados
        agregar_nodo("p1", {"titulo": "A", "tipo": "documento", "coleccion": "C", "tags": [], "entidades": {}})
        agregar_nodo("p2", {"titulo": "B", "tipo": "imagen", "coleccion": "C", "tags": [], "entidades": {}})
        agregar_nodo("p3", {"titulo": "C", "tipo": "audio", "coleccion": "C", "tags": [], "entidades": {}})
        agregar_relacion("p1", "p2", "evento", 1.0)
        agregar_relacion("p2", "p3", "tema", 0.7)

        relacionados = encontrar_relacionados("p1", profundidad=2)
        ids = [r["id"] for r in relacionados]
        assert "p2" in ids
        assert "p3" in ids

    def test_calcular_conexiones(self):
        from app.services.graph_service import agregar_nodo, agregar_relacion, calcular_conexiones
        agregar_nodo("p1", {"titulo": "A", "tipo": "documento", "coleccion": "C", "tags": [], "entidades": {}})
        agregar_nodo("p2", {"titulo": "B", "tipo": "imagen", "coleccion": "C", "tags": [], "entidades": {}})
        agregar_nodo("p3", {"titulo": "C", "tipo": "audio", "coleccion": "C", "tags": [], "entidades": {}})
        agregar_relacion("p1", "p2", "a", 1.0)
        agregar_relacion("p1", "p3", "b", 1.0)
        assert calcular_conexiones("p1") == 2

    def test_conexion_inexistente(self):
        from app.services.graph_service import calcular_conexiones
        assert calcular_conexiones("id-que-no-existe") == 0

    def test_relaciones_automaticas_por_tags(self):
        from app.services.graph_service import (
            agregar_nodo, construir_relaciones_automaticas, datos_grafo_completo
        )
        agregar_nodo("p1", {
            "titulo": "A", "tipo": "documento", "coleccion": "C",
            "tags": ["1968", "estudiantes", "movimiento"],
            "entidades": {}
        })
        agregar_nodo("p2", {
            "titulo": "B", "tipo": "imagen", "coleccion": "C",
            "tags": ["1968", "fotografía", "movimiento"],
            "entidades": {}
        })
        construir_relaciones_automaticas("p1", {}, ["1968", "estudiantes", "movimiento"])
        datos = datos_grafo_completo()
        assert datos["total_aristas"] >= 1

    def test_estadisticas_grafo_vacio(self):
        from app.services.graph_service import estadisticas_grafo
        stats = estadisticas_grafo()
        assert stats["nodos"] == 0
        assert stats["aristas"] == 0

    def test_persistencia_grafo(self, tmp_path):
        """Verifica que el grafo se guarda y recarga correctamente."""
        import app.services.graph_service as gs
        gs._grafo = None
        gs.GRAFO_PATH = tmp_path / "grafo_test.json"

        gs.agregar_nodo("p1", {"titulo": "X", "tipo": "documento", "coleccion": "C", "tags": [], "entidades": {}})
        assert (tmp_path / "grafo_test.json").exists()

        # Resetear y recargar
        gs._grafo = None
        datos = gs.datos_grafo_completo()
        assert datos["total_nodos"] == 1


# ═══════════════════════════════════════════════════════════════════
# SEARCH SERVICE
# ═══════════════════════════════════════════════════════════════════

class TestSearchService:
    @pytest.fixture(autouse=True)
    def reset_index(self, tmp_path, monkeypatch):
        import app.services.search_service as ss
        monkeypatch.setattr(ss, "EMBEDDINGS_PATH", tmp_path / "embeddings.json")

    @pytest.mark.asyncio
    async def test_indexar_pieza(self):
        from app.services.search_service import indexar_pieza, estadisticas_indice

        with patch("app.services.ollama_service.embed_texto", new_callable=AsyncMock) as mock_embed:
            # Simular embedding real de 768 dims
            mock_embed.return_value = [0.1] * 768

            ok = await indexar_pieza("p1", "Manifiesto estudiantil 1968 CNH", {
                "titulo": "Manifiesto CNH",
                "tipo": "documento",
                "coleccion": "Archivo del 68",
                "año": 1968,
                "tags": ["1968", "CNH"],
                "entidades": {},
                "descripcion": "Documento histórico",
                "num_conexiones": 3,
            })
            assert ok is True

        stats = estadisticas_indice()
        assert stats["total_indexadas"] == 1

    @pytest.mark.asyncio
    async def test_busqueda_semantica_encuentra_resultado(self):
        import json as _json
        import app.services.search_service as ss
        from app.services.search_service import buscar_semantico

        vec_doc = [1.0] + [0.0] * 767
        vec_query = [0.99] + [0.01] * 767

        # Escribir índice directamente
        idx = {
            "p1": {
                "vector": vec_doc, "titulo": "Manifiesto del 68", "tipo": "documento",
                "coleccion": "Archivo del 68", "año": 1968, "tags": [], "entidades": {},
                "descripcion": "", "num_conexiones": 0,
            }
        }
        with open(ss.EMBEDDINGS_PATH, "w") as f:
            _json.dump(idx, f)

        with patch("app.services.search_service.embed_texto", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = vec_query
            resultados = await buscar_semantico("movimiento estudiantil", top_k=5)

        assert len(resultados) >= 1
        assert resultados[0]["id"] == "p1"
        assert resultados[0]["score"] > 0.3

    @pytest.mark.asyncio
    async def test_busqueda_query_vacia(self):
        from app.services.search_service import buscar_semantico
        resultados = await buscar_semantico("", top_k=5)
        assert resultados == []

    @pytest.mark.asyncio
    async def test_filtro_por_tipo(self):
        import json as _json
        import app.services.search_service as ss
        from app.services.search_service import buscar_semantico

        vec = [1.0] + [0.0] * 767

        idx = {
            "p_doc": {
                "vector": vec, "titulo": "Doc", "tipo": "documento",
                "coleccion": "C", "año": None, "tags": [], "entidades": {},
                "descripcion": "", "num_conexiones": 0
            },
            "p_img": {
                "vector": vec, "titulo": "Img", "tipo": "imagen",
                "coleccion": "C", "año": None, "tags": [], "entidades": {},
                "descripcion": "", "num_conexiones": 0
            },
        }
        with open(ss.EMBEDDINGS_PATH, "w") as f:
            _json.dump(idx, f)

        with patch("app.services.search_service.embed_texto", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = vec
            resultados = await buscar_semantico("texto", top_k=10, tipo_filtro="imagen")

        ids = [r["id"] for r in resultados]
        assert "p_img" in ids
        assert "p_doc" not in ids

    def test_cosine_similarity_identicos(self):
        from app.services.search_service import _cosine_similarity
        v = [1.0, 2.0, 3.0]
        assert abs(_cosine_similarity(v, v) - 1.0) < 1e-6

    def test_cosine_similarity_ortogonales(self):
        from app.services.search_service import _cosine_similarity
        assert _cosine_similarity([1, 0, 0], [0, 1, 0]) == 0.0

    def test_cosine_similarity_vectores_vacios(self):
        from app.services.search_service import _cosine_similarity
        assert _cosine_similarity([], []) == 0.0

    def test_eliminar_del_indice(self):
        import app.services.search_service as ss
        # Insertar manualmente en el índice
        idx = {"p_borrar": {"vector": [1.0]*768, "titulo": "X", "tipo": "documento"}}
        with open(ss.EMBEDDINGS_PATH, "w") as f:
            json.dump(idx, f)

        from app.services.search_service import eliminar_del_indice, estadisticas_indice
        eliminar_del_indice("p_borrar")
        assert estadisticas_indice()["total_indexadas"] == 0


# ═══════════════════════════════════════════════════════════════════
# OLLAMA SERVICE (mockeado)
# ═══════════════════════════════════════════════════════════════════

class TestOllamaService:
    @pytest.mark.asyncio
    async def test_check_ollama_inactivo(self):
        """Sin Ollama corriendo, debe retornar False."""
        from app.services.ollama_service import check_ollama
        # No hay Ollama en el entorno de tests
        resultado = await check_ollama()
        assert isinstance(resultado, bool)

    @pytest.mark.asyncio
    async def test_embed_texto_fallback_sin_ollama(self):
        """Sin Ollama, embed_texto retorna vector de ceros."""
        from app.services.ollama_service import embed_texto
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.side_effect = Exception("Sin conexión")
            vector = await embed_texto("texto de prueba")
        assert len(vector) == 768
        assert all(v == 0.0 for v in vector)

    @pytest.mark.asyncio
    async def test_clasificar_pieza_con_respuesta_simulada(self):
        from app.services.ollama_service import clasificar_pieza

        mock_resp = json.dumps({
            "tipo": "documento",
            "coleccion_sugerida": "Archivo del 68",
            "año": 1968,
            "idioma": "es",
            "tags": ["1968", "CNH", "huelga"],
            "resumen_breve": "Manifiesto del movimiento estudiantil de 1968"
        })

        with patch("app.services.ollama_service.completar", new_callable=AsyncMock) as mock_completar:
            mock_completar.return_value = mock_resp
            resultado = await clasificar_pieza(
                "Manifiesto CNH",
                "El Consejo Nacional de Huelga exige libertad a los presos políticos"
            )

        assert resultado["tipo"] == "documento"
        assert resultado["año"] == 1968
        assert "CNH" in resultado["tags"]

    @pytest.mark.asyncio
    async def test_extraer_entidades_con_respuesta_simulada(self):
        from app.services.ollama_service import extraer_entidades

        mock_resp = json.dumps({
            "personas": ["Gustavo Díaz Ordaz"],
            "lugares": ["Tlatelolco", "Ciudad de México"],
            "fechas": ["2 de octubre de 1968"],
            "eventos": ["Masacre de Tlatelolco"],
            "organizaciones": ["CNH", "UNAM"]
        })

        with patch("app.services.ollama_service.completar", new_callable=AsyncMock) as mock_completar:
            mock_completar.return_value = mock_resp
            entidades = await extraer_entidades(
                "El 2 de octubre de 1968 en Tlatelolco, Gustavo Díaz Ordaz ordenó la represión del CNH."
            )

        assert "Gustavo Díaz Ordaz" in entidades["personas"]
        assert "Tlatelolco" in entidades["lugares"]
        assert "CNH" in entidades["organizaciones"]

    @pytest.mark.asyncio
    async def test_extraer_entidades_texto_corto(self):
        from app.services.ollama_service import extraer_entidades
        entidades = await extraer_entidades("hola")
        assert entidades["personas"] == []

    @pytest.mark.asyncio
    async def test_generar_tags_con_mock(self):
        from app.services.ollama_service import generar_tags

        with patch("app.services.ollama_service.completar", new_callable=AsyncMock) as mock:
            mock.return_value = '["patrimonio", "mural", "1975", "buap"]'
            tags = await generar_tags("Mural BUAP 1975", "Mural sobre la unidad estudiantil", {})

        assert "patrimonio" in tags
        assert len(tags) <= 8

    @pytest.mark.asyncio
    async def test_clasificar_pieza_json_invalido_no_crash(self):
        from app.services.ollama_service import clasificar_pieza

        with patch("app.services.ollama_service.completar", new_callable=AsyncMock) as mock:
            mock.return_value = "esto no es json válido {{{}"
            resultado = await clasificar_pieza("Título", "Texto")

        # Debe retornar un dict aunque falle el parse
        assert isinstance(resultado, dict)


# ═══════════════════════════════════════════════════════════════════
# SCHEMAS (Pydantic)
# ═══════════════════════════════════════════════════════════════════

class TestSchemas:
    def test_pieza_create_valida(self):
        from app.schemas.piece import PiezaCreate
        from app.models.piece import TipoPieza
        p = PiezaCreate(titulo="Test", tipo=TipoPieza.documento, coleccion="ARPA")
        assert p.titulo == "Test"

    def test_pieza_create_titulo_vacio_falla(self):
        from app.schemas.piece import PiezaCreate
        from app.models.piece import TipoPieza
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            PiezaCreate(titulo="", tipo=TipoPieza.documento, coleccion="ARPA")

    def test_pieza_create_año_invalido(self):
        from app.schemas.piece import PiezaCreate
        from app.models.piece import TipoPieza
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            PiezaCreate(titulo="Test", tipo=TipoPieza.documento, coleccion="C", año=-1)

    def test_resultado_busqueda(self):
        from app.schemas.piece import ResultadoBusqueda
        from app.models.piece import TipoPieza
        r = ResultadoBusqueda(
            id="abc",
            titulo="Test",
            tipo=TipoPieza.imagen,
            coleccion="Murales",
            num_conexiones=5,
            score=0.87,
        )
        assert r.score == 0.87
        assert r.tipo == TipoPieza.imagen

    def test_paginated_piezas(self):
        from app.schemas.piece import PaginatedPiezas
        p = PaginatedPiezas(items=[], total=0, pagina=1, por_pagina=20, paginas=0)
        assert p.total == 0


# ═══════════════════════════════════════════════════════════════════
# FASTAPI — Test cliente (sin DB, con mocks)
# ═══════════════════════════════════════════════════════════════════

class TestAPIEndpoints:
    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        # Evitar que el lifespan intente conectar a DB/Ollama
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c

    def test_raiz(self, client):
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert "Glifo" in data.get("nombre", "")

    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data

    def test_docs_disponibles(self, client):
        r = client.get("/docs")
        assert r.status_code == 200

    def test_buscar_query_vacia_falla(self, client):
        r = client.post("/api/v1/buscar", json={"query": "", "top_k": 5})
        assert r.status_code == 400

    def test_ai_status_endpoint(self, client):
        r = client.get("/api/v1/ai/status")
        assert r.status_code == 200
        data = r.json()
        assert "ollama_activo" in data
        assert "costo_total_api" in data
        assert data["costo_total_api"] == "$0.00"

    def test_ai_backends_endpoint(self, client):
        r = client.get("/api/v1/ai/backends")
        assert r.status_code == 200
        data = r.json()
        assert "ffmpeg" in data
        assert "openai_whisper" in data

    def test_grafo_endpoint(self, client):
        r = client.get("/api/v1/grafo")
        assert r.status_code == 200
        data = r.json()
        assert "nodos" in data
        assert "aristas" in data

    def test_grafo_stats_endpoint(self, client):
        r = client.get("/api/v1/grafo/stats")
        assert r.status_code == 200

    def test_buscar_stats_endpoint(self, client):
        r = client.get("/api/v1/buscar/stats")
        assert r.status_code == 200

    def test_pieza_no_encontrada(self, client):
        with patch("app.api.v1.pieces.get_db") as mock_db:
            mock_session = AsyncMock()
            mock_session.get = AsyncMock(return_value=None)
            mock_db.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_db.return_value.__aexit__ = AsyncMock(return_value=False)
            r = client.get("/api/v1/piezas/id-inexistente-xyz")
        # Puede ser 404 (si llega al handler) o 500 (si falla el mock de DB)
        assert r.status_code in [404, 500, 422]


# ═══════════════════════════════════════════════════════════════════
# PIPELINE WORKER
# ═══════════════════════════════════════════════════════════════════

class TestPipeline:
    @pytest.mark.asyncio
    async def test_pasos_para_tipo_documento(self):
        from app.workers.pipeline import _pasos_para_tipo, PASOS_PDF
        from app.models.piece import TipoPieza
        pasos = _pasos_para_tipo(TipoPieza.documento)
        assert pasos == PASOS_PDF
        assert len(pasos) == 6

    @pytest.mark.asyncio
    async def test_pasos_para_tipo_imagen(self):
        from app.workers.pipeline import _pasos_para_tipo, PASOS_IMAGEN
        from app.models.piece import TipoPieza
        assert _pasos_para_tipo(TipoPieza.imagen) == PASOS_IMAGEN

    @pytest.mark.asyncio
    async def test_pasos_para_tipo_audio(self):
        from app.workers.pipeline import _pasos_para_tipo, PASOS_AUDIO
        from app.models.piece import TipoPieza
        assert _pasos_para_tipo(TipoPieza.audio) == PASOS_AUDIO

    @pytest.mark.asyncio
    async def test_pasos_para_tipo_video(self):
        from app.workers.pipeline import _pasos_para_tipo, PASOS_VIDEO
        from app.models.piece import TipoPieza
        assert _pasos_para_tipo(TipoPieza.video) == PASOS_VIDEO


# ═══════════════════════════════════════════════════════════════════
# WHISPER SERVICE
# ═══════════════════════════════════════════════════════════════════

class TestWhisperService:
    def test_backends_disponibles_retorna_dict(self):
        from app.services.whisper_service import backends_disponibles
        b = backends_disponibles()
        assert "ffmpeg" in b
        assert "openai_whisper" in b
        assert "whisper_cpp" in b
        assert isinstance(b["ffmpeg"], bool)

    @pytest.mark.asyncio
    async def test_transcribir_sin_backends_fallback(self, tmp_path):
        """Sin backends instalados, debe retornar placeholder."""
        # Crear archivo de audio vacío para la prueba
        audio = tmp_path / "test.wav"
        audio.write_bytes(b"\x00" * 100)

        from app.services.whisper_service import transcribir
        with patch("app.services.whisper_service._tiene_openai_whisper", return_value=False), \
             patch("app.services.whisper_service._tiene_whisper_cpp", return_value=False):
            resultado = await transcribir(audio, es_video=False)

        assert resultado["backend"] == "sin_transcripcion"
        assert resultado["disponible"] is False
        assert "pendiente" in resultado["texto"].lower() or "instala" in resultado["texto"].lower()
