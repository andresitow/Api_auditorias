"""Analiza archivos .xlsx del plan de trabajo y devuelve filas de actividad ya
validadas, listas para que el backend (NestJS) las sincronice en Postgres. Este
módulo es la única fuente de verdad para leer el Excel — el backend ya no
parsea el archivo, solo llama a POST /plan-trabajo/parse-excel (ver main.py) y
persiste el resultado.

Soporta los dos formatos que puede subir el usuario desde la app web (botón
"Reemplazar plan desde Excel"):

- Plantilla simple (la que genera el backend en
  GET /auditorias/:id/activities/import-excel/plantilla): una fila por
  actividad con columna "Categoría" explícita.
- Plan nativo "PLAN TRABAJO ANUAL SIG" (el formato ancho real que usa el
  área): no tiene columna de categoría — las categorías son filas A:D
  fusionadas con fondo de color que actúan de encabezado de sección, y las
  actividades debajo heredan esa categoría hasta la siguiente fila de
  encabezado (ver find_single_row_abcd_merges()). También la usa
  scripts/plan_trabajo_sync.py para detectar la misma estructura al limpiar
  el archivo original in-place.

openpyxl entiende de forma nativa las fusiones de celda y ya normaliza el
texto enriquecido (negritas, saltos de línea decorativos) a texto plano en
`cell.value`, así que este análisis no necesita reconstruir eso a mano como
sí hacía el importador anterior en TypeScript (exceljs expone rich-text como
un objeto aparte).

Además de las columnas A:D, el plan nativo trae una grilla H:BC de 12 meses x
4 columnas (una franja de 4 columnas por mes, ver find_single_row_abcd_merges
y _codigos_mensuales) donde cada actividad ya tiene marcado su código real
P/E/R/N (Planeado/Ejecutado/Reprogramado/No realizado) para los meses que ya
transcurrieron. El importador anterior solo traía la definición de la
actividad (categoría/nombre/responsable/frecuencia) e ignoraba esta grilla
por completo, así que todas las ocurrencias quedaban en PLANEADO sin importar
lo que diga el Excel — eso es lo que hacía ver mal el % de cumplimiento en el
dashboard. Ahora _periodos_desde_codigos() traduce esos códigos a los mismos
identificadores de periodo que genera
backend/src/modules/auditorias/periods.util.ts (p.ej. "2026-03" para
MENSUAL, "2026-Q1" para TRIMESTRAL), para que el backend pueda ubicar la
ocurrencia exacta y ponerle el estado real en vez de dejarla en PLANEADO."""

from __future__ import annotations

import io
import re
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from openpyxl import load_workbook
from openpyxl.workbook.workbook import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from openpyxl.utils import column_index_from_string

# Debe reflejar exactamente los valores del enum Frecuencia de
# backend/prisma/schema.prisma — el backend usa el string tal cual, sin
# volver a mapearlo.
FRECUENCIA_ALIASES: dict[str, str] = {
    "DIARIO": "DIARIO",
    "DIARIA": "DIARIO",
    "MENSUAL": "MENSUAL",
    "BIMENSUAL": "BIMENSUAL",
    "TRIMESTRAL": "TRIMESTRAL",
    "SEMESTRAL": "SEMESTRAL",
    "ANUAL": "ANUAL",
    "UNICA": "UNICA",
    "ÚNICA": "UNICA",
    "A_DEMANDA": "A_DEMANDA",
    "A DEMANDA": "A_DEMANDA",
    "CUANDO_SE_REQUIERA": "CUANDO_SE_REQUIERA",
    "CUANDO SE REQUIERA": "CUANDO_SE_REQUIERA",
}

FOOTER_PREFIXES = ("total", "%")

# Mapea el código de una celda de la grilla mensual al enum EstadoActividad de
# backend/prisma/schema.prisma. Coincide con VALID_ESTADOS de
# scripts/plan_trabajo_sync.py (P/E/R/N).
ESTADO_MAP: dict[str, str] = {
    "P": "PLANEADO",
    "E": "EJECUTADO",
    "R": "REPROGRAMADO",
    "N": "NO_REALIZADO",
}

