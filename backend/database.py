"""
PS13 — Database Layer
PostgreSQL (SQLAlchemy async) + InfluxDB client management.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
from influxdb_client import WriteOptions
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import structlog

from config import settings

logger = structlog.get_logger(__name__)

# ──────────────────────────────────────────────────────
# SQLAlchemy (PostgreSQL)
# ──────────────────────────────────────────────────────

engine = create_async_engine(
    settings.database_url,
    echo=settings.app_env == "development",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("PostgreSQL tables initialized")


# ──────────────────────────────────────────────────────
# InfluxDB
# ──────────────────────────────────────────────────────

_influx_client: InfluxDBClientAsync | None = None


def get_influx_client() -> InfluxDBClientAsync:
    global _influx_client
    if _influx_client is None:
        _influx_client = InfluxDBClientAsync(
            url=settings.influxdb_url,
            token=settings.influxdb_token,
            org=settings.influxdb_org,
        )
    return _influx_client


async def write_telemetry(measurement: str, tags: dict, fields: dict, timestamp=None):
    """Write a single telemetry point to InfluxDB."""
    from influxdb_client import Point
    from influxdb_client.client.write_api import SYNCHRONOUS
    import datetime

    client = get_influx_client()
    point = Point(measurement)
    for k, v in tags.items():
        point = point.tag(k, v)
    for k, v in fields.items():
        point = point.field(k, v)
    if timestamp:
        point = point.time(timestamp)

    write_api = client.write_api()
    await write_api.write(
        bucket=settings.influxdb_bucket,
        org=settings.influxdb_org,
        record=point,
    )


async def query_telemetry(flux_query: str) -> list:
    """Execute a Flux query and return results."""
    client = get_influx_client()
    query_api = client.query_api()
    tables = await query_api.query(flux_query, org=settings.influxdb_org)
    results = []
    for table in tables:
        for record in table.records:
            results.append({
                "time": record.get_time(),
                "measurement": record.get_measurement(),
                "field": record.get_field(),
                "value": record.get_value(),
                "tags": {k: v for k, v in record.values.items()
                         if k not in ("_time", "_value", "_field", "_measurement")},
            })
    return results


async def close_influx():
    global _influx_client
    if _influx_client:
        await _influx_client.close()
        _influx_client = None
