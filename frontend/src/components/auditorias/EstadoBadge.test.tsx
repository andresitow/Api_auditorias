import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ESTADO_CFG, EstadoBadge } from "./EstadoBadge";
import { Semaforo } from "./Semaforo";
import type { EstadoActividad } from "@/types/auditorias";

const ESTADOS: [EstadoActividad, string, string][] = [
  ["PLANEADO", "P", "Planeado"],
  ["EJECUTADO", "E", "Ejecutado"],
  ["REPROGRAMADO", "R", "Reprogramado"],
  ["NO_REALIZADO", "N", "No realizado"],
];

describe("EstadoBadge", () => {
  it.each(ESTADOS)("%s muestra letra %s y etiqueta %s", (estado, letra, label) => {
    render(<EstadoBadge estado={estado} />);
    expect(screen.getByText(letra)).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(ESTADOS)("%s en modo compacto muestra solo la letra", (estado, letra, label) => {
    render(<EstadoBadge estado={estado} compact />);
    expect(screen.getByText(letra)).toBeInTheDocument();
    expect(screen.queryByText(label)).toBeNull();
  });

  it("cada estado usa su propio color (bg-*-bg / text-*)", () => {
    const clases = ESTADOS.map(([estado]) => ESTADO_CFG[estado].classes);
    expect(new Set(clases).size).toBe(4);
    expect(ESTADO_CFG.EJECUTADO.classes).toContain("green");
    expect(ESTADO_CFG.NO_REALIZADO.classes).toContain("red");
    expect(ESTADO_CFG.REPROGRAMADO.classes).toContain("orange");
    expect(ESTADO_CFG.PLANEADO.classes).toContain("blue");
  });

  it("aplica la clase del estado al contenedor", () => {
    const { container } = render(<EstadoBadge estado="EJECUTADO" />);
    expect(container.firstElementChild?.className).toContain(ESTADO_CFG.EJECUTADO.classes);
  });

  it("ESTADO_CFG cubre exactamente los 4 estados del backend (enum EstadoActividad)", () => {
    expect(Object.keys(ESTADO_CFG).sort()).toEqual(["EJECUTADO", "NO_REALIZADO", "PLANEADO", "REPROGRAMADO"]);
  });
});

describe("Semaforo", () => {
  it.each([
    ["verde", "En cumplimiento", "green"],
    ["amarillo", "En riesgo", "yellow"],
    ["rojo", "Crítico", "red"],
  ] as const)("%s => '%s'", (estado, label, color) => {
    const { container } = render(<Semaforo estado={estado} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain(`text-${color}`);
    expect(container.querySelector(`.bg-${color}`)).not.toBeNull();
  });

  it("cada semáforo muestra un único texto de estado", () => {
    render(<Semaforo estado="verde" />);
    expect(screen.queryByText("En riesgo")).toBeNull();
    expect(screen.queryByText("Crítico")).toBeNull();
  });
});
