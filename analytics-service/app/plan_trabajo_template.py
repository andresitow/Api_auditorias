"""Réplica en Python de backend/src/modules/auditorias/plan-template.util.ts: mismos
colores/letra de estado y misma agregación de semanas, para que el Excel/PDF del
"Plan de Trabajo" del año en curso (generado ahora acá, ver plan_trabajo_report.py)
se vea igual a como se veía cuando lo generaba el backend NestJS con exceljs/pdfkit.
El backend ahora solo hace de puente (ver export-bridge.service.ts)."""

from .periods import MESES, MESES_FULL, SEMANAS_POR_ANIO, semana_del_mes

ESTADO_LETRA = {"PLANEADO": "P", "EJECUTADO": "E", "REPROGRAMADO": "R", "NO_REALIZADO": "N"}

ESTADO_COLOR_HEX = {
    "PLANEADO": "1D4E89",
    "EJECUTADO": "1F7A3D",
    "REPROGRAMADO": "B15C00",
    "NO_REALIZADO": "B3261E",
}

ESTADO_FILL_HEX = {
    "PLANEADO": "DCEEFF",
    "EJECUTADO": "DFF5E1",
    "REPROGRAMADO": "FCE8D5",
    "NO_REALIZADO": "FBE0E0",
}

ESTADO_NOMBRE = {
    "PLANEADO": "Planeado",
    "EJECUTADO": "Ejecutado",
    "REPROGRAMADO": "Reprogramado",
    "NO_REALIZADO": "No realizado",
}

# Grilla de 48 semanas (cronograma tipo Gantt): banda "MESES DEL AÑO" + fila de meses +
# fila de semanas 1-4, con la celda de cada actividad pintada del estado real de la
# ocurrencia (a diferencia de excel_report.py, que pinta el color de prioridad de la
# propuesta porque todavía no hay ejecuciones).
MESES_BAND_FILL_HEX = "F4B183"
GRID_EMPTY_FILL_HEX = "F2F2F2"
GRID_BORDER_HEX = "D9D9D9"

HEADER_FILL_HEX = "21262D"
CATEGORY_FILL_HEX = "3A4552"


def activity_week_slots(occurrences: list[dict]) -> list[str | None]:
    """[{"fecha_programada": date, "estado": str}, ...] -> 48 slots "Mes Sx" con el
    estado de la ocurrencia programada en ese slot, o None si no hay ninguna."""
    slots: list[str | None] = [None] * SEMANAS_POR_ANIO
    for o in occurrences:
        _, idx = semana_del_mes(o["fecha_programada"])
        slots[idx] = o["estado"]
    return slots


def cronograma_entries(occurrences: list[dict]) -> list[dict]:
    """Texto "Mes Sx: Estado" por ocurrencia, ordenado por fecha — para la columna/línea
    de texto del PDF (no tiene espacio para la grilla de 48 columnas de página carta)."""
    ordenadas = sorted(occurrences, key=lambda o: o["fecha_programada"])
    entries = []
    for o in ordenadas:
        label, _ = semana_del_mes(o["fecha_programada"])
        entries.append({"texto": f"{label}: {ESTADO_LETRA[o['estado']]}", "estado": o["estado"]})
    return entries


def build_week_slots(occurrences: list[dict]) -> list[dict]:
    """Agrupa todas las ocurrencias del año en los 48 slots "Mes Sx", para la tabla
    "Detalle por semana" del resumen."""
    slots = [
        {"label": f"{MESES[m]} S{s}", "total": 0, "ejecutadas": 0, "reprogramadas": 0, "no_realizadas": 0}
        for m in range(12)
        for s in range(1, 5)
    ]
    for o in occurrences:
        _, idx = semana_del_mes(o["fecha_programada"])
        slot = slots[idx]
        slot["total"] += 1
        if o["estado"] == "EJECUTADO":
            slot["ejecutadas"] += 1
        elif o["estado"] == "REPROGRAMADO":
            slot["reprogramadas"] += 1
        elif o["estado"] == "NO_REALIZADO":
            slot["no_realizadas"] += 1
    return slots


def build_rangos_semanas(slots: list[dict]) -> list[dict]:
    """Agrupa los 48 slots semanales en bloques de 3, para la tabla "% cumplimiento
    por rango de semanas" del resumen."""
    rangos = []
    for i in range(0, SEMANAS_POR_ANIO, 3):
        chunk = slots[i : i + 3]
        if not chunk:
            continue
        total = sum(c["total"] for c in chunk)
        ejecutadas = sum(c["ejecutadas"] for c in chunk)
        rango = f"{chunk[0]['label']} – {chunk[-1]['label']}" if len(chunk) > 1 else chunk[0]["label"]
        rangos.append({"rango": rango, "cumplimiento_pct": round(ejecutadas / total * 100) if total else 0})
    return rangos
