"""Sincroniza el Excel real 'PLAN TRABAJO ANUAL SIG' (plantilla con formato,
fusiones y formulas ya definidas) SIN reconstruirlo nunca desde cero:

  1. Abre la plantilla original con openpyxl (conserva formulas, colores,
     fusiones, anchos de columna tal cual estan en el archivo).
  2. Detecta la estructura de filas de la hoja en vez de asumir numeros fijos:
     las filas de categoria/seccion y las de totales son celdas A:D fusionadas
     en una sola fila (ver detectar_estructura()); todo lo que hay entre la
     primera fila de categoria y la primera fila de totales son actividades.
     Esto es necesario porque la plantilla real cambia de tamano de un año a
     otro (numero de categorias, numero de actividades por categoria).
  3. Si se pasa una fuente de datos nueva (--datos, mismo esquema XML usado
     hasta ahora: <Fila numero><Celda columna>valor</Celda></Fila>), compara
     cada celda de actividad contra el valor actual de la plantilla y
     unicamente reemplaza las que cambiaron.
  4. Ademas, en cada corrida, normaliza texto (espacios sueltos) y codigos de
     estado (may/minusculas) de las columnas de actividad, sin tocar nada
     que ya este correcto.
  5. Nunca escribe en las filas de totales/% de cumplimiento: esas celdas son
     formulas (=COUNTA/=COUNTIF) en la plantilla y Excel las recalcula solo
     con abrir el archivo. Sobreescribirlas con numeros literales rompería
     el recalculo automatico.

Uso:
    python plan_trabajo_sync.py <plantilla.xlsx> [--datos nuevos.xml] [--salida salida.xlsx]

Si no hay ningun cambio que aplicar, no se genera archivo de salida.
"""

from __future__ import annotations

import argparse
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

# app/ es hermano de scripts/, no un paquete instalado: hace falta agregar la
# raíz de analytics-service al sys.path para poder importar app.* al correr
# este script directo (python scripts/plan_trabajo_sync.py).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.plan_trabajo_parser import (  # noqa: E402
    find_single_row_abcd_merges,
    is_footer_row,
    normalizar_para_comparar,
)

SHEET_NAME = "PLAN TRABAJO ANUAL SIG"

WEEK_FIRST = column_index_from_string("H")
WEEK_LAST = column_index_from_string("BC")
TEXT_COLUMNS = ["A", "B", "C", "D"]

VALID_ESTADOS = {"P", "E", "R", "N"}


@dataclass
class Cambio:
    celda: str
    antes: object
    despues: object
    motivo: str

    def __str__(self) -> str:
        return f"{self.celda}: {self.antes!r} -> {self.despues!r} [{self.motivo}]"


@dataclass
class Estructura:
    """Filas de categoria/totales detectadas en la hoja (ver detectar_estructura)."""

    primera_fila: int
    ultima_fila: int
    categoria_rows: set[int]
    filas_totales: set[int]


def _es_fila_de_totales(ws: Worksheet, row: int) -> bool:
    valor = ws.cell(row, 1).value
    texto = normalizar_para_comparar(valor if isinstance(valor, str) else "")
    return is_footer_row(texto)


def detectar_estructura(ws: Worksheet) -> Estructura:
    """Reemplaza los numeros de fila fijos que tenia esta plantilla antes: los
    calcula a partir de las fusiones A:D de una sola fila (misma deteccion que
    usa app/plan_trabajo_parser.py para el importador de la app web), que es
    el patron estructural real, independiente de cuantas categorias/actividades
    tenga el archivo de este año."""
    candidatas = find_single_row_abcd_merges(ws)
    categoria_rows: set[int] = set()
    filas_totales: set[int] = set()
    for row in candidatas:
        if _es_fila_de_totales(ws, row):
            filas_totales.add(row)
        else:
            categoria_rows.add(row)

    if not categoria_rows:
        raise ValueError(
            "No se reconoció ninguna fila de categoría (fusión A:D con texto) en "
            f"la hoja '{ws.title}'. Verificá que sea la plantilla real y que las "
            "fusiones de las filas de sección sigan intactas."
        )

    primera_fila = min(categoria_rows)
    ultima_fila = (min(filas_totales) - 1) if filas_totales else ws.max_row
    return Estructura(primera_fila, ultima_fila, categoria_rows, filas_totales)


def normalizar_texto(valor: object) -> str | None:
    """None si no hace falta tocar la celda; si no, el texto ya normalizado."""
    if not isinstance(valor, str):
        return None
    lineas = valor.split("\n")
    lineas_limpias = [" ".join(linea.split()) for linea in lineas]
    limpio = "\n".join(lineas_limpias).strip("\n")
    # Preserva un posible salto de linea final ya normalizado a "sin espacios colgantes"
    if limpio == valor:
        return None
    return limpio


