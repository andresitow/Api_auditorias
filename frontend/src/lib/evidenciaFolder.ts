"use client";

// Carpeta local de destino configurada por actividad, para copiar automáticamente el .eml
// adjuntado al crear/editar la actividad. La carpeta solo existe en el PC del usuario: el handle
// se guarda en IndexedDB del propio navegador (nunca viaja al backend, no tiene sentido como dato
// de servidor). Requiere File System Access API (Chrome/Edge); en otros navegadores queda
// deshabilitado.

const DB_NAME = "auditorias-evidencia";
const STORE_DESTINO = "carpetas-destino";
const DB_VERSION = 2;

interface CarpetaEntry {
  activityId: string;
  handle: FileSystemDirectoryHandle;
  nombre: string;
}

export function isFolderPickerSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_DESTINO)) {
        req.result.createObjectStore(STORE_DESTINO, { keyPath: "activityId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Debe llamarse directo desde un onClick: el navegador exige un gesto de usuario. */
export async function pickDestinationFolderHandle(): Promise<{ handle: FileSystemDirectoryHandle; nombre: string } | null> {
  if (!isFolderPickerSupported()) return null;
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  return { handle, nombre: handle.name };
}

export async function saveDestinationFolderForActivity(activityId: string, handle: FileSystemDirectoryHandle, nombre: string): Promise<void> {
  const entry: CarpetaEntry = { activityId, handle, nombre };
  await withStore(STORE_DESTINO, "readwrite", (store) => store.put(entry));
}

export async function getDestinationFolderForActivity(activityId: string): Promise<{ handle: FileSystemDirectoryHandle; nombre: string } | null> {
  if (!isFolderPickerSupported()) return null;
  const entry = await withStore<CarpetaEntry | undefined>(STORE_DESTINO, "readonly", (store) => store.get(activityId));
  return entry ? { handle: entry.handle, nombre: entry.nombre } : null;
}

export async function removeDestinationFolderForActivity(activityId: string): Promise<void> {
  await withStore(STORE_DESTINO, "readwrite", (store) => store.delete(activityId));
}

/** Debe llamarse directo desde un onClick si aún no hay permiso concedido. */
export async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

/** Copia (o sobrescribe) el archivo dentro de la carpeta destino, con su nombre original. */
export async function copyFileToFolder(handle: FileSystemDirectoryHandle, file: File): Promise<void> {
  const fileHandle = await handle.getFileHandle(file.name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
}
