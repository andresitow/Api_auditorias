import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OccurrencesTable } from "./OccurrencesTable";
import type { ActivityOccurrence } from "@/types/auditorias";

// El componente calcula "hoy" con new Date(): se fija el reloj (solo Date).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-15T12:00:00Z") });
});
afterEach(() => vi.useRealTimers());

function occ(over: Partial<ActivityOccurrence> = {}): ActivityOccurrence {
  return {
    id: "o1",
    activityId: "a1",
    activity: {
      id: "a1",
      categoria: "Servidores",
      nombre: "Revisar backups",
      responsable: "Ana",
      frecuencia: "MENSUAL",
    } as ActivityOccurrence["activity"],
    periodo: "2026-03",
    fechaProgramada: "2026-03-31T00:00:00.000Z",
    fechaEjecucion: null,
    estado: "PLANEADO",
    observaciones: null,
    evidenciaUrl: null,
    evidenciaDescripcion: null,
    evidencias: [],
    reprogramaciones: 0,
    transcripcionRevisada: false,
    createdBy: null,
    updatedBy: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const handlers = () => ({
  onChangeEstado: vi.fn(),
  onReprogramar: vi.fn(),
  onEditarFecha: vi.fn(),
  onHistorial: vi.fn(),
  onEliminarActividad: vi.fn(),
});

describe("OccurrencesTable", () => {
  it("sin ocurrencias muestra el mensaje vacío y ninguna tabla", () => {
    render(<OccurrencesTable occurrences={[]} {...handlers()} />);
    expect(screen.getByText("No hay ocurrencias que coincidan con los filtros.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renderiza una fila por ocurrencia con sus datos", () => {
    render(<OccurrencesTable occurrences={[occ(), occ({ id: "o2", periodo: "2026-04" })]} {...handlers()} />);
    expect(screen.getAllByRole("row")).toHaveLength(3); // encabezado + 2
    expect(screen.getAllByText("Revisar backups")).toHaveLength(2);
    expect(screen.getByText("2026-03")).toBeInTheDocument();
    expect(screen.getAllByText("Servidores")).toHaveLength(2);
  });

  describe("formato de fechas", () => {
    it("F. programada se muestra DD/MM/AAAA tomando solo la parte de fecha del ISO", () => {
      render(<OccurrencesTable occurrences={[occ({ fechaProgramada: "2026-12-31T23:59:59.000Z" })]} {...handlers()} />);
      expect(screen.getByText("31/12/2026")).toBeInTheDocument();
    });

    it("F. ejecución nula muestra guion largo", () => {
      render(<OccurrencesTable occurrences={[occ({ fechaEjecucion: null })]} {...handlers()} />);
      const fila = screen.getAllByRole("row")[1];
      const celdas = within(fila).getAllByRole("cell");
      expect(celdas[6]).toHaveTextContent("—");
    });

    it("F. ejecución con valor se formatea DD/MM/AAAA", () => {
      render(
        <OccurrencesTable
          occurrences={[occ({ estado: "EJECUTADO", fechaEjecucion: "2026-03-10T00:00:00.000Z" })]}
          {...handlers()}
        />,
      );
      const celdas = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
      expect(celdas[6]).toHaveTextContent("10/03/2026");
    });
  });

  describe("marca de vencida", () => {
    it("PLANEADO con fecha anterior a hoy se marca '(vencida)'", () => {
      render(<OccurrencesTable occurrences={[occ({ fechaProgramada: "2026-06-14T00:00:00.000Z" })]} {...handlers()} />);
      expect(screen.getByText("(vencida)")).toBeInTheDocument();
    });

    it("PLANEADO con fecha de hoy NO está vencida (comparación estricta por día)", () => {
      render(<OccurrencesTable occurrences={[occ({ fechaProgramada: "2026-06-15T00:00:00.000Z" })]} {...handlers()} />);
      expect(screen.queryByText("(vencida)")).toBeNull();
    });

    it("PLANEADO futuro no está vencido", () => {
      render(<OccurrencesTable occurrences={[occ({ fechaProgramada: "2026-07-01T00:00:00.000Z" })]} {...handlers()} />);
      expect(screen.queryByText("(vencida)")).toBeNull();
    });

    it.each(["EJECUTADO", "REPROGRAMADO", "NO_REALIZADO"] as const)("%s pasado no se marca vencida", (estado) => {
      render(<OccurrencesTable occurrences={[occ({ estado, fechaProgramada: "2026-01-01T00:00:00.000Z" })]} {...handlers()} />);
      expect(screen.queryByText("(vencida)")).toBeNull();
    });
  });

  it("frecuencia UNICA se muestra como 'Fecha específica'; el resto tal cual", () => {
    const unica = occ({ id: "u", activity: { ...occ().activity!, frecuencia: "UNICA" } });
    const mensual = occ({ id: "m" });
    render(<OccurrencesTable occurrences={[unica, mensual]} {...handlers()} />);
    expect(screen.getByText("Fecha específica")).toBeInTheDocument();
    expect(screen.getByText("MENSUAL")).toBeInTheDocument();
  });

  it("observaciones nulas muestran guion; con texto lo muestran", () => {
    render(
      <OccurrencesTable
        occurrences={[occ({ id: "a", observaciones: null }), occ({ id: "b", observaciones: "Pendiente de acta" })]}
        {...handlers()}
      />,
    );
    expect(screen.getByText("Pendiente de acta")).toBeInTheDocument();
    const celdas = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(celdas[8]).toHaveTextContent("—");
  });

  it("ocurrencia sin actividad cargada no rompe el render", () => {
    render(<OccurrencesTable occurrences={[occ({ activity: undefined })]} {...handlers()} />);
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("muestra el estado con la letra compacta", () => {
    render(<OccurrencesTable occurrences={[occ({ estado: "EJECUTADO" })]} {...handlers()} />);
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.queryByText("Ejecutado")).toBeNull();
  });

  it("los cinco botones de acción llaman a su callback con la ocurrencia de esa fila", async () => {
    const h = handlers();
    const o = occ({ id: "objetivo" });
    render(<OccurrencesTable occurrences={[o]} {...h} />);

    await userEvent.click(screen.getByRole("button", { name: "Estado" }));
    await userEvent.click(screen.getByRole("button", { name: "Reprogramar" }));
    await userEvent.click(screen.getByRole("button", { name: "Editar fecha" }));
    await userEvent.click(screen.getByRole("button", { name: "Historial" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar fecha" }));

    expect(h.onChangeEstado).toHaveBeenCalledWith(o);
    expect(h.onReprogramar).toHaveBeenCalledWith(o);
    expect(h.onEditarFecha).toHaveBeenCalledWith(o);
    expect(h.onHistorial).toHaveBeenCalledWith(o);
    expect(h.onEliminarActividad).toHaveBeenCalledWith(o);
  });

  it("con varias filas el callback recibe la ocurrencia correcta", async () => {
    const h = handlers();
    const a = occ({ id: "a" });
    const b = occ({ id: "b" });
    render(<OccurrencesTable occurrences={[a, b]} {...h} />);
    const filaB = screen.getAllByRole("row")[2];
    await userEvent.click(within(filaB).getByRole("button", { name: "Historial" }));
    expect(h.onHistorial).toHaveBeenCalledTimes(1);
    expect(h.onHistorial).toHaveBeenCalledWith(b);
  });
});
