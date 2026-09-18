"""Paleta compartida entre el Excel y el PDF. Los colores de PRIORIDAD_* replican
la lógica semáforo (verde/amarillo/rojo) de dashboard.service.ts; los de ESTADO_*
son los mismos hex que backend/src/modules/auditorias/plan-template.util.ts, para
que el plan de acción se sienta parte de la misma familia visual que los exports
Excel/PDF ya existentes."""

PRIORIDAD_COLOR_HEX = {
    "Alto": "B3261E",
    "Medio": "B15C00",
    "Bajo": "1F7A3D",
    "Sin datos": "5B6472",
}

PRIORIDAD_FILL_HEX = {
    "Alto": "FBE0E0",
    "Medio": "FCE8D5",
    "Bajo": "DFF5E1",
    "Sin datos": "E8EAED",
}

HEADER_FILL_HEX = "21262D"
CATEGORY_FILL_HEX = "3A4552"
TITLE_COLOR_HEX = "111111"
MUTED_COLOR_HEX = "5B6472"

PRIORIDAD_LETRA = {"Alto": "A", "Medio": "M", "Bajo": "B", "Sin datos": "S"}

# Grilla de 48 semanas (cronograma tipo Gantt), replicando el documento origen
# ("2026-Plan de Trabajo Anual"): banda "MESES DEL AÑO" + fila de meses + fila de
# semanas 1-4, con una celda coloreada en la semana propuesta de cada actividad.
MESES_BAND_FILL_HEX = "F4B183"
GRID_EMPTY_FILL_HEX = "F2F2F2"
GRID_BORDER_HEX = "D9D9D9"
