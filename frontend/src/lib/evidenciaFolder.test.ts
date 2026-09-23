import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyFileToFolder,
  ensureWritePermission,
  getDestinationFolderForActivity,
  isFolderPickerSupported,
  pickDestinationFolderHandle,
} from "./evidenciaFolder";

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
});

describe("isFolderPickerSupported", () => {
  it("false cuando el navegador no expone showDirectoryPicker", () => {
    expect(isFolderPickerSupported()).toBe(false);
  });

  it("true cuando existe", () => {
    Object.assign(window, { showDirectoryPicker: vi.fn() });
    expect(isFolderPickerSupported()).toBe(true);
  });
});

describe("pickDestinationFolderHandle", () => {
  it("null si no hay soporte", async () => {
    expect(await pickDestinationFolderHandle()).toBeNull();
  });

  it("devuelve handle y nombre con permiso de lectura/escritura", async () => {
    const handle = { name: "Evidencias" };
    const picker = vi.fn().mockResolvedValue(handle);
    Object.assign(window, { showDirectoryPicker: picker });
    expect(await pickDestinationFolderHandle()).toEqual({ handle, nombre: "Evidencias" });
    expect(picker).toHaveBeenCalledWith({ mode: "readwrite" });
  });
});

describe("getDestinationFolderForActivity", () => {
  it("null sin soporte (no toca IndexedDB)", async () => {
    expect(await getDestinationFolderForActivity("a1")).toBeNull();
  });
});

describe("ensureWritePermission", () => {
  const handle = (query: string, request = "denied") =>
    ({
      queryPermission: vi.fn().mockResolvedValue(query),
      requestPermission: vi.fn().mockResolvedValue(request),
    }) as unknown as FileSystemDirectoryHandle;

  it("true sin pedir permiso si ya está concedido", async () => {
    const h = handle("granted");
    expect(await ensureWritePermission(h)).toBe(true);
    expect(h.requestPermission).not.toHaveBeenCalled();
  });

  it("pide permiso si no está concedido y refleja la respuesta", async () => {
    expect(await ensureWritePermission(handle("prompt", "granted"))).toBe(true);
    expect(await ensureWritePermission(handle("prompt", "denied"))).toBe(false);
  });
});

describe("copyFileToFolder", () => {
  it("crea el archivo con su nombre original, escribe y cierra", async () => {
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) };
    const fileHandle = { createWritable: vi.fn().mockResolvedValue(writable) };
    const dir = { getFileHandle: vi.fn().mockResolvedValue(fileHandle) } as unknown as FileSystemDirectoryHandle;
    const file = new File(["hola"], "correo.eml");

    await copyFileToFolder(dir, file);

    expect(dir.getFileHandle).toHaveBeenCalledWith("correo.eml", { create: true });
    expect(writable.write).toHaveBeenCalledWith(file);
    expect(writable.close).toHaveBeenCalled();
  });
});
