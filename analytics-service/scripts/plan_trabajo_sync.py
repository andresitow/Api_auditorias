"""Sincroniza el Excel real 'PLAN TRABAJO ANUAL SIG' (plantilla con formato,
fusiones y formulas ya definidas) SIN reconstruirlo nunca desde cero:

  1. Abre la plantilla original con openpyxl (conserva formulas, colores,
     fusiones, anchos de columna tal cual estan en el archivo).
  2. Si se pasa una fuente de datos nueva (--datos, mismo esquema XML usado
     hasta ahora: <Fila numero><Celda columna>valor</Celda></Fila>), compara
     cada celda de actividad contra el valor actual de la plantilla y
     unicamente reemplaza las que cambiaron.
  3. Ademas, en cada corrida, normaliza texto (espacios sueltos) y codigos de
     estado (may/minusculas) de las columnas de actividad, sin tocar nada
     que ya este correcto.
  4. Nunca escribe en las filas de totales/% de cumplimiento: esas celdas son
     formulas (=COUNTA/=COUNTIF) en la plantilla y Excel las recalcula solo
     con abrir el archivo. Sobreescribirlas con numeros literales rompería
     el recalculo automatico.

Uso:
    python plan_trabajo_sync.py <plantilla.xlsx> [--datos nuevos.xml] [--salida salida.xlsx]

Si no hay ningun cambio que aplicar, no se genera archivo de salida.
"""

from __future__ import annotations

import argparse
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

SHEET_NAME = "PLAN TRABAJO ANUAL SIG"

WEEK_FIRST = column_index_from_string("H")
WEEK_LAST = column_index_from_string("BC")
TEXT_COLUMNS = ["A", "B", "C", "D"]

CATEGORIA_ROWS = {7, 22, 27}
FIRST_ACTIVITY_ROW = 8
LAST_ACTIVITY_ROW = 34
TOTALES_ROWS = {35, 36, 37, 38}
PORCENTAJE_ROW = 39
FILAS_SOLO_FORMULA = TOTALES_ROWS | {PORCENTAJE_ROW}

VALID_ESTADOS = {"P", "E", "R", "N"}


@dataclass
class Cambio:
    celda: str
    antes: object
    despues: object
    motivo: str

    def __str__(self) -> str:
        return f"{self.celda}: {self.antes!r} -> {self.despues!r} [{self.motivo}]"


def _es_fila_de_actividad(row: int) -> bool:
    return FIRST_ACTIVITY_ROW <= row <= LAST_ACTIVITY_ROW and row not in CATEGORIA_ROWS


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


def cargar_datos_xml(xml_path: Path) -> dict[tuple[int, str], str]:
    """Aplana el XML a {(fila, columna_letra): valor}. Ignora las filas de
    totales/% de cumplimiento porque en la plantilla real esas celdas son
    formulas, no valores — nunca deben sobreescribirse con literales."""
    tree = ET.parse(xml_path)
    datos: dict[tuple[int, str], str] = {}
    for fila_el in tree.getroot().findall("Fila"):
        row = int(fila_el.attrib["numero"])
        if row in FILAS_SOLO_FORMULA:
            continue
        for celda_el in fila_el.findall("Celda"):
            col = celda_el.attrib["columna"]
            datos[(row, col)] = (celda_el.text or "").strip("\n")
    return datos


def sincronizar(
    ws: Worksheet,
    datos_nuevos: dict[tuple[int, str], str] | None = None,
) -> tuple[list[Cambio], list[str]]:
    cambios: list[Cambio] = []
    advertencias: list[str] = []

    for row in range(FIRST_ACTIVITY_ROW, LAST_ACTIVITY_ROW + 1):
        if not _es_fila_de_actividad(row):
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

    datos_nuevos = cargar_datos_xml(args.datos) if args.datos else None
    cambios, advertencias = sincronizar(ws, datos_nuevos)

    print(f"Plantilla: {args.plantilla}")
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