def normalizar_estado(valor: object) -> tuple[str | None, str | None]:
    """(valor_normalizado_o_None, advertencia_o_None). No decide por su cuenta
    valores que no reconoce: los reporta para revisión humana en vez de adivinar."""
    if valor is None:
        return None, None
    if not isinstance(valor, str):
        return None, f"valor no-texto inesperado en celda de estado: {valor!r}"
    limpio = valor.strip().upper()
    if limpio == "":
        return (None if valor == "" else ""), None
    if limpio not in VALID_ESTADOS:
        return None, f"'{valor}' no es un código P/E/R/N válido"
    return (limpio if limpio != valor else None), None


def cargar_datos_xml(xml_path: Path, filas_solo_formula: set[int]) -> dict[tuple[int, str], str]:
    """Aplana el XML a {(fila, columna_letra): valor}. Ignora las filas de
    totales/% de cumplimiento porque en la plantilla real esas celdas son
    formulas, no valores — nunca deben sobreescribirse con literales."""
    tree = ET.parse(xml_path)
    datos: dict[tuple[int, str], str] = {}
    for fila_el in tree.getroot().findall("Fila"):
        row = int(fila_el.attrib["numero"])
        if row in filas_solo_formula:
            continue
        for celda_el in fila_el.findall("Celda"):
            col = celda_el.attrib["columna"]
            datos[(row, col)] = (celda_el.text or "").strip("\n")
    return datos


def sincronizar(
    ws: Worksheet,
    estructura: Estructura,
    datos_nuevos: dict[tuple[int, str], str] | None = None,
) -> tuple[list[Cambio], list[str]]:
    cambios: list[Cambio] = []
    advertencias: list[str] = []

    for row in range(estructura.primera_fila, estructura.ultima_fila + 1):
        if row in estructura.categoria_rows:
            continue

        # Columnas de texto: Actividad, Descripción, Responsable, Frecuencia
        for col_letter in TEXT_COLUMNS:
            col = column_index_from_string(col_letter)
            cell = ws.cell(row, col)
            actual = cell.value
            objetivo = actual

            if datos_nuevos is not None:
                nuevo = datos_nuevos.get((row, col_letter))
                if nuevo is not None:
                    objetivo = nuevo

            normalizado = normalizar_texto(objetivo)
            valor_final = normalizado if normalizado is not None else objetivo

            if valor_final != actual:
                motivo = "reemplazo desde nueva fuente" if objetivo != actual else "limpieza de espacios"
                cambios.append(Cambio(f"{col_letter}{row}", actual, valor_final, motivo))
                cell.value = valor_final

        # Columnas de estado semanal H:BC
        for col in range(WEEK_FIRST, WEEK_LAST + 1):
            col_letter = get_column_letter(col)
            cell = ws.cell(row, col)
            actual = cell.value
            objetivo = actual

            if datos_nuevos is not None:
                nuevo = datos_nuevos.get((row, col_letter))
                if nuevo is not None:
                    objetivo = nuevo if nuevo != "" else None

            normalizado, advertencia = normalizar_estado(objetivo)
            if advertencia:
                advertencias.append(f"{col_letter}{row}: {advertencia}")
                continue
            valor_final = normalizado if normalizado is not None else objetivo

            if valor_final != actual:
                motivo = "reemplazo desde nueva fuente" if objetivo != actual else "normalización de código"
                cambios.append(Cambio(f"{col_letter}{row}", actual, valor_final, motivo))
                cell.value = valor_final

    return cambios, advertencias


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("plantilla", type=Path, help="Ruta al .xlsx original (la plantilla real, con formato)")
    parser.add_argument("--datos", type=Path, default=None, help="XML con los valores nuevos a sincronizar (opcional)")
    parser.add_argument("--salida", type=Path, default=None, help="Ruta de salida (por defecto: <plantilla>__sync.xlsx)")
    args = parser.parse_args()

    wb = load_workbook(args.plantilla)
    ws = wb[SHEET_NAME]

    try:
        estructura = detectar_estructura(ws)
    except ValueError as err:
        print(f"Error: {err}", file=sys.stderr)
        raise SystemExit(1) from err

    print(f"Plantilla: {args.plantilla}")
    print(
        f"Estructura detectada: {len(estructura.categoria_rows)} categoría(s) en filas "
        f"{sorted(estructura.categoria_rows)}, actividades entre las filas "
        f"{estructura.primera_fila} y {estructura.ultima_fila}"
        + (f", totales en filas {sorted(estructura.filas_totales)}" if estructura.filas_totales else "")
    )

    datos_nuevos = cargar_datos_xml(args.datos, estructura.filas_totales) if args.datos else None
    cambios, advertencias = sincronizar(ws, estructura, datos_nuevos)

    print(f"Fuente de datos nueva: {args.datos or '(ninguna, solo limpieza)'}")
    print(f"Cambios aplicados: {len(cambios)}")
    for c in cambios:
        print(f"  {c}")
    print(f"Advertencias (celdas NO tocadas, requieren revisión manual): {len(advertencias)}")
    for a in advertencias:
        print(f"  {a}")

    if not cambios:
        print("\nSin cambios: no se generó archivo de salida.")
        return

    salida = args.salida or args.plantilla.with_name(args.plantilla.stem + "__sync.xlsx")
    wb.save(salida)
    print(f"\nArchivo sincronizado guardado en: {salida}")


if __name__ == "__main__":
    main()
