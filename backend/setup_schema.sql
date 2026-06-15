-- ════════════════════════════════════════════════════════════════════════
-- PARTE 2 — Ejecutar conectado a 'glifo'
--           Esquema completo
-- ════════════════════════════════════════════════════════════════════════

-- ── ENUMs ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tipopieza AS ENUM (
    'documento','imagen','audio','video','objeto','patrimonio'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estadoprocesamiento AS ENUM (
    'pendiente','procesando','listo','error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipojob AS ENUM (
    'ingesta_pdf','ingesta_imagen','ingesta_audio','ingesta_video',
    'generacion_embedding','extraccion_entidades','actualizacion_grafo'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estadojob AS ENUM (
    'pendiente','ejecutando','completado','fallido','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tabla piezas ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS piezas (
  id                VARCHAR(64)          PRIMARY KEY,
  titulo            VARCHAR(512)         NOT NULL,
  tipo              tipopieza            NOT NULL,
  coleccion         VARCHAR(256)         NOT NULL,
  descripcion       TEXT,
  texto_extraido    TEXT,
  resumen           TEXT,
  anio              INTEGER,
  entidades         JSONB,
  tags              JSONB,
  idioma            VARCHAR(32),
  score_relevancia  FLOAT                DEFAULT 1.0,
  archivo_nombre    VARCHAR(512),
  archivo_ruta      VARCHAR(1024),
  archivo_tamano    INTEGER,
  archivo_mimetype  VARCHAR(128),
  estado            estadoprocesamiento  NOT NULL DEFAULT 'pendiente',
  progreso          INTEGER              DEFAULT 0,
  paso_actual       VARCHAR(128),
  error_msg         TEXT,
  num_conexiones    INTEGER              DEFAULT 0,
  creado_en         TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_piezas_titulo        ON piezas (titulo);
CREATE INDEX IF NOT EXISTS ix_piezas_tipo          ON piezas (tipo);
CREATE INDEX IF NOT EXISTS ix_piezas_coleccion     ON piezas (coleccion);
CREATE INDEX IF NOT EXISTS ix_piezas_estado        ON piezas (estado);
CREATE INDEX IF NOT EXISTS ix_piezas_tipo_estado   ON piezas (tipo, estado);
CREATE INDEX IF NOT EXISTS ix_piezas_coleccion_anio ON piezas (coleccion, anio);

-- ── Tabla jobs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
  id                VARCHAR(64)   PRIMARY KEY,
  pieza_id          VARCHAR(64)   REFERENCES piezas(id) ON DELETE CASCADE,
  tipo              tipojob       NOT NULL,
  estado            estadojob     NOT NULL DEFAULT 'pendiente',
  progreso          INTEGER       DEFAULT 0,
  paso_actual       VARCHAR(128),
  pasos_completados JSONB,
  pasos_totales     JSONB,
  resultado         JSONB,
  error_msg         TEXT,
  intentos          INTEGER       DEFAULT 0,
  creado_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  iniciado_en       TIMESTAMPTZ,
  completado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_jobs_pieza_id ON jobs (pieza_id);
CREATE INDEX IF NOT EXISTS ix_jobs_tipo     ON jobs (tipo);
CREATE INDEX IF NOT EXISTS ix_jobs_estado   ON jobs (estado);

-- ── Tabla alembic_version ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alembic_version (
  version_num VARCHAR(32) NOT NULL,
  CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

INSERT INTO alembic_version (version_num)
VALUES ('0001_initial')
ON CONFLICT DO NOTHING;

-- ── Permisos ─────────────────────────────────────────────────────────────

GRANT ALL ON ALL TABLES    IN SCHEMA public TO glifo;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO glifo;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO glifo;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO glifo;