MESES_EN_ANIO = 12
WEEK_FIRST = column_index_from_string("H")
WEEK_LAST = column_index_from_string("BC")
COLUMNAS_POR_MES = (WEEK_LAST - WEEK_FIRST + 1) // MESES_EN_ANIO  # 48 / 12 = 4

# Prioridad para resolver conflictos cuando dos columnas del mismo periodo (p.ej. dos
# de los 3 meses de un trimestre) traen códigos distintos: una marca ya ejecutada, no
# realizada o reprogramada es una señal fuerte de que algo pasó con esa ocurrencia y no
# debería quedar tapada por un "P" que en la práctica casi siempre es solo la plantilla
# sin borrar (nadie vuelve a marcar "Planeado" algo que ya se ejecutó). Por eso se elige
# por prioridad de señal, no por cuál celda está más a la derecha/es cronológicamente
# "última" — eso fue justamente lo que subestimaba el conteo de ejecutadas frente al
# total real de celdas "E" del Excel.
ESTADO_PRIORIDAD: dict[str, int] = {"EJECUTADO": 0, "REPROGRAMADO": 1, "NO_REALIZADO": 2, "PLANEADO": 3}


@dataclass
class FilaError:
    fila: int
    motivo: str


@dataclass
class PeriodoEstado:
    periodo: str
    estado: str
    # True para A_DEMANDA/CUANDO_SE_REQUIERA: esas frecuencias no pre-generan
    # ocurrencias (ver periods.util.ts), así que si el backend no encuentra una
    # ocurrencia con ese periodo debe crearla (occurrence ad-hoc), no ignorarla
    # como sí corresponde para las frecuencias que sí se pre-generan.
    esAdHoc: bool = False


@dataclass
class FilaActividad:
    fila: int
    categoria: str
    nombre: str
    responsable: str
    frecuencia: str
    descripcionEvidencia: str | None = None
    observacion: str | None = None
    activa: bool = True
    fechaEspecifica: str | None = None
    periodos: list[PeriodoEstado] = field(default_factory=list)


@dataclass
class ParseResult:
    formato: str  # "plantilla" | "nativo"
    anio: int = 0
    filas: list[FilaActividad] = field(default_factory=list)
    errores: list[FilaError] = field(default_factory=list)


class PlanTrabajoParseError(ValueError):
    """El archivo no tiene ninguno de los dos formatos reconocidos."""


def cell_text(valor: Any) -> str:
    """openpyxl ya devuelve texto plano (str) para celdas normales y de texto
    enriquecido; solo hace falta normalizar fechas/números y recortar."""
    if valor is None:
        return ""
    if hasattr(valor, "isoformat"):  # date / datetime
        return valor.isoformat()[:10]
    return str(valor).strip()


def normalizar_espacios(valor: str) -> str:
    """Colapsa espacios sueltos y recorta cada línea, preservando saltos de
    línea internos legítimos (a diferencia de normalizar_para_comparar, que
    los aplana para comparar texto de forma tolerante)."""
    lineas = valor.split("\n")
    return "\n".join(" ".join(l.split()) for l in lineas).strip()


def normalizar_para_comparar(valor: str) -> str:
    return " ".join(valor.split()).strip().lower()


def parse_frecuencia(raw: str) -> str | None:
    return FRECUENCIA_ALIASES.get(raw.strip().upper())


def parse_activa(raw: str) -> bool:
    if not raw:
        return True
    return raw.strip().lower() not in {"no", "false", "0", "inactiva", "inactivo"}


def find_single_row_abcd_merges(ws: Worksheet) -> list[int]:
    """Filas cuyo rango combinado ocupa exactamente A:D en una sola fila: es el
    patrón de encabezado de sección/categoría del plan nativo (también lo usan,
    inofensivamente, las filas de totales al final de la hoja — is_footer_row()
    las distingue por su texto)."""
    filas = []
    for rango in ws.merged_cells.ranges:
        if rango.min_row != rango.max_row:
            continue
        if rango.min_col != 1 or rango.max_col != 4:
            continue
        filas.append(rango.min_row)
    return sorted(filas)


def is_footer_row(texto_normalizado: str) -> bool:
    return texto_normalizado.startswith(FOOTER_PREFIXES)


