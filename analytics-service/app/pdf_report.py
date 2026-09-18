"""Genera el PDF del plan de acción con reportlab, replicando la MISMA plantilla
visual que backend/src/modules/auditorias/export-pdf.service.ts (título, leyenda,
franja oscura por categoría, bloques de actividad con línea divisoria y un resumen
al final) en vez de un documento aparte con portada y gráfico."""

from io import BytesIO

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .report_time import formatear_generado_en
from .styles import CATEGORY_FILL_HEX, HEADER_FILL_HEX, PRIORIDAD_COLOR_HEX, PRIORIDAD_FILL_HEX

ANCHO_TABLA = 17 * cm


def _hex(h: str) -> colors.Color:
    return colors.HexColor(f"#{h}")


def _semaforo_fill(pct: float) -> colors.Color:
    return _hex(PRIORIDAD_FILL_HEX["Bajo"] if pct >= 90 else PRIORIDAD_FILL_HEX["Medio"] if pct >= 70 else PRIORIDAD_FILL_HEX["Alto"])


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("PlanTitle", parent=base["Title"], fontSize=16, alignment=1, spaceAfter=4),
        "muted": ParagraphStyle("Muted", parent=base["Normal"], textColor=_hex("5B6472"), fontSize=9, alignment=1),
        "leyenda": ParagraphStyle("Leyenda", parent=base["Normal"], fontSize=9.5, textColor=_hex("555555")),
        "categoria": ParagraphStyle("Categoria", parent=base["Normal"], fontSize=10.5, textColor=colors.white, leftIndent=6),
        "actividad": ParagraphStyle("Actividad", parent=base["Normal"], fontSize=10, textColor=_hex("111111"), spaceBefore=6),
        "meta": ParagraphStyle("Meta", parent=base["Normal"], fontSize=8.5, textColor=_hex("666666")),
        "cronograma": ParagraphStyle("Cronograma", parent=base["Normal"], fontSize=8.5, textColor=_hex("333333")),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontSize=12, spaceBefore=10, spaceAfter=6),
        "cell": ParagraphStyle("Cell", parent=base["Normal"], fontSize=8, leading=10),
    }


def _write_titulo(story: list, styles: dict, auditoria_nombre: str, resumen: dict) -> None:
    story.append(Paragraph(f"PLAN DE ACCIÓN — {auditoria_nombre.upper()} {resumen['anioPlan']}", styles["title"]))
    generado_en = formatear_generado_en(resumen.get("generadoEn"))
    story.append(
        Paragraph(
            f"Generado el {generado_en} (hora Colombia) · Análisis basado en el desempeño {resumen['anioBase']}",
            styles["muted"],
        )
    )
    story.append(Spacer(1, 10))


def _write_leyenda(story: list, styles: dict) -> None:
    partes = " &nbsp;·&nbsp; ".join(
        f'<font color="#{PRIORIDAD_COLOR_HEX[p]}"><b>{p}</b></font>' for p in ("Alto", "Medio", "Bajo")
    )
    story.append(Paragraph(f"Leyenda de prioridad: {partes}", styles["leyenda"]))
    story.append(Spacer(1, 10))


def _write_categoria_header(story: list, styles: dict, categoria: str) -> None:
    banda = Table([[Paragraph(categoria.upper(), styles["categoria"])]], colWidths=[ANCHO_TABLA])
    banda.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), _hex(CATEGORY_FILL_HEX)),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(Spacer(1, 6))
    story.append(banda)
    story.append(Spacer(1, 4))


