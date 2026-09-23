"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { generateYear, listCategorias, listOccurrences } from "@/services/auditorias.service";
import type { Activity, ActivityOccurrence } from "@/types/auditorias";
import { FiltersBar, EMPTY_FILTERS, type FiltersState } from "@/components/auditorias/FiltersBar";
import { OccurrencesTable } from "@/components/auditorias/OccurrencesTable";
import { ActivityFormModal } from "@/components/auditorias/ActivityFormModal";
import { OccurrenceStatusModal } from "@/components/auditorias/OccurrenceStatusModal";
import { ReprogramModal } from "@/components/auditorias/ReprogramModal";
import { EditFechaModal } from "@/components/auditorias/EditFechaModal";
import { OccurrenceHistoryModal } from "@/components/auditorias/OccurrenceHistoryModal";
import { DeleteOccurrenceModal } from "@/components/auditorias/DeleteOccurrenceModal";
import { ExportButtons } from "@/components/auditorias/ExportButtons";
import { ImportPlanExcel } from "@/components/auditorias/ImportPlanExcel";
import { Button } from "@/components/ui/button";

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
  const [deleteTarget, setDeleteTarget] = useState<ActivityOccurrence | null>(null);
  const [generating, setGenerating] = useState(false);

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

  const onOcurrenciaEliminada = (result: { actividadEliminada: boolean }) => {
    const actividad = deleteTarget?.activity;
    setDeleteTarget(null);
    toast.success(
      result.actividadEliminada
        ? `Fecha eliminada. Era la última de "${actividad?.nombre}", así que la actividad también se eliminó.`
        : `Fecha eliminada de "${actividad?.nombre}". Podés verla en "Actividades eliminadas" durante 30 días.`,
    );
    reload();
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
          <Button
            variant="outline"
            onClick={onGenerateYear}
            disabled={generating}
            title="Genera las ocurrencias del año siguiente para todas las actividades activas, reutilizando la misma plantilla"
          >
            {generating ? "Generando…" : `Generar plan ${anio + 1}`}
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ Nueva actividad</Button>
        </div>
      </div>

      <FiltersBar value={filters} onChange={setFilters} categorias={categorias} />

      <OccurrencesTable
        occurrences={filtered}
        onChangeEstado={setEstadoTarget}
        onReprogramar={setReprogramTarget}
        onEditarFecha={setEditFechaTarget}
        onHistorial={setHistoryTarget}
        onEliminarActividad={setDeleteTarget}
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
      {deleteTarget && (
        <DeleteOccurrenceModal
          auditoriaId={auditoriaId}
          occurrence={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={onOcurrenciaEliminada}
        />
      )}
    </div>
  );
}
