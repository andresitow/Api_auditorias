"""Pruebas de app/analysis.py (métricas pandas/numpy) y app/plan_builder.py (propuesta
del plan de acción del año siguiente)."""

import math

import numpy as np
import pandas as pd
import pytest

from app import analysis, plan_builder


def df_ocurrencias(filas):
    """filas = [(activity_id, categoria, actividad, frecuencia, [estados...]), ...]. Una actividad
    con lista vacía de estados equivale a una actividad sin ocurrencias (LEFT JOIN => NULL)."""
    registros = []
    n = 0
    for activity_id, categoria, actividad, frecuencia, estados in filas:
        if not estados:
            registros.append(
                dict(activity_id=activity_id, categoria=categoria, actividad=actividad, responsable="Ana",
                     frecuencia=frecuencia, occurrence_id=None, estado=None)
            )
        for estado in estados:
            n += 1
            registros.append(
                dict(activity_id=activity_id, categoria=categoria, actividad=actividad, responsable="Ana",
                     frecuencia=frecuencia, occurrence_id=f"o{n}", estado=estado)
            )
    return pd.DataFrame(registros)


E, P, R, N = "EJECUTADO", "PLANEADO", "REPROGRAMADO", "NO_REALIZADO"


class TestComputeActivityMetrics:
    def test_conteos_y_porcentajes(self):
        df = df_ocurrencias([("a1", "Servidores", "Backups", "MENSUAL", [E, E, R, N])])
        m = analysis.compute_activity_metrics(df, 90, 70).iloc[0]
        assert m["total_programadas"] == 4
        assert m["ejecutadas"] == 2
        assert m["reprogramadas"] == 1
        assert m["no_realizadas"] == 1
        assert m["cumplimiento_pct"] == 50.0
        assert m["reprogramacion_pct"] == 25.0

    def test_score_de_riesgo_ponderado_70_30(self):
        df = df_ocurrencias([("a1", "S", "A", "MENSUAL", [E, E, R, N])])
        m = analysis.compute_activity_metrics(df, 90, 70).iloc[0]
        # 0.7 * (100 - 50) + 0.3 * 25 = 35 + 7.5
        assert m["riesgo_score"] == 42.5

    @pytest.mark.parametrize(
        "ejecutadas,total,esperado",
        [
            (10, 10, "Bajo"),   # 100 >= 90
            (9, 10, "Bajo"),    # 90 >= 90 (límite inclusivo)
            (8, 10, "Medio"),   # 80
            (7, 10, "Medio"),   # 70 (límite inclusivo)
            (6, 10, "Alto"),    # 60
            (0, 10, "Alto"),
        ],
    )
    def test_clasificacion_por_semaforo(self, ejecutadas, total, esperado):
        df = df_ocurrencias([("a1", "S", "A", "MENSUAL", [E] * ejecutadas + [P] * (total - ejecutadas))])
        assert analysis.compute_activity_metrics(df, 90, 70).iloc[0]["prioridad"] == esperado

    def test_usa_los_umbrales_configurados(self):
        df = df_ocurrencias([("a1", "S", "A", "MENSUAL", [E] * 5 + [P] * 5)])
        assert analysis.compute_activity_metrics(df, 50, 20).iloc[0]["prioridad"] == "Bajo"
        assert analysis.compute_activity_metrics(df, 95, 60).iloc[0]["prioridad"] == "Alto"

    def test_actividad_sin_ocurrencias_es_sin_datos(self):
        df = df_ocurrencias([("a1", "S", "Vacía", "ANUAL", [])])
        m = analysis.compute_activity_metrics(df, 90, 70).iloc[0]
        assert m["total_programadas"] == 0
        assert math.isnan(m["cumplimiento_pct"])
        assert m["prioridad"] == "Sin datos"
        assert m["riesgo_score"] == 70.0  # sin datos se trata como 0% de cumplimiento

    def test_ordena_por_riesgo_descendente(self):
        df = df_ocurrencias(
            [
                ("a1", "S", "Bien", "MENSUAL", [E, E, E, E]),
                ("a2", "S", "Mal", "MENSUAL", [N, N, N, N]),
                ("a3", "S", "Medio", "MENSUAL", [E, E, N, N]),
            ]
        )
        m = analysis.compute_activity_metrics(df, 90, 70)
        assert list(m["actividad"]) == ["Mal", "Medio", "Bien"]
        assert list(m["riesgo_score"]) == sorted(m["riesgo_score"], reverse=True)

    def test_una_fila_por_actividad(self):
        df = df_ocurrencias(
            [("a1", "S", "A", "MENSUAL", [E, P]), ("a2", "S", "B", "ANUAL", [E])]
        )
        assert len(analysis.compute_activity_metrics(df, 90, 70)) == 2