def _codigo_mes(ws: Worksheet, row: int, mes_index0: int) -> str | None:
    """Primer código P/E/R/N reconocible entre las 4 columnas de ese mes. En la
    práctica solo una de las 4 columnas trae dato (representan semanas del mes
    y el código se pone en la semana en que realmente se hizo/planeó la
    actividad); si hubiera más de una marcada, nos quedamos con la primera."""
    col_base = WEEK_FIRST + mes_index0 * COLUMNAS_POR_MES
    for i in range(COLUMNAS_POR_MES):
        valor = cell_text(ws.cell(row, col_base + i).value)
        if valor and valor.strip().upper() in ESTADO_MAP:
            return valor.strip().upper()
    return None


def _codigos_mensuales(ws: Worksheet, row: int) -> list[str | None]:
    return [_codigo_mes(ws, row, mes) for mes in range(MESES_EN_ANIO)]


def _periodos_diario(ws: Worksheet, row: int, anio: int) -> list[PeriodoEstado]:
    """DIARIO en este archivo en la práctica se registra semana a semana (las 4
    columnas de cada mes SÍ se usan las 4, a diferencia del resto de frecuencias
    donde solo una trae dato — ver, por ejemplo, la actividad "Data Center").
    _codigos_mensuales() colapsaría eso a 1 código por mes y perdería la mayoría
    de las marcas reales, así que acá se lee cada una de las 48 columnas por
    separado y se mapea a la semana de periods.util.ts#weeksOfYear (mismo
    esquema: semana 1 = días 0-6 desde el 1 de enero, semana 2 = 7-13, etc.) más
    cercana. El Excel no da un día exacto dentro de la semana del mes, así que se
    aproxima con el punto medio de esa porción del mes — es una aproximación,
    pero muchísimo mejor que descartar por completo un seguimiento que sí es
    semanal en la realidad."""
    resultado: list[PeriodoEstado] = []
    inicio_anio = date(anio, 1, 1)
    for mes in range(MESES_EN_ANIO):
        dias_del_mes = monthrange(anio, mes + 1)[1]
        for semana in range(COLUMNAS_POR_MES):
            col = WEEK_FIRST + mes * COLUMNAS_POR_MES + semana
            valor = cell_text(ws.cell(row, col).value)
            codigo = valor.strip().upper() if valor else None
            if not codigo or codigo not in ESTADO_MAP:
                continue
            dia_aprox = min(
                dias_del_mes,
                max(1, round((semana + 0.5) * dias_del_mes / COLUMNAS_POR_MES)),
            )
            dias_desde_inicio_anio = (date(anio, mes + 1, dia_aprox) - inicio_anio).days
            semana_sistema = dias_desde_inicio_anio // 7 + 1
            resultado.append(PeriodoEstado(f"{anio}-W{semana_sistema:02d}", ESTADO_MAP[codigo]))
    return resultado


