"""Pruebas de app/periods.py (réplica de periods.util.ts) y app/plan_trabajo_template.py
(réplica de plan-template.util.ts), más app/report_time.py."""

from datetime import date

import pytest

from app.periods import MESES, SEMANAS_POR_ANIO, periods_for_year, semana_del_mes
from app.plan_trabajo_template import (
    ESTADO_COLOR_HEX,
    ESTADO_FILL_HEX,
    ESTADO_LETRA,
    ESTADO_NOMBRE,
    activity_week_slots,
    build_rangos_semanas,
    build_week_slots,
    cronograma_entries,
)
from app.report_time import formatear_generado_en


class TestPeriodsForYear:
    @pytest.mark.parametrize("frecuencia", ["UNICA", "A_DEMANDA", "CUANDO_SE_REQUIERA", "OTRA", ""])
    def test_frecuencias_sin_pregeneracion(self, frecuencia):
        assert periods_for_year(frecuencia, 2026) == []

    def test_mensual(self):
        res = periods_for_year("MENSUAL", 2026)
        assert [p for p, _ in res] == [f"2026-{m:02d}" for m in range(1, 13)]
        assert [f.isoformat() for _, f in res] == [
            "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30",
            "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31",
        ]

    def test_febrero_bisiesto(self):
        assert periods_for_year("MENSUAL", 2024)[1][1] == date(2024, 2, 29)
        assert periods_for_year("BIMENSUAL", 2024)[0][1] == date(2024, 2, 29)

    def test_bimensual(self):
        res = periods_for_year("BIMENSUAL", 2026)
        assert [p for p, _ in res] == [f"2026-B{b}" for b in range(1, 7)]
        assert [f.isoformat() for _, f in res] == [
            "2026-02-28", "2026-04-30", "2026-06-30", "2026-08-31", "2026-10-31", "2026-12-31",
        ]

    def test_trimestral(self):
        res = periods_for_year("TRIMESTRAL", 2026)
        assert [(p, f.isoformat()) for p, f in res] == [
            ("2026-Q1", "2026-03-31"), ("2026-Q2", "2026-06-30"),
            ("2026-Q3", "2026-09-30"), ("2026-Q4", "2026-12-31"),
        ]

    def test_semestral(self):
        res = periods_for_year("SEMESTRAL", 2026)
        assert [(p, f.isoformat()) for p, f in res] == [("2026-S1", "2026-06-30"), ("2026-S2", "2026-12-31")]

    def test_anual(self):
        assert periods_for_year("ANUAL", 2026) == [("2026", date(2026, 12, 31))]

    @pytest.mark.parametrize("anio", [2024, 2026])
    def test_diario_53_semanas_recortadas_al_fin_de_anio(self, anio):
        res = periods_for_year("DIARIO", anio)
        assert len(res) == 53
        assert res[0] == (f"{anio}-W01", date(anio, 1, 5))
        assert res[1] == (f"{anio}-W02", date(anio, 1, 12))
        assert res[-1] == (f"{anio}-W53", date(anio, 12, 31))
        fechas = [f for _, f in res]
        assert fechas == sorted(fechas)
        assert all(f.year == anio for f in fechas)

    def test_paridad_con_backend_typescript(self):
        """Mismos ids y fechas que backend/src/modules/auditorias/periods.util.ts
        (ver periods.util.spec.ts): si uno cambia, el otro debe cambiar igual."""
        assert len(periods_for_year("DIARIO", 2026)) == 53
        assert periods_for_year("DIARIO", 2026)[0][1] == date(2026, 1, 5)
        assert periods_for_year("SEMESTRAL", 2026)[0][1] == date(2026, 6, 30)


class TestSemanaDelMes:
    @pytest.mark.parametrize(
        "fecha,label,idx",
        [
            (date(2026, 1, 1), "Ene S1", 0),
            (date(2026, 1, 7), "Ene S1", 0),
            (date(2026, 1, 8), "Ene S2", 1),
            (date(2026, 1, 14), "Ene S2", 1),
            (date(2026, 1, 15), "Ene S3", 2),
            (date(2026, 1, 22), "Ene S4", 3),
            (date(2026, 1, 28), "Ene S4", 3),
            (date(2026, 1, 29), "Ene S4", 3),  # días 29-31 se recortan a la semana 4
            (date(2026, 1, 31), "Ene S4", 3),
            (date(2026, 2, 28), "Feb S4", 7),
            (date(2026, 12, 31), "Dic S4", 47),
        ],
    )
    def test_casos(self, fecha, label, idx):
        assert semana_del_mes(fecha) == (label, idx)

    def test_indices_cubren_0_a_47(self):
        idx = set()
        d = date(2026, 1, 1)
        while d.year == 2026:
            idx.add(semana_del_mes(d)[1])
            d = date.fromordinal(d.toordinal() + 1)
        assert idx == set(range(SEMANAS_POR_ANIO))

    def test_constantes(self):
        assert SEMANAS_POR_ANIO == 48 == len(MESES) * 4


