"use client";

import type { EstadoActividad, Frecuencia } from "@/types/auditorias";

export interface FiltersState {
  categoria: string;
  estado: string;
  responsable: string;
  frecuencia: string;
  q: string;
}

export const EMPTY_FILTERS: FiltersState = { categoria: "", estado: "", responsable: "", frecuencia: "", q: "" };

const ESTADOS: { value: EstadoActividad; label: string }[] = [
  { value: "PLANEADO", label: "Planeado" },
  { value: "EJECUTADO", label: "Ejecutado" },
  { value: "REPROGRAMADO", label: "Reprogramado" },
  { value: "NO_REALIZADO", label: "No realizado" },
];

const FRECUENCIAS: { value: Frecuencia; label: string }[] = [
  { value: "UNICA", label: "Fecha específica" },
  { value: "DIARIO", label: "Diario" },
  { value: "MENSUAL", label: "Mensual" },
  { value: "BIMENSUAL", label: "Bimensual" },
  { value: "TRIMESTRAL", label: "Trimestral" },
  { value: "SEMESTRAL", label: "Semestral" },
  { value: "ANUAL", label: "Anual" },
  { value: "A_DEMANDA", label: "A demanda" },
  { value: "CUANDO_SE_REQUIERA", label: "Cuando se requiera" },
];

const selectCls = "bg-bg3 border border-border text-text rounded-md px-2.5 h-9 text-[13px] outline-none focus:border-blue";
const inputCls = "bg-bg3 border border-border text-text rounded-md px-2.5 h-9 text-[13px] outline-none focus:border-blue placeholder:text-muted";

export function FiltersBar({
  value,
  onChange,
  categorias,
}: {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  categorias: string[];
}) {
  const set = (patch: Partial<FiltersState>) => onChange({ ...value, ...patch });
  const hasFilters = value.categoria || value.estado || value.frecuencia || value.responsable || value.q;

  return (
    <div className="flex flex-wrap gap-2.5 items-center bg-bg2 border border-border rounded-lg p-3">
      <input
        placeholder="Buscar por actividad o responsable…"
        value={value.q}
        onChange={(e) => set({ q: e.target.value })}
        className={`${inputCls} w-64`}
      />
      <select value={value.categoria} onChange={(e) => set({ categoria: e.target.value })} className={selectCls}>
        <option value="">Todas las categorías</option>
        {categorias.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select value={value.estado} onChange={(e) => set({ estado: e.target.value })} className={selectCls}>
        <option value="">Todos los estados</option>
        {ESTADOS.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>
      <select value={value.frecuencia} onChange={(e) => set({ frecuencia: e.target.value })} className={selectCls}>
        <option value="">Todas las frecuencias</option>
        {FRECUENCIAS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <input
        placeholder="Responsable…"
        value={value.responsable}
        onChange={(e) => set({ responsable: e.target.value })}
        className={`${inputCls} w-40`}
      />
      {hasFilters && (
        <button onClick={() => onChange(EMPTY_FILTERS)} className="text-muted hover:text-text text-[12.5px] px-2">
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
