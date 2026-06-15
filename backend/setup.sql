-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Glifo — Setup completo de base de datos                            ║
-- ║  HackatónARPA · BUAP 2026                                           ║
-- ║                                                                      ║
-- ║  Linux/Mac:  sudo -u postgres psql -f setup.sql                     ║
-- ║  Windows:    ejecutar setup.bat  (o ver README)                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════════
-- PARTE 1 — Ejecutar conectado a 'postgres' (superusuario)
--           setup.bat lo hace automáticamente en dos pasos.
--           En Linux/Mac psql maneja el \connect internamente.
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'glifo') THEN
    CREATE USER glifo WITH PASSWORD 'glifo';
  END IF;
END
$$;

SELECT 'CREATE DATABASE glifo OWNER glifo'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'glifo')\gexec

GRANT ALL PRIVILEGES ON DATABASE glifo TO glifo;