class TestComputeCategoriaMetrics:
    def _metrics(self, filas):
        return analysis.compute_activity_metrics(df_ocurrencias(filas), 90, 70)

    def test_cumplimiento_ponderado_por_ocurrencias_no_promedio_simple(self):
        # a1: semanal 1/10 ejecutadas; a2: anual 1/1 -> ponderado 2/11 = 18.2% (promedio simple sería 55%)
        m = self._metrics(
            [
                ("a1", "Servidores", "Semanal", "DIARIO", [E] + [P] * 9),
                ("a2", "Servidores", "Anual", "ANUAL", [E]),
            ]
        )
        cat = analysis.compute_categoria_metrics(m)
        assert len(cat) == 1
        assert cat.iloc[0]["cumplimiento_promedio"] == 18.2
        assert cat.iloc[0]["total_actividades"] == 2

    def test_cuenta_actividades_de_riesgo_alto_y_medio(self):
        m = self._metrics(
            [
                ("a1", "S", "Alto", "MENSUAL", [N] * 4),
                ("a2", "S", "Medio", "MENSUAL", [E, E, E, N]),  # 75%
                ("a3", "S", "Bajo", "MENSUAL", [E] * 4),
            ]
        )
        cat = analysis.compute_categoria_metrics(m).iloc[0]
        assert cat["actividades_riesgo_alto"] == 1
        assert cat["actividades_riesgo_medio"] == 1

    def test_ordena_de_menor_a_mayor_cumplimiento(self):
        m = self._metrics(
            [
                ("a1", "Buena", "X", "MENSUAL", [E, E]),
                ("a2", "Mala", "Y", "MENSUAL", [N, N]),
            ]
        )
        cat = analysis.compute_categoria_metrics(m)
        assert list(cat["categoria"]) == ["Mala", "Buena"]

    def test_categoria_solo_con_actividades_sin_datos_da_0(self):
        m = self._metrics([("a1", "Vacía", "X", "ANUAL", [])])
        cat = analysis.compute_categoria_metrics(m).iloc[0]
        assert cat["cumplimiento_promedio"] == 0.0

    def test_no_expone_columnas_internas(self):
        m = self._metrics([("a1", "S", "A", "MENSUAL", [E])])
        cat = analysis.compute_categoria_metrics(m)
        assert "total_programadas" not in cat.columns
        assert "ejecutadas" not in cat.columns