class TestPlanTrabajoTemplate:
    def test_diccionarios_de_estado_consistentes(self):
        estados = {"PLANEADO", "EJECUTADO", "REPROGRAMADO", "NO_REALIZADO"}
        assert set(ESTADO_LETRA) == set(ESTADO_COLOR_HEX) == set(ESTADO_FILL_HEX) == set(ESTADO_NOMBRE) == estados
        assert ESTADO_LETRA == {"PLANEADO": "P", "EJECUTADO": "E", "REPROGRAMADO": "R", "NO_REALIZADO": "N"}

    def test_activity_week_slots(self):
        occ = [
            {"fecha_programada": date(2026, 1, 5), "estado": "EJECUTADO"},
            {"fecha_programada": date(2026, 3, 20), "estado": "NO_REALIZADO"},
        ]
        slots = activity_week_slots(occ)
        assert len(slots) == 48
        assert slots[0] == "EJECUTADO"
        assert slots[2 * 4 + 2] == "NO_REALIZADO"
        assert slots.count(None) == 46

    def test_activity_week_slots_la_ultima_ocurrencia_del_slot_gana(self):
        occ = [
            {"fecha_programada": date(2026, 1, 1), "estado": "PLANEADO"},
            {"fecha_programada": date(2026, 1, 2), "estado": "EJECUTADO"},
        ]
        assert activity_week_slots(occ)[0] == "EJECUTADO"

    def test_cronograma_entries_ordenado_por_fecha(self):
        occ = [
            {"fecha_programada": date(2026, 3, 20), "estado": "REPROGRAMADO"},
            {"fecha_programada": date(2026, 1, 5), "estado": "EJECUTADO"},
        ]
        assert cronograma_entries(occ) == [
            {"texto": "Ene S1: E", "estado": "EJECUTADO"},
            {"texto": "Mar S3: R", "estado": "REPROGRAMADO"},
        ]

    def test_build_week_slots_cuenta_por_estado(self):
        occ = [
            {"fecha_programada": date(2026, 1, 2), "estado": "EJECUTADO"},
            {"fecha_programada": date(2026, 1, 3), "estado": "PLANEADO"},
            {"fecha_programada": date(2026, 1, 4), "estado": "REPROGRAMADO"},
            {"fecha_programada": date(2026, 1, 5), "estado": "NO_REALIZADO"},
        ]
        slots = build_week_slots(occ)
        assert len(slots) == 48
        assert slots[0] == {
            "label": "Ene S1", "total": 4, "ejecutadas": 1, "reprogramadas": 1, "no_realizadas": 1,
        }
        assert slots[1]["total"] == 0
        assert slots[47]["label"] == "Dic S4"

    def test_build_rangos_semanas_agrupa_de_3_en_3(self):
        occ = [
            {"fecha_programada": date(2026, 1, 2), "estado": "EJECUTADO"},
            {"fecha_programada": date(2026, 1, 9), "estado": "PLANEADO"},
        ]
        rangos = build_rangos_semanas(build_week_slots(occ))
        assert len(rangos) == 16
        assert rangos[0] == {"rango": "Ene S1 – Ene S3", "cumplimiento_pct": 50}
        assert rangos[1] == {"rango": "Ene S4 – Feb S2", "cumplimiento_pct": 0}  # sin ocurrencias => 0

    def test_build_rangos_semanas_lista_vacia(self):
        assert build_rangos_semanas([]) == []


class TestFormatearGeneradoEn:
    def test_convierte_utc_a_hora_colombia(self):
        # Colombia = UTC-5 sin horario de verano
        assert formatear_generado_en("2026-06-15T17:30:00+00:00") == "15/06/2026 12:30"

    def test_iso_sin_zona_se_asume_utc(self):
        assert formatear_generado_en("2026-06-15T05:00:00") == "15/06/2026 00:00"

    def test_cruce_de_dia_hacia_atras(self):
        assert formatear_generado_en("2026-01-01T03:00:00+00:00") == "31/12/2025 22:00"

    def test_respeta_otras_zonas_de_entrada(self):
        assert formatear_generado_en("2026-06-15T12:00:00-05:00") == "15/06/2026 12:00"

    def test_sin_valor_usa_ahora(self):
        s = formatear_generado_en(None)
        assert len(s) == 16 and s[2] == "/" and s[5] == "/" and s[13] == ":"
        assert len(formatear_generado_en("")) == 16  # cadena vacía también cae al respaldo
