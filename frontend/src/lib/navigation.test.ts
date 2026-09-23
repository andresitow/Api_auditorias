import { describe, expect, it } from "vitest";
import { NAV_ITEMS, getActiveModule } from "./navigation";

describe("getActiveModule", () => {
  it.each([
    ["/monitoreo", "/monitoreo"],
    ["/auditorias", "/auditorias"],
    ["/auditorias/abc-123/actividades", "/auditorias"],
    ["/formularios/diagnosticos/9", "/formularios"],
  ])("%s -> módulo %s", (pathname, href) => {
    expect(getActiveModule(pathname)?.href).toBe(href);
  });

  it("devuelve undefined para rutas desconocidas o null", () => {
    expect(getActiveModule("/login")).toBeUndefined();
    expect(getActiveModule("/")).toBeUndefined();
    expect(getActiveModule(null)).toBeUndefined();
  });

  it("NAV_ITEMS expone los tres módulos en orden", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/monitoreo", "/auditorias", "/formularios"]);
  });
});
