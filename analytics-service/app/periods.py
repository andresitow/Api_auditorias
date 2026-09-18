"""Réplica en Python de backend/src/modules/auditorias/periods.util.ts: mismo criterio
de periodos/cronograma por frecuencia, para que el plan propuesto use las mismas
convenciones ("Mes Sx", "2026-Q1", etc.) que ya conoce el equipo en los exports actuales."""

import calendar
from datetime import date, timedelta

MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
MESES_FULL = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
]
SEMANAS_POR_ANIO = 48  # 4 "semanas" por mes x 12 meses, igual que el documento origen

FRECUENCIAS_PERIODICAS = ["DIARIO", "MENSUAL", "BIMENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"]


def _last_day(anio: int, month: int) -> date:
    return date(anio, month, calendar.monthrange(anio, month)[1])


def periods_for_year(frecuencia: str, anio: int) -> list[tuple[str, date]]:
    """(periodo, fecha_programada) para una frecuencia dada dentro de un año calendario.
    UNICA/A_DEMANDA/CUANDO_SE_REQUIERA no se pre-generan, igual que en el backend."""
    if frecuencia == "DIARIO":
        start, end = date(anio, 1, 1), date(anio, 12, 31)
        weeks: list[tuple[str, date]] = []
        cursor, week = start, 1
        while cursor <= end:
            week_end = min(cursor + timedelta(days=4), end)
            weeks.append((f"{anio}-W{week:02d}", week_end))
            cursor += timedelta(days=7)
            week += 1
        return weeks
    if frecuencia == "MENSUAL":
        return [(f"{anio}-{m:02d}", _last_day(anio, m)) for m in range(1, 13)]
    if frecuencia == "BIMENSUAL":
        return [(f"{anio}-B{b}", _last_day(anio, b * 2)) for b in range(1, 7)]
    if frecuencia == "TRIMESTRAL":
        return [(f"{anio}-Q{q}", _last_day(anio, q * 3)) for q in range(1, 5)]
    if frecuencia == "SEMESTRAL":
        return [(f"{anio}-S1", _last_day(anio, 6)), (f"{anio}-S2", date(anio, 12, 31))]
    if frecuencia == "ANUAL":
        return [(f"{anio}", date(anio, 12, 31))]
    return []  # UNICA, A_DEMANDA, CUANDO_SE_REQUIERA


def semana_del_mes(fecha: date) -> tuple[str, int]:
    mes_idx = fecha.month - 1
    semana = min(4, -(-fecha.day // 7))  # ceil(dia / 7)
    return f"{MESES[mes_idx]} S{semana}", mes_idx * 4 + (semana - 1)
