import { describe, expect, it } from "vitest";
import {
  ANTIVIRUS_DEFAULT,
  FIREWALL_DEFAULT,
  IPS_LISTA_BLANCA,
  ISP_DEFAULT,
  esDefender,
  evaluarOficina,
  formatFecha,
  textoAntivirus,
  textoFirewall,
  textoNavegadores,
  textoSO,
} from "./diagnosticoTexts";
import type { Oficina } from "@/types/formularios";

describe("formatFecha", () => {
  it("convierte AAAA-MM-DD a DD/MM/AAAA", () => {
    expect(formatFecha("2026-03-05")).toBe("05/03/2026");
  });

  it("ignora la parte horaria de un ISO completo", () => {
    expect(formatFecha("2026-12-31T23:59:59.000Z")).toBe("31/12/2026");
  });

  it("cadena vacía => guion largo", () => {
    expect(formatFecha("")).toBe("—");
  });
});

describe("constantes", () => {
  it("listas por defecto no están vacías y no tienen duplicados", () => {
    for (const lista of [ISP_DEFAULT, FIREWALL_DEFAULT, ANTIVIRUS_DEFAULT, IPS_LISTA_BLANCA]) {
      expect(lista.length).toBeGreaterThan(0);
      expect(new Set(lista).size).toBe(lista.length);
    }
  });

  it("la lista blanca contiene solo direcciones IPv4 válidas", () => {
    for (const ip of IPS_LISTA_BLANCA) {
      expect(ip).toMatch(/^(\d{1,3}\.){3}\d{1,3}$/);
      ip.split(".").forEach((o) => expect(Number(o)).toBeLessThanOrEqual(255));
    }
  });
});

describe("textoSO", () => {
  it("mixto menciona Windows 10 y recomienda Windows 11", () => {
    const t = textoSO("mixto");
    expect(t).toContain("Windows 10");
    expect(t).toContain("Windows 11");
  });

  it("cualquier otro valor usa el texto de Windows 11", () => {
    const t = textoSO("windows11" as never);
    expect(t).toContain("operan actualmente con el sistema operativo Windows 11");
    expect(t).not.toContain("Windows 10");
  });
});

describe("textoNavegadores", () => {
  it("solo Chrome y Edge => texto simple", () => {
    const t = textoNavegadores(["Chrome", "Edge"]);
    expect(t).toContain("Los usuarios utilizan los navegadores Google Chrome y Microsoft Edge");
  });

  it("con otros navegadores los lista y recomienda estandarizar", () => {
    const t = textoNavegadores(["Chrome", "Firefox"]);
    expect(t).toContain("Chrome, Firefox");
    expect(t).toContain("(Firefox)");
    expect(t).toContain("estandarizar");
  });

  it("'Otro' se reemplaza por el nombre indicado", () => {
    const t = textoNavegadores(["Edge", "Otro"], "Brave");
    expect(t).toContain("(Brave)");
  });

  it("lista vacía cae en el caso 'solo Chrome/Edge' (every sobre vacío es true)", () => {
    expect(textoNavegadores([])).toContain("Google Chrome y Microsoft Edge");
  });
});

describe("textoFirewall", () => {
  it("con firewall incluye su nombre", () => {
    expect(textoFirewall(true, "Fortinet")).toContain("firewall Fortinet");
  });

  it("sin firewall indica que no cuenta con ninguno", () => {
    expect(textoFirewall(false)).toContain("no cuenta con ningún dispositivo");
  });
});

describe("antivirus", () => {
  it("esDefender solo para 'Microsoft Defender' exacto", () => {
    expect(esDefender("Microsoft Defender")).toBe(true);
    expect(esDefender("microsoft defender")).toBe(false);
    expect(esDefender("ESET")).toBe(false);
  });

  it("Defender => texto de antivirus por default de Windows", () => {
    expect(textoAntivirus("Microsoft Defender")).toContain("Windows Defender");
  });

  it("otro antivirus => incluye el nombre y pide lista blanca", () => {
    const t = textoAntivirus("ESET");
    expect(t).toContain("antivirus ESET");
    expect(t).toContain("lista blanca");
  });
});

describe("evaluarOficina", () => {
  const oficina = (une: Oficina["une"], claro: Oficina["claro"]): Oficina => ({
    principal: true,
    nombre: "Sede",
    une,
    claro,
  });

  it("cumple cuando ping <= 50, descarga >= 10 y carga >= 5 (límites inclusivos)", () => {
    const ok = { ping: 50, descarga: 10, carga: 5 };
    expect(evaluarOficina(oficina(ok, ok))).toBe("Cumple con los parámetros recomendados.");
  });

  it("cumple si no hay mediciones", () => {
    expect(evaluarOficina(oficina({}, {}))).toBe("Cumple con los parámetros recomendados.");
  });

  it("latencia alta (> 50 ms)", () => {
    const r = evaluarOficina(oficina({ ping: 51 }, {}));
    expect(r).toContain("Latencia alta en Test UNE (51 ms)");
  });

  it("descarga baja (< 10 Mbps) y carga baja (< 5 Mbps)", () => {
    const r = evaluarOficina(oficina({}, { descarga: 9.9, carga: 4.9 }));
    expect(r).toContain("elocidad de descarga por debajo de lo recomendado en Test Claro (9.9 Mbps)");
    expect(r).toContain("velocidad de carga por debajo de lo recomendado en Test Claro (4.9 Mbps)");
  });

  it("primera letra en mayúscula, observaciones separadas por '; ' y sugerencia final del ISP", () => {
    const r = evaluarOficina(oficina({ ping: 90 }, { descarga: 1 }));
    expect(r.startsWith("L")).toBe(true);
    expect(r).toContain("; ");
    expect(r.endsWith("Se recomienda validar estos resultados con su proveedor de internet (ISP).")).toBe(true);
  });

  it("evalúa primero UNE y luego Claro", () => {
    const r = evaluarOficina(oficina({ ping: 90 }, { ping: 80 }));
    expect(r.indexOf("Test UNE")).toBeLessThan(r.indexOf("Test Claro"));
  });
});
