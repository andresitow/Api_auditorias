import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("une clases con espacio", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("ignora valores falsy (false, null, undefined, cadena vacía, 0)", () => {
    expect(cn("a", false, null, undefined, "", 0, "b")).toBe("a b");
  });

  it("sin argumentos devuelve cadena vacía", () => {
    expect(cn()).toBe("");
  });

  it("soporta clases condicionales", () => {
    const activo = true;
    const inactivo = false;
    expect(cn("base", activo && "on", inactivo && "off")).toBe("base on");
  });

  it("NO resuelve conflictos de Tailwind (conserva ambas): comportamiento documentado", () => {
    expect(cn("p-2", "p-4")).toBe("p-2 p-4");
  });

  it("los números distintos de 0 se conservan como texto", () => {
    expect(cn("a", 5)).toBe("a 5");
  });
});
