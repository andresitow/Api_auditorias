"""Construye la propuesta de plan de acción del año siguiente a partir de las
métricas de desempeño del año base (analysis.py). Regla de negocio (heurística,
documentada aquí porque no hay una fuente de verdad previa en el repo):

- Prioridad Alta (cumplimiento bajo el semáforo amarillo): se mantiene la misma
  frecuencia pero se marca para reforzar seguimiento del responsable.
- Prioridad Media: se mantiene la frecuencia, se pide revisar causas de reprogramación.
- Prioridad Baja con 100% de cumplimiento sostenido: se propone relajar un escalón
  la frecuencia (p. ej. Mensual -> Bimensual), como ahorro de esfuerzo de auditoría.
- Cualquier otro caso: se mantiene la frecuencia actual sin cambios.
"""

import pandas as pd

from .periods import FRECUENCIAS_PERIODICAS, periods_for_year, semana_del_mes


def recomendar_frecuencia(row: pd.Series) -> tuple[str, str]:
    frecuencia = row["frecuencia"]
    prioridad = row["prioridad"]
    cumplimiento = row["cumplimiento_pct"]

    if prioridad == "Alto":
        return frecuencia, "Riesgo alto: mantener la frecuencia y reforzar el seguimiento del responsable."
    if prioridad == "Medio":
        return frecuencia, "Cumplimiento parcial: mantener la frecuencia actual y revisar causas de reprogramación."
    if prioridad == "Bajo" and pd.notna(cumplimiento) and cumplimiento >= 99.9 and frecuencia in FRECUENCIAS_PERIODICAS:
        idx = FRECUENCIAS_PERIODICAS.index(frecuencia)
        if idx < len(FRECUENCIAS_PERIODICAS) - 1:
            propuesta = FRECUENCIAS_PERIODICAS[idx + 1]
            return propuesta, f"Cumplimiento sostenido al 100%: se propone relajar de {frecuencia.title()} a {propuesta.title()}."
    if prioridad == "Sin datos":
        return frecuencia, "Sin ocurrencias registradas en el año base: mantener la frecuencia definida en la actividad."
    return frecuencia, "Cumplimiento adecuado: mantener la frecuencia actual."


def build_plan(activity_metrics: pd.DataFrame, anio_plan: int) -> pd.DataFrame:
    rows = []
    for _, row in activity_metrics.iterrows():
        frecuencia_propuesta, recomendacion = recomendar_frecuencia(row)
        periodos = periods_for_year(frecuencia_propuesta, anio_plan)
        cronograma = ", ".join(semana_del_mes(fecha)[0] for _, fecha in periodos) if periodos else "Sin cronograma fijo (a demanda)"
        # slots 0-47 ("Mes Sx" -> índice mes*4+semana) para pintar la grilla de 48 semanas
        # del Excel/PDF, igual que buildWeekSlots en plan-template.util.ts.
        semanas_propuestas = sorted({semana_del_mes(fecha)[1] for _, fecha in periodos})
        rows.append(
            {
                **row.to_dict(),
                "frecuencia_propuesta": frecuencia_propuesta,
                "recomendacion": recomendacion,
                "cronograma_propuesto": cronograma,
                "ocurrencias_propuestas": len(periodos),
                "semanas_propuestas": semanas_propuestas,
            }
        )
    return pd.DataFrame(rows)