class TestRecomendarFrecuencia:
    def fila(self, prioridad, frecuencia="MENSUAL", cumplimiento=100.0):
        return pd.Series({"prioridad": prioridad, "frecuencia": frecuencia, "cumplimiento_pct": cumplimiento})

    def test_riesgo_alto_mantiene_frecuencia(self):
        f, msg = plan_builder.recomendar_frecuencia(self.fila("Alto", cumplimiento=10))
        assert f == "MENSUAL"
        assert "Riesgo alto" in msg

    def test_riesgo_medio_mantiene_frecuencia(self):
        f, msg = plan_builder.recomendar_frecuencia(self.fila("Medio", cumplimiento=80))
        assert f == "MENSUAL"
        assert "reprogramación" in msg

    @pytest.mark.parametrize(
        "actual,propuesta",
        [
            ("DIARIO", "MENSUAL"),
            ("MENSUAL", "BIMENSUAL"),
            ("BIMENSUAL", "TRIMESTRAL"),
            ("TRIMESTRAL", "SEMESTRAL"),
            ("SEMESTRAL", "ANUAL"),
        ],
    )
    def test_bajo_con_100_relaja_un_escalon(self, actual, propuesta):
        f, msg = plan_builder.recomendar_frecuencia(self.fila("Bajo", actual, 100.0))
        assert f == propuesta
        assert "relajar" in msg

    def test_anual_no_se_relaja_mas(self):
        f, msg = plan_builder.recomendar_frecuencia(self.fila("Bajo", "ANUAL", 100.0))
        assert f == "ANUAL"
        assert "adecuado" in msg

    def test_bajo_por_debajo_de_99_9_no_se_relaja(self):
        f, _ = plan_builder.recomendar_frecuencia(self.fila("Bajo", "MENSUAL", 95.0))
        assert f == "MENSUAL"

    def test_bajo_con_99_9_si_se_relaja_umbral_inclusivo(self):
        f, _ = plan_builder.recomendar_frecuencia(self.fila("Bajo", "MENSUAL", 99.9))
        assert f == "BIMENSUAL"

    @pytest.mark.parametrize("frecuencia", ["UNICA", "A_DEMANDA", "CUANDO_SE_REQUIERA"])
    def test_frecuencias_no_periodicas_no_se_relajan(self, frecuencia):
        f, _ = plan_builder.recomendar_frecuencia(self.fila("Bajo", frecuencia, 100.0))
        assert f == frecuencia

    def test_sin_datos_mantiene(self):
        f, msg = plan_builder.recomendar_frecuencia(self.fila("Sin datos", "MENSUAL", np.nan))
        assert f == "MENSUAL"
        assert "Sin ocurrencias" in msg


class TestBuildPlan:
    def test_agrega_columnas_de_propuesta(self):
        m = analysis.compute_activity_metrics(
            df_ocurrencias([("a1", "S", "Backups", "MENSUAL", [E, E, E, E])]), 90, 70
        )
        plan = plan_builder.build_plan(m, 2027)
        row = plan.iloc[0]
        assert row["frecuencia_propuesta"] == "BIMENSUAL"  # 100% => se relaja un escalón
        assert row["ocurrencias_propuestas"] == 6
        assert "B1" not in row["cronograma_propuesto"]
        assert row["cronograma_propuesto"].count(",") == 5
        assert len(row["semanas_propuestas"]) == len(set(row["semanas_propuestas"]))
        assert row["semanas_propuestas"] == sorted(row["semanas_propuestas"])

    def test_riesgo_alto_conserva_frecuencia_y_su_cronograma(self):
        m = analysis.compute_activity_metrics(
            df_ocurrencias([("a1", "S", "Backups", "TRIMESTRAL", [N, N, N, N])]), 90, 70
        )
        row = plan_builder.build_plan(m, 2027).iloc[0]
        assert row["frecuencia_propuesta"] == "TRIMESTRAL"
        assert row["ocurrencias_propuestas"] == 4
        # 31 mar, 30 jun, 30 sep, 31 dic -> semana 4 de Mar, Jun, Sep, Dic
        assert row["cronograma_propuesto"] == "Mar S4, Jun S4, Sep S4, Dic S4"
        assert row["semanas_propuestas"] == [11, 23, 35, 47]

    def test_frecuencia_sin_cronograma_fijo(self):
        m = analysis.compute_activity_metrics(
            df_ocurrencias([("a1", "S", "Eventos", "A_DEMANDA", [N, N])]), 90, 70
        )
        row = plan_builder.build_plan(m, 2027).iloc[0]
        assert row["cronograma_propuesto"] == "Sin cronograma fijo (a demanda)"
        assert row["ocurrencias_propuestas"] == 0
        assert row["semanas_propuestas"] == []

    def test_conserva_las_columnas_de_metricas(self):
        m = analysis.compute_activity_metrics(
            df_ocurrencias([("a1", "S", "X", "MENSUAL", [E])]), 90, 70
        )
        plan = plan_builder.build_plan(m, 2027)
        assert {"activity_id", "categoria", "prioridad", "riesgo_score"} <= set(plan.columns)