def _periodos_desde_codigos(frecuencia: str, anio: int, codigos: list[str | None]) -> list[PeriodoEstado]:
    """Traduce los 12 códigos mensuales al mismo identificador de 'periodo' que
    genera periods.util.ts para cada frecuencia, para que el backend pueda
    encontrar la ocurrencia exacta.

    El objetivo es que cada reimportación deje la app IGUAL al archivo cargado,
    no solo que la "mejore": si alguien corrige una celda en el Excel (por
    ejemplo, borra una "E" que se marcó por error, o la cambia a "P"), la
    reimportación tiene que reflejar eso, no dejar pegado el estado de una
    carga anterior. Por eso, para las frecuencias que sí pre-generan ocurrencias
    (MENSUAL/BIMENSUAL/TRIMESTRAL/SEMESTRAL/ANUAL) se devuelve SIEMPRE un
    PeriodoEstado por cada periodo del año — PLANEADO por defecto si no hay
    ninguna celda marcada — en vez de omitir el periodo cuando está en blanco;
    el backend igual no toca nada si la ocurrencia ya está en ese estado (ver
    ImportExcelService.applyPeriodStatuses).

    A_DEMANDA/CUANDO_SE_REQUIERA se maneja distinto a propósito: como no
    pre-generan ocurrencias (periodsForYear devuelve []) y son frecuencias por
    evento (no "una vez por mes"), un mes en blanco no significa "poner en
    Planeado" sino simplemente "no hubo evento ese mes" — no hay nada que
    reflejar ahí, así que solo se emite un PeriodoEstado (esAdHoc=True) para
    los meses que sí traen una marca real.

    DIARIO se resuelve aparte (ver _periodos_diario, se registra semana a semana
    y no mes a mes) y UNICA queda afuera: no tiene periodos por año, su única
    ocurrencia ya se crea con fecha explícita al dar de alta la actividad."""

    def mas_prioritario(meses: range) -> str:
        presentes = [codigos[mes] for mes in meses if codigos[mes]]
        if not presentes:
            return "P"
        return min(presentes, key=lambda codigo: ESTADO_PRIORIDAD[ESTADO_MAP[codigo]])

    resultado: list[PeriodoEstado] = []

    if frecuencia == "MENSUAL":
        for mes in range(MESES_EN_ANIO):
            codigo = codigos[mes] or "P"
            resultado.append(PeriodoEstado(f"{anio}-{mes + 1:02d}", ESTADO_MAP[codigo]))
    elif frecuencia == "BIMENSUAL":
        for b in range(1, 7):
            codigo = mas_prioritario(range((b - 1) * 2, b * 2))
            resultado.append(PeriodoEstado(f"{anio}-B{b}", ESTADO_MAP[codigo]))
    elif frecuencia == "TRIMESTRAL":
        for q in range(1, 5):
            codigo = mas_prioritario(range((q - 1) * 3, q * 3))
            resultado.append(PeriodoEstado(f"{anio}-Q{q}", ESTADO_MAP[codigo]))
    elif frecuencia == "SEMESTRAL":
        for s in range(1, 3):
            codigo = mas_prioritario(range((s - 1) * 6, s * 6))
            resultado.append(PeriodoEstado(f"{anio}-S{s}", ESTADO_MAP[codigo]))
    elif frecuencia == "ANUAL":
        codigo = mas_prioritario(range(MESES_EN_ANIO))
        resultado.append(PeriodoEstado(f"{anio}", ESTADO_MAP[codigo]))
    elif frecuencia in ("A_DEMANDA", "CUANDO_SE_REQUIERA"):
        for mes in range(MESES_EN_ANIO):
            if codigos[mes]:
                resultado.append(
                    PeriodoEstado(f"{anio}-{mes + 1:02d}", ESTADO_MAP[codigos[mes]], esAdHoc=True)
                )

    return resultado


def _detectar_anio(ws: Worksheet) -> int:
    """El título ("PLAN DE TRABAJO ... 2026") ocupa la fusión B1:BC2 — se busca
    el primer año de 4 dígitos ahí; si no aparece, se asume el año actual."""
    for row in (1, 2):
        texto = cell_text(ws.cell(row, 2).value)
        match = re.search(r"(20\d{2})", texto)
        if match:
            return int(match.group(1))
    return datetime.now().year


def _validar_y_agregar(
    result: ParseResult,
    fila: int,
    categoria: str,
    nombre: str,
    responsable: str,
    frecuencia_raw: str,
    descripcion: str | None,
    observacion: str | None = None,
    activa_raw: str = "",
    fecha_especifica_raw: str = "",
    periodos: list[PeriodoEstado] | None = None,
) -> None:
    if not nombre:
        result.errores.append(FilaError(fila, "Falta el nombre de la actividad"))
        return
    if not responsable:
        result.errores.append(FilaError(fila, "Falta el responsable"))
        return
    frecuencia = parse_frecuencia(frecuencia_raw)
    if not frecuencia:
        result.errores.append(FilaError(fila, f'Frecuencia inválida: "{frecuencia_raw}"'))
        return
    if frecuencia == "UNICA" and not fecha_especifica_raw:
        result.errores.append(FilaError(fila, "La frecuencia UNICA requiere fecha específica"))
        return

    result.filas.append(
        FilaActividad(
            fila=fila,
            categoria=categoria,
            nombre=nombre,
            responsable=responsable,
            frecuencia=frecuencia,
            descripcionEvidencia=descripcion or None,
            observacion=observacion or None,
            activa=parse_activa(activa_raw),
            fechaEspecifica=fecha_especifica_raw or None,
            periodos=periodos or [],
        )
    )