def _write_actividad(story: list, styles: dict, row: pd.Series) -> None:
    frecuencia = row["frecuencia"] if row["frecuencia"] == row["frecuencia_propuesta"] else f"{row['frecuencia']} → {row['frecuencia_propuesta']}"
    prioridad_color = PRIORIDAD_COLOR_HEX[row["prioridad"]]

    story.append(Paragraph(row["actividad"], styles["actividad"]))
    story.append(
        Paragraph(
            f'{row["responsable"]} &nbsp;·&nbsp; {frecuencia} &nbsp;·&nbsp; '
            f'<font color="#{prioridad_color}"><b>Prioridad {row["prioridad"]}</b></font>',
            styles["meta"],
        )
    )
    story.append(Paragraph(f"Recomendación: {row['recomendacion']}", styles["cronograma"]))
    story.append(
        Paragraph(
            f'Cronograma propuesto: <font color="#{prioridad_color}">{row["cronograma_propuesto"]}</font>',
            styles["cronograma"],
        )
    )
    story.append(Spacer(1, 4))
    linea = Table([[""]], colWidths=[ANCHO_TABLA])
    linea.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#EEEEEE"))]))
    story.append(linea)
    story.append(Spacer(1, 4))


def _write_plan(story: list, styles: dict, plan: pd.DataFrame) -> None:
    for categoria, grupo in plan.groupby("categoria", sort=True):
        _write_categoria_header(story, styles, categoria)
        for _, row in grupo.iterrows():
            _write_actividad(story, styles, row)


def _tabla_resumen(headers: list[str], data_rows: list[list], col_widths: list[float], fill_col: int | None = None) -> Table:
    data = [headers] + data_rows
    table = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), _hex(HEADER_FILL_HEX)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E0E0E0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if fill_col is not None:
        for i, row in enumerate(data_rows, start=1):
            pct = float(str(row[fill_col]).replace("%", ""))
            style.append(("BACKGROUND", (fill_col, i), (fill_col, i), _semaforo_fill(pct)))
    table.setStyle(TableStyle(style))
    return table


def _write_resumen(story: list, styles: dict, resumen: dict, cat_metrics: pd.DataFrame) -> None:
    story.append(PageBreak())
    story.append(Paragraph(f"RESUMEN / TOTALES {resumen['anioPlan']}", styles["h2"]))

    kpi_rows = [
        [
            "Actividades analizadas",
            f"Cumplimiento general {resumen['anioBase']}",
            "Prioridad alta",
            "Prioridad media",
            "Prioridad baja / sin cambios",
            f"Ocurrencias propuestas {resumen['anioPlan']}",
        ],
        [
            str(resumen["totalActividades"]),
            f"{resumen['cumplimientoGeneral']}%",
            str(resumen["riesgoAlto"]),
            str(resumen["riesgoMedio"]),
            str(resumen["riesgoBajo"]),
            str(resumen["ocurrenciasPropuestas"]),
        ],
    ]
    kpi_table = Table(kpi_rows, colWidths=[ANCHO_TABLA / 6] * 6)
    kpi_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E0E0E0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story += [kpi_table, Spacer(1, 14)]

    story.append(Paragraph("Detalle por categoría", styles["h2"]))
    detalle_rows = [
        [
            row["categoria"],
            str(int(row["total_actividades"])),
            f"{row['cumplimiento_promedio']}%",
            str(int(row["actividades_riesgo_alto"])),
            str(int(row["actividades_riesgo_medio"])),
        ]
        for _, row in cat_metrics.iterrows()
    ]
    story.append(
        _tabla_resumen(
            ["Categoría", "Actividades", "Cumplimiento promedio", "Riesgo alto", "Riesgo medio"],
            detalle_rows,
            [5.5 * cm, 3 * cm, 4 * cm, 3 * cm, 3 * cm],
            fill_col=2,
        )
    )


def build_pdf_report(auditoria_nombre: str, resumen: dict, cat_metrics: pd.DataFrame, plan: pd.DataFrame) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
    )
    styles = _styles()
    story: list = []
    _write_titulo(story, styles, auditoria_nombre, resumen)
    _write_leyenda(story, styles)
    _write_plan(story, styles, plan)
    _write_resumen(story, styles, resumen, cat_metrics)

    doc.build(story)
    return buffer.getvalue()
