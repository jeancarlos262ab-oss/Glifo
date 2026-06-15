"""
Motor de base de datos.
- Async para FastAPI (sqlalchemy + asyncpg)
- Sync para migraciones Alembic
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

settings = get_settings()


# ── Motor async ──────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Base declarativa (todos los modelos heredan de aquí) ──────────
class Base(DeclarativeBase):
    pass


# ── Dependency para inyectar sesión en rutas FastAPI ─────────────
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Crear todas las tablas (usado en startup si no hay Alembic) ──
async def init_db() -> None:
    async with engine.begin() as conn:
        from app.models import piece, job  # noqa: F401 – registra modelos
        await conn.run_sync(Base.metadata.create_all)