def _parse_plantilla(ws: Worksheet) -> ParseResult:
    result = ParseResult(formato="plantilla")
    for row in range(2, ws.max_row + 1):
        categoria = cell_text(ws.cell(row, 1).value)
        nombre = cell_text(ws.cell(row, 2).value)
        responsable = cell_text(ws.cell(row, 3).value)
        frecuencia_raw = cell_text(ws.cell(row, 4).value)
        descripcion = cell_text(ws.cell(row, 5).value) or None
        observacion = cell_text(ws.cell(row, 6).value) or None
        activa_raw = cell_text(ws.cell(row, 7).value)
        fecha_raw = cell_text(ws.cell(row, 8).value)

        if not categoria and not nombre and not responsable and not frecuencia_raw:
            continue  # fila vacía

        if not categoria:
            result.errores.append(FilaError(row, "Falta la categoría"))
            continue

        _validar_y_agregar(
            result, row, categoria, nombre, responsable, frecuencia_raw, descripcion, observacion, activa_raw, fecha_raw
        )
    return result


def _parse_nativo(ws: Worksheet) -> tuple[ParseResult, bool]:
    anio = _detectar_anio(ws)
    result = ParseResult(formato="nativo", anio=anio)
    header_rows = set(find_single_row_abcd_merges(ws))
    categoria_actual: str | None = None
    hubo_categorias = False

    for row in range(2, ws.max_row + 1):
        if row in header_rows:
            texto = cell_text(ws.cell(row, 1).value)
            if texto and not is_footer_row(normalizar_para_comparar(texto)):
                categoria_actual = normalizar_espacios(texto)
                hubo_categorias = True
            continue  # una fila de encabezado nunca es, en sí misma, una actividad

        if not categoria_actual:
            continue  # todavía no llegamos a la primera categoría

        nombre = cell_text(ws.cell(row, 1).value)
        descripcion = cell_text(ws.cell(row, 2).value) or None
        responsable = cell_text(ws.cell(row, 3).value)
        frecuencia_raw = cell_text(ws.cell(row, 4).value)

        if not nombre and not responsable and not frecuencia_raw:
            continue  # fila vacía/espaciadora

        if is_footer_row(normalizar_para_comparar(nombre)):
            # Fila de verificación/total suelta después de la última categoría, sin la
            # fusión A:D que sí tienen las filas de totales "oficiales" (por eso
            # find_single_row_abcd_merges no la agarra). No es una actividad: se
            # ignora igual que las de header_rows, no se cuenta ni da error.
            continue

        frecuencia = parse_frecuencia(frecuencia_raw)
        if frecuencia == "DIARIO":
            periodos = _periodos_diario(ws, row, anio)
        elif frecuencia:
            periodos = _periodos_desde_codigos(frecuencia, anio, _codigos_mensuales(ws, row))
        else:
            periodos = []

        _validar_y_agregar(
            result, row, categoria_actual, nombre, responsable, frecuencia_raw, descripcion, periodos=periodos
        )

    return result, hubo_categorias


def parse_plan_trabajo(wb: Workbook) -> ParseResult:
    """Detecta el formato (plantilla simple vs. plan nativo con secciones de
    color) y devuelve las filas ya validadas y listas para sincronizar."""
    ws = wb.worksheets[0]
    header_a1 = normalizar_para_comparar(cell_text(ws.cell(1, 1).value))
    if header_a1 in ("categoría", "categoria"):
        result = _parse_plantilla(ws)
        result.anio = datetime.now().year  # la plantilla simple no trae grilla de estados
        return result

    result, hubo_categorias = _parse_nativo(ws)
    if not hubo_categorias:
        raise PlanTrabajoParseError(
            "No se reconoció ninguna sección/categoría en el archivo. Verificá que sea "
            "la plantilla del sistema o el plan de trabajo con las filas de categoría "
            "(fondo de color) intactas."
        )
    return result


def parse_plan_trabajo_bytes(contenido: bytes) -> ParseResult:
    wb = load_workbook(io.BytesIO(contenido))
    return parse_plan_trabajo(wb)
