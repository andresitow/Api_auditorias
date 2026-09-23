import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormatDropdown } from "./FormatDropdown";

const abrir = async () => userEvent.click(screen.getByRole("button", { name: /Exportar/ }));

describe("FormatDropdown", () => {
  it("inicia cerrado, con aria-expanded=false y aria-haspopup=menu", () => {
    render(<FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>);
    const trigger = screen.getByRole("button", { name: /Exportar/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("al hacer clic abre el menú con las dos opciones por defecto", async () => {
    render(<FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>);
    await abrir();
    expect(screen.getByRole("button", { name: /Exportar/ })).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Descargar en Excel (.xlsx)", "Descargar en PDF (.pdf)"]);
  });

  it("un segundo clic en el botón cierra el menú (alterna)", async () => {
    render(<FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>);
    await abrir();
    await abrir();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it.each([
    ["Descargar en Excel (.xlsx)", "excel"],
    ["Descargar en PDF (.pdf)", "pdf"],
  ])("elegir '%s' llama onSelect('%s') y cierra el menú", async (texto, formato) => {
    const onSelect = vi.fn();
    render(<FormatDropdown onSelect={onSelect}>Exportar</FormatDropdown>);
    await abrir();
    await userEvent.click(screen.getByRole("menuitem", { name: texto }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(formato);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("itemLabels sobreescribe solo las etiquetas indicadas", async () => {
    render(
      <FormatDropdown onSelect={vi.fn()} itemLabels={{ excel: "Plan en Excel" }}>
        Exportar
      </FormatDropdown>,
    );
    await abrir();
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Plan en Excel", "Descargar en PDF (.pdf)"]);
  });

  it("se cierra con la tecla Escape", async () => {
    render(<FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>);
    await abrir();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("otras teclas no lo cierran", async () => {
    render(<FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>);
    await abrir();
    await userEvent.keyboard("a");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("se cierra al hacer mousedown fuera del componente", async () => {
    render(
      <div>
        <FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>
        <p>fuera</p>
      </div>,
    );
    await abrir();
    fireEvent.mouseDown(screen.getByText("fuera"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("mousedown dentro del menú NO lo cierra", async () => {
    render(<FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>);
    await abrir();
    fireEvent.mouseDown(screen.getByRole("menu"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("disabled: el botón está deshabilitado y no abre el menú", async () => {
    render(
      <FormatDropdown onSelect={vi.fn()} disabled>
        Exportar
      </FormatDropdown>,
    );
    const trigger = screen.getByRole("button", { name: /Exportar/ });
    expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("muestra el indicador ▾ cerrado y ▴ abierto", async () => {
    render(<FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>);
    expect(screen.getByRole("button")).toHaveTextContent("▾");
    await abrir();
    expect(screen.getByRole("button", { name: /Exportar/ })).toHaveTextContent("▴");
  });

  it("retira los listeners del documento al desmontar (no lanza al pulsar Escape después)", async () => {
    const { unmount } = render(<FormatDropdown onSelect={vi.fn()}>Exportar</FormatDropdown>);
    await abrir();
    unmount();
    expect(() => fireEvent.keyDown(document, { key: "Escape" })).not.toThrow();
  });
});
