"""Análisis de desempeño histórico con pandas/numpy: convierte las ocurrencias del
año base en métricas por actividad y por categoría que alimentan la propuesta del
plan de acción del año siguiente (ver plan_builder.py)."""

import numpy as np
import pandas as pd

GRUPO = ["activity_id", "categoria", "actividad", "responsable", "frecuencia"]


def _agregar_actividad(g: pd.DataFrame) -> pd.Series:
    total = int(g["occurrence_id"].notna().sum())
    ejecutadas = int((g["estado"] == "EJECUTADO").sum())
    reprogramadas = int((g["estado"] == "REPROGRAMADO").sum())
    no_realizadas = int((g["estado"] == "NO_REALIZADO").sum())
    cumplimiento = float(np.round((ejecutadas / total) * 100, 1)) if total > 0 else np.nan
    reprog_pct = float(np.round((reprogramadas / total) * 100, 1)) if total > 0 else 0.0
    return pd.Series(
        {
            "total_programadas": total,
            "ejecutadas": ejecutadas,
            "reprogramadas": reprogramadas,
            "no_realizadas": no_realizadas,
            "cumplimiento_pct": cumplimiento,
            "reprogramacion_pct": reprog_pct,
        }
    )


def compute_activity_metrics(df: pd.DataFrame, semaforo_verde: int, semaforo_amarillo: int) -> pd.DataFrame:
    metrics = df.groupby(GRUPO, dropna=False).apply(_agregar_actividad, include_groups=False).reset_index()

    cumpl = metrics["cumplimiento_pct"].fillna(0.0).to_numpy()
    reprog = metrics["reprogramacion_pct"].to_numpy()
    # Score de riesgo: pondera fuerte el incumplimiento (70%) y algo la reprogramación (30%).
    metrics["riesgo_score"] = np.round(0.7 * (100 - cumpl) + 0.3 * reprog, 1)

    def clasificar(row: pd.Series) -> str:
        if pd.isna(row["cumplimiento_pct"]):
            return "Sin datos"
        if row["cumplimiento_pct"] >= semaforo_verde:
            return "Bajo"
        if row["cumplimiento_pct"] >= semaforo_amarillo:
            return "Medio"
        return "Alto"

    metrics["prioridad"] = metrics.apply(clasificar, axis=1)
    return metrics.sort_values("riesgo_score", ascending=False).reset_index(drop=True)


def compute_categoria_metrics(activity_metrics: pd.DataFrame) -> pd.DataFrame:
    # Ponderado por ocurrencias (ejecutadas/total_programadas de la categoría), NO el promedio
    # simple del cumplimiento_pct de cada actividad: con ese promedio simple, una categoría con
    # actividades de frecuencias muy distintas (p. ej. varias semanales junto a una anual) queda
    # con un % que no coincide con "Cumplimiento por categoría" del dashboard
    # (dashboard.service.ts::porCategoria), que sí pondera por la cantidad real de ocurrencias.
    cat = (
        activity_metrics.groupby("categoria")
        .agg(
            total_actividades=("activity_id", "count"),
            total_programadas=("total_programadas", "sum"),
            ejecutadas=("ejecutadas", "sum"),
            actividades_riesgo_alto=("prioridad", lambda s: int((s == "Alto").sum())),
            actividades_riesgo_medio=("prioridad", lambda s: int((s == "Medio").sum())),
        )
        .reset_index()
    )
    cat["cumplimiento_promedio"] = np.where(
        cat["total_programadas"] > 0,
        np.round(cat["ejecutadas"] / cat["total_programadas"] * 100, 1),
        0.0,
    )
    cat = cat.drop(columns=["total_programadas", "ejecutadas"])
    return cat.sort_values("cumplimiento_promedio").reset_index(drop=True)
