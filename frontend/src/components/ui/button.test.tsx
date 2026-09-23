import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";
import type { ButtonVariant } from "./button";

const SOLIDOS: ButtonVariant[] = ["default", "destructive", "warning", "info", "outline", "secondary"];
const TEXTO: ButtonVariant[] = ["ghost", "link", "linkDestructive", "linkWarning", "linkMuted"];

describe("Button - variantes", () => {
  it.each(SOLIDOS)("variante sólida %s usa el diseño frutiger y envuelve el contenido", (variant) => {
    render(<Button variant={variant}>Guardar</Button>);
    const btn = screen.getByRole("button", { name: "Guardar" });
    expect(btn).toHaveClass("frutiger-button");
    expect(btn.querySelector(".frutiger-inner .frutiger-text")).toHaveTextContent("Guardar");
    expect(btn.querySelector(".frutiger-top-white")).toHaveAttribute("aria-hidden", "true");
  });

  it.each(TEXTO)("variante de texto %s no envuelve el contenido y usa estilo teal", (variant) => {
    render(<Button variant={variant}>Cancelar</Button>);
    const btn = screen.getByRole("button", { name: "Cancelar" });
    expect(btn).not.toHaveClass("frutiger-button");
    expect(btn).toHaveClass("royal-link");
    expect(btn.querySelector(".frutiger-inner")).toBeNull();
  });

  it("la variante por defecto es la sólida 'default'", () => {
    render(<Button>Ok</Button>);
    expect(screen.getByRole("button")).toHaveClass("frutiger-button");
  });
});

describe("Button - tamaños", () => {
  it("sólido: sm -> fb-sm, lg -> fb-lg, default sin modificador", () => {
    const { rerender } = render(<Button size="sm">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("fb-sm");
    rerender(<Button size="lg">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("fb-lg");
    rerender(<Button>x</Button>);
    expect(screen.getByRole("button")).not.toHaveClass("fb-sm", "fb-lg");
  });

  it("sólido: icon e iconSm usan fb-icon", () => {
    render(<Button size="icon">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("fb-icon");
  });

  it("ghost: el tamaño compacto aplica su caja propia", () => {
    render(
      <Button variant="ghost" size="sm">
        x
      </Button>,
    );
    expect(screen.getByRole("button").className).toContain("px-2.5");
  });

  it("ghost + icon: botón redondo de 8x8", () => {
    render(
      <Button variant="ghost" size="icon">
        x
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveClass("h-8", "w-8", "rounded-full");
  });

  it.each(["link", "linkDestructive", "linkWarning", "linkMuted"] as const)("%s ignora el tamaño", (variant) => {
    render(
      <Button variant={variant} size="lg">
        x
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).not.toContain("px-3.5");
    expect(btn.className).not.toContain("fb-lg");
  });
});

describe("Button - comportamiento", () => {
  it("dispara onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ir</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled no dispara onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Ir
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("propaga className extra y atributos nativos", () => {
    render(
      <Button className="mi-clase" type="submit" title="ayuda" aria-label="enviar">
        x
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "enviar" });
    expect(btn).toHaveClass("mi-clase", "frutiger-button");
    expect(btn).toHaveAttribute("type", "submit");
    expect(btn).toHaveAttribute("title", "ayuda");
  });

  it("reenvía la ref al <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe("Button - asChild", () => {
  it("sólido: mantiene la etiqueta del hijo, le suma las clases y envuelve su texto", () => {
    render(
      <Button asChild>
        <a href="/auditorias" className="extra">
          Ver
        </a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Ver" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/auditorias");
    expect(link).toHaveClass("frutiger-button", "extra");
    expect(link.querySelector(".frutiger-text")).toHaveTextContent("Ver");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("texto (link): no envuelve el contenido", () => {
    render(
      <Button asChild variant="link">
        <a href="/x">Ir</a>
      </Button>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveClass("royal-link");
    expect(link.querySelector(".frutiger-inner")).toBeNull();
  });

  it("los props del botón (p. ej. onClick) pasan al hijo", async () => {
    const onClick = vi.fn();
    render(
      <Button asChild onClick={onClick}>
        <a href="#x">Ir</a>
      </Button>,
    );
    await userEvent.click(screen.getByRole("link"));
    expect(onClick).toHaveBeenCalled();
  });

  it("lanza un error claro si el hijo no es un elemento", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Button asChild>solo texto</Button>)).toThrow(/asChild requiere exactamente un elemento hijo/);
    spy.mockRestore();
  });
});
