"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { deactivateActivity, generateYear, listCategorias, listOccurrences } from "@/services/auditorias.service";
import type { Activity, ActivityOccurrence } from "@/types/auditorias";
import { FiltersBar, EMPTY_FILTERS, type FiltersState } from "@/components/auditorias/FiltersBar";
import { OccurrencesTable } from "@/components/auditorias/OccurrencesTable";
import { ActivityFormModal } from "@/components/auditorias/ActivityFormModal";
import { OccurrenceStatusModal } from "@/components/auditorias/OccurrenceStatusModal";
import { ReprogramModal } from "@/components/auditorias/ReprogramModal";
import { EditFechaModal } from "@/components/auditorias/EditFechaModal";
import { OccurrenceHistoryModal } from "@/components/auditorias/OccurrenceHistoryModal";
import { ExportButtons } from "@/components/auditorias/ExportButtons";
import { ImportPlanExcel } from "@/components/auditorias/ImportPlanExcel";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

export default function ActividadesPage() {
  const { auditoriaId } = useParams<{ auditoriaId: string }>();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [anio, setAnio] = useState(CURRENT_YEAR);
  const [occurrences, setOccurrences] = useState<ActivityOccurrence[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [filters, setFilters] = useState<FiltersState>({ ...EMPTY_FILTERS, q: searchParams.get("q") ?? "" });

  const [showCreate, setShowCreate] = useState(false);
  const [estadoTarget, setEstadoTarget] = useState<ActivityOccurrence | null>(null);
  const [reprogramTarget, setReprogramTarget] = useState<ActivityOccurrence | null>(null);
  const [editFechaTarget, setEditFechaTarget] = useState<ActivityOccurrence | null>(null);
  const [historyTarget, setHistoryTarget] = useState<ActivityOccurrence | null>(null);
  const [generating, setGenerating] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const reload = () => {
    listOccurrences(auditoriaId, { anio }).then(setOccurrences).catch(() => undefined);
    listCategorias(auditoriaId).then(setCategorias).catch(() => undefined);
  };

  useEffect(() => {
    listOccurrences(auditoriaId, { anio }).then(setOccurrences).catch(() => undefined);
  }, [auditoriaId, anio]);

  useEffect(() => {
    listCategorias(auditoriaId).then(setCategorias).catch(() => undefined);
  }, [auditoriaId]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return occurrences.filter((o) => {
      if (filters.categoria && o.activity?.categoria !== filters.categoria) return false;
      if (filters.estado && o.estado !== filters.estado) return false;
      if (filters.frecuencia && o.activity?.frecuencia !== filters.frecuencia) return false;
      if (filters.responsable && !o.activity?.responsable.toLowerCase().includes(filters.responsable.toLowerCase())) return false;
      if (q && !`${o.activity?.nombre ?? ""} ${o.activity?.responsable ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [occurrences, filters]);

  const onSaved = (closeFn: () => void, savedActivity?: Activity) => {
    closeFn();
    reload();
    if (savedActivity) {
      // Confirma visualmente que la actividad se creó/editó: sin esto quedaba enterrada entre
      // cientos de filas ordenadas por fecha, y el usuario reintentaba creyendo que había fallado.
      setFilters({ ...EMPTY_FILTERS, q: savedActivity.nombre });
    }
  };

  const onGenerateYear = async () => {
    const siguienteAnio = anio + 1;
    if (!confirm(`¿Generar las ocurrencias del año ${siguienteAnio} para todas las actividades activas, usando la misma plantilla?`)) return;
    setGenerating(true);
    try {
      const r = await generateYear(auditoriaId, siguienteAnio);
      toast.success(`Listo: ${r.creadasTotal} ocurrencia(s) nueva(s) creadas para ${r.anio} (${r.actividadesProcesadas} actividades revisadas).`);
      setAnio(siguienteAnio);
    } finally {
      setGenerating(false);
    }
  };

  const onEliminarActividad = async (occurrence: ActivityOccurrence) => {
    const actividad = occurrence.activity;
    if (!actividad) return;
    if (
      !confirm(
        `¿Eliminar la actividad "${actividad.nombre}"?\n\nDejará de aparecer en el plan de trabajo. Si ya tiene historial de seguimiento se conservará (queda desactivada); si nunca se le registró seguimiento, se borra por completo. Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setEliminando(true);
    try {
      const r = await deactivateActivity(auditoriaId, actividad.id);
      toast.success(r.eliminada ? `Actividad "${actividad.nombre}" eliminada.` : `Actividad "${actividad.nombre}" desactivada.`);
      reload();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="bg-bg3 border border-border text-text rounded-md px-2.5 h-9 text-[13px] outline-none focus:border-blue"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-[12.5px] text-muted">
          {filtered.length} de {occurrences.length} actividades
        </span>
        <div className="ml-auto flex gap-2">
          <ExportButtons auditoriaId={auditoriaId} anio={anio} categoria={filters.categoria || undefined} estado={filters.estado || undefined} />
          <ImportPlanExcel auditoriaId={auditoriaId} onImported={reload} />
          <button
            onClick={onGenerateYear}
            disabled={generating}
            title="Genera las ocurrencias del año siguiente para todas las actividades activas, reutilizando la misma plantilla"
            className="h-9 px-3.5 rounded-md border border-border text-text text-[13px] hover:bg-bg3 disabled:opacity-60"
          >
            {generating ? "Generando…" : `Generar plan ${anio + 1}`}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="h-9 px-3.5 rounded-md border border-[#2ea043] bg-[#1a3a2a] text-green text-[13px] hover:bg-[#1f4a33]"
          >
            + Nueva actividad
          </button>
        </div>
      </div>

      <FiltersBar value={filters} onChange={setFilters} categorias={categorias} />

      <OccurrencesTable
        occurrences={filtered}
        onChangeEstado={setEstadoTarget}
        onReprogramar={setReprogramTarget}
        onEditarFecha={setEditFechaTarget}
        onHistorial={setHistoryTarget}
        onEliminarActividad={onEliminarActividad}
        eliminando={eliminando}
      />

      {showCreate && (
        <ActivityFormModal
          auditoriaId={auditoriaId}
          onClose={() => setShowCreate(false)}
          onSaved={(saved) => onSaved(() => setShowCreate(false), saved)}
        />
      )}
      {estadoTarget && (
        <OccurrenceStatusModal
          auditoriaId={auditoriaId}
          occurrence={estadoTarget}
          onClose={() => setEstadoTarget(null)}
          onSaved={() => onSaved(() => setEstadoTarget(null))}
        />
      )}
      {reprogramTarget && (
        <ReprogramModal
          auditoriaId={auditoriaId}
          occurrence={reprogramTarget}
          onClose={() => setReprogramTarget(null)}
          onSaved={() => onSaved(() => setReprogramTarget(null))}
        />
      )}
      {editFechaTarget && (
        <EditFechaModal
          auditoriaId={auditoriaId}
          occurrence={editFechaTarget}
          onClose={() => setEditFechaTarget(null)}
          onSaved={() => onSaved(() => setEditFechaTarget(null))}
        />
      )}
      {historyTarget && (
        <OccurrenceHistoryModal auditoriaId={auditoriaId} occurrence={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  );
}
