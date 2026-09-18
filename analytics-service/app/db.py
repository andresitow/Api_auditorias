"""Lectura de datos para el análisis. Este servicio SOLO lee (nunca escribe) las
tablas que administra Prisma en el backend NestJS (ver backend/prisma/schema.prisma);
la generación real de ocurrencias sigue siendo responsabilidad del backend."""

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from .config import DATABASE_URL


def _build_engine(database_url: str):
    """Prisma agrega `?schema=<name>` al DATABASE_URL (ver backend/.env); psycopg2 no
    reconoce ese parámetro de conexión y falla con "invalid dsn". Lo removemos y, si
    venía un schema no-default, lo aplicamos vía `search_path` en vez de en la DSN."""
    url = make_url(database_url)
    schema = url.query.get("schema")
    query = {k: v for k, v in url.query.items() if k != "schema"}
    url = url.set(query=query)
    connect_args = {"options": f"-csearch_path={schema}"} if schema and schema != "public" else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


engine = _build_engine(DATABASE_URL)


def fetch_auditoria(auditoria_id: str) -> dict | None:
    with engine.connect() as conn:
        row = conn.execute(
            text('SELECT id, nombre, descripcion FROM "Auditoria" WHERE id = :id'),
            {"id": auditoria_id},
        ).mappings().first()
        return dict(row) if row else None


def fetch_config() -> dict:
    with engine.connect() as conn:
        row = conn.execute(
            text('SELECT "semaforoVerdePct", "semaforoAmarilloPct" FROM "AuditoriaConfig" WHERE id = 1'),
        ).mappings().first()
        return dict(row) if row else {"semaforoVerdePct": 90, "semaforoAmarilloPct": 70}


def fetch_activities_with_occurrences(auditoria_id: str, anio_base: int) -> pd.DataFrame:
    """Una fila por (actividad, ocurrencia) del año base; una actividad sin ocurrencias
    ese año queda con occurrence_id/estado en NULL gracias al LEFT JOIN."""
    query = text(
        """
        SELECT
            a.id AS activity_id,
            a.categoria AS categoria,
            a.nombre AS actividad,
            a.responsable AS responsable,
            a.frecuencia AS frecuencia,
            o.id AS occurrence_id,
            o.periodo AS periodo,
            o."fechaProgramada" AS fecha_programada,
            o.estado AS estado,
            o.reprogramaciones AS reprogramaciones
        FROM "Activity" a
        LEFT JOIN "ActivityOccurrence" o
            ON o."activityId" = a.id AND o.periodo LIKE :anio_prefix
        WHERE a."auditoriaId" = :auditoria_id AND a."activa" = true
        ORDER BY a.categoria, a.nombre, o."fechaProgramada"
        """
    )
    with engine.connect() as conn:
        return pd.read_sql(query, conn, params={"auditoria_id": auditoria_id, "anio_prefix": f"{anio_base}%"})


def fetch_activities_for_export(
    auditoria_id: str, anio: int, categoria: str | None, estado: str | None
) -> pd.DataFrame:
    """Una fila por (actividad, ocurrencia) del año pedido, para el Excel/PDF "Plan de
    Trabajo" (ver plan_trabajo_report.py). A diferencia de fetch_activities_with_occurrences
    (usada para el análisis del plan de acción), acá NO se filtra por actividad activa
    ni se limita a un año "base": incluye actividades inactivas y admite filtrar por
    categoría/estado, igual que hacía el export-excel.service.ts/export-pdf.service.ts
    de NestJS que este endpoint reemplaza."""
    query = text(
        """
        SELECT
            a.id AS activity_id,
            a.categoria AS categoria,
            a.nombre AS actividad,
            a."descripcionEvidencia" AS descripcion,
            a.responsable AS responsable,
            a.frecuencia AS frecuencia,
            o.id AS occurrence_id,
            o."fechaProgramada" AS fecha_programada,
            o.estado AS estado
        FROM "Activity" a
        LEFT JOIN "ActivityOccurrence" o
            ON o."activityId" = a.id
            AND o.periodo LIKE :anio_prefix
            AND (CAST(:estado AS text) IS NULL OR o.estado::text = :estado)
        WHERE a."auditoriaId" = :auditoria_id
            AND (CAST(:categoria AS text) IS NULL OR a.categoria = :categoria)
        ORDER BY a.categoria, a.nombre, o."fechaProgramada"
        """
    )
    with engine.connect() as conn:
        return pd.read_sql(
            query,
            conn,
            params={
                "auditoria_id": auditoria_id,
                "anio_prefix": f"{anio}%",
                "categoria": categoria,
                "estado": estado,
            },
        )
