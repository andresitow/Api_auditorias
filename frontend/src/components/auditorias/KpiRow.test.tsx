import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KpiRow } from "./KpiRow";
import { KPI_FILTERS } from "./KpiDetailPanel";
import type { KpiFilterKind } from "./KpiDetailPanel";
import type { KpiSummary } from "@/types/auditorias";

const kpis: KpiSummary = {
  anio: 2026,
  total: 40,
  porEstado: { PLANEADO: 10, EJECUTADO: 20, REPROGRAMADO: 3, NO_REALIZADO: 7 },
  vencidas: 5,
  proximasAVencer: 2,
  cumplimientoPct: 50,
  semaforo: "rojo",
};

// [etiqueta visible, valor esperado, clave del filtro]
const TILES: [string, string, KpiFilterKind][] = [
  ["Total", "40", "total"],
  ["Planeadas", "10", "PLANEADO"],
  ["Ejecutadas", "20", "EJECUTADO"],
  ["Reprogramadas", "3", "REPROGRAMADO"],
  ["No realizadas", "7", "NO_REALIZADO"],
  ["Vencidas", "5", "vencidas"],
  ["Próx. a vencer", "2", "proximas"],
];

describe("KpiRow", () => {
  it("renderiza las 7 tarjetas con su valor", () => {
    render(<KpiRow kpis={kpis} />);
    for (const [label, valor] of TILES) {
      const tarjeta = screen.getByText(label).closest("button")!;
      expect(tarjeta).toHaveTextContent(valor);
    }
    expect(screen.getAllByRole("button")).toHaveLength(7);
  });

  it.each(TILES)("clic en '%s' llama onSelect con '%s' -> %s", async (label, _valor, kind) => {
    const onSelect = vi.fn();
    render(<KpiRow kpis={kpis} onSelect={onSelect} />);
    await userEvent.click(screen.getByText(label));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(kind);
  });

  it("sin onSelect los clics no lanzan errores", async () => {
    render(<KpiRow kpis={kpis} />);
    await expect(userEvent.click(screen.getByText("Total"))).resolves.not.toThrow();
  });

  it("marca como seleccionada solo la tarjeta indicada", () => {
    render(<KpiRow kpis={kpis} selected="vencidas" />);
    const seleccionadas = screen.getAllByRole("button").filter((b) => b.className.includes("outline-2"));
    expect(seleccionadas).toHaveLength(1);
    expect(seleccionadas[0]).toHaveTextContent("Vencidas");
  });

  it("sin selección ninguna tarjeta queda marcada", () => {
    render(<KpiRow kpis={kpis} selected={null} />);
    expect(screen.getAllByRole("button").filter((b) => b.className.includes("outline-2"))).toHaveLength(0);
  });

  it("muestra ceros cuando no hay datos", () => {
    render(
      <KpiRow
        kpis={{
          ...kpis,
          total: 0,
          porEstado: { PLANEADO: 0, EJECUTADO: 0, REPROGRAMADO: 0, NO_REALIZADO: 0 },
          vencidas: 0,
          proximasAVencer: 0,
        }}
      />,
    );
    for (const [label] of TILES) expect(screen.getByText(label).closest("button")).toHaveTextContent("0");
  });

  it("cada clave de tarjeta existe en KPI_FILTERS (consistencia con KpiDetailPanel)", () => {
    for (const [, , kind] of TILES) expect(KPI_FILTERS[kind]).toBeDefined();
  });
});

describe("KPI_FILTERS", () => {
  it("cada estado filtra por su enum", () => {
    expect(KPI_FILTERS.PLANEADO.estado).toBe("PLANEADO");
    expect(KPI_FILTERS.EJECUTADO.estado).toBe("EJECUTADO");
    expect(KPI_FILTERS.REPROGRAMADO.estado).toBe("REPROGRAMADO");
    expect(KPI_FILTERS.NO_REALIZADO.estado).toBe("NO_REALIZADO");
  });

  it("vencidas usa overdue y próximas usa dueSoon, sin estado explícito", () => {
    expect(KPI_FILTERS.vencidas).toMatchObject({ overdue: true });
    expect(KPI_FILTERS.vencidas.estado).toBeUndefined();
    expect(KPI_FILTERS.proximas).toMatchObject({ dueSoon: true });
    expect(KPI_FILTERS.proximas.estado).toBeUndefined();
  });

  it("total no aplica ningún filtro", () => {
    expect(KPI_FILTERS.total.estado).toBeUndefined();
    expect(KPI_FILTERS.total.overdue).toBeUndefined();
    expect(KPI_FILTERS.total.dueSoon).toBeUndefined();
  });
});
