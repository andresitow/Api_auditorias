"""Timestamp único de 'Generado el ...' para Excel, PDF y el JSON del resumen web.

jobs.py fija resumen['generadoEn'] una sola vez, en UTC (datetime.now(timezone.utc)),
al terminar de construir el plan. Antes, excel_report.py y pdf_report.py ignoraban
ese valor y cada uno llamaba a su propio datetime.now() (hora local ingenua del
proceso) para armar el subtítulo "Generado el ...": si el servicio corre en un
servidor con otra zona horaria, o si el Excel y el PDF se generan en instantes
distintos, la hora mostrada podía no coincidir entre el Excel, el PDF y la web.

Este módulo centraliza esa conversión: toma el único timestamp UTC del resumen y lo
formatea en hora de Colombia, para que los tres lugares muestren siempre la misma
fecha/hora."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ZONA_HORARIA_REPORTES = ZoneInfo("America/Bogota")


def formatear_generado_en(generado_en_iso: str | None) -> str:
    """resumen['generadoEn'] (UTC ISO 8601) -> 'dd/mm/AAAA HH:MM' en hora de Colombia.

    Si no viene (p. ej. al construir un reporte suelto en una prueba, sin pasar por
    jobs.py), usa el instante actual como respaldo."""
    if generado_en_iso:
        momento = datetime.fromisoformat(generado_en_iso)
        if momento.tzinfo is None:
            momento = momento.replace(tzinfo=timezone.utc)
    else:
        momento = datetime.now(timezone.utc)
    return momento.astimezone(ZONA_HORARIA_REPORTES).strftime("%d/%m/%Y %H:%M")
