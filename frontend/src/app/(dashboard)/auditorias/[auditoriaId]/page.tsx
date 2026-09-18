"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getKpis, getSeries, getPorCategoria } from "@/services/auditorias.service";
import type { CategoriaBreakdown, KpiSummary, SeriesPoint } from "@/types/auditorias";
import { KpiRow } from "@/components/auditorias/KpiRow";
import { KpiDetailPanel, type KpiFilterKind } from "@/components/auditorias/KpiDetailPanel";
import { Semaforo } from "@/components/auditorias/Semaforo";
import { TrendChart } from "@/components/auditorias/TrendChart";
import { CategoryBarChart } from "@/components/auditorias/CategoryBarChart";
import { AlertasWidget } from "@/components/auditorias/AlertasWidget";
import { ExportButtons } from "@/components/auditorias/ExportButtons";
import { PlanAccionSiguienteAnio } from "@/components/auditorias/PlanAccionSiguienteAnio";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function AuditoriaDashboardPage() {
  const { auditoriaId } = useParams<{ auditoriaId: string }>();
  const [anio, setAnio] = useState(CURRENT_YEAR);
  const [groupBy, setGroupBy] = useState<"mes" | "bimestre" | "trimestre">("mes");
  const [kpis, setKpis] = useState<KpiSummary | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [porCategoria, setPorCategoria] = useState<CategoriaBreakdown[]>([]);
  const [selectedKpi, setSelectedKpi] = useState<KpiFilterKind | null>(null);

  const kpiScope = `${auditoriaId}:${anio}`;
  const [selectedKpiScope, setSelectedKpiScope] = useState(kpiScope);
  if (selectedKpiScope !== kpiScope) {
    setSelectedKpiScope(kpiScope);
    setSelectedKpi(null);
  }

  useEffect(() => {
    getKpis(auditoriaId, anio).then(setKpis).catch(() => undefined);
    getSeries(auditoriaId, anio, groupBy).then(setSeries).catch(() => undefined);
    getPorCategoria(auditoriaId, anio).then(setPorCategoria).catch(() => undefined);
  }, [auditoriaId, anio, groupBy]);

  return (
    <div className="flex flex-col gap-5">
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
        {kpis && <Semaforo estado={kpis.semaforo} />}
        <div className="ml-auto flex gap-2">
          <PlanAccionSiguienteAnio auditoriaId={auditoriaId} anioBase={anio} />
          <ExportButtons auditoriaId={auditoriaId} anio={anio} />
        </div>
      </div>

      {kpis && (
        <KpiRow
          kpis={kpis}
          selected={selectedKpi}
          onSelect={(kind) => setSelectedKpi((prev) => (prev === kind ? null : kind))}
        />
      )}

      {selectedKpi && (
        <KpiDetailPanel key={selectedKpi} auditoriaId={auditoriaId} anio={anio} kind={selectedKpi} onClose={() => setSelectedKpi(null)} />
      )}

      <AlertasWidget auditoriaId={auditoriaId} />

      <div className="grid grid-cols-[1.4fr_1fr] gap-4 items-start max-[900px]:grid-cols-1">
        <div className="bg-bg2 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-semibold text-text">Tendencia de cumplimiento</span>
              {kpis && (
                <span className="text-[11px] font-medium text-blue bg-blue-bg rounded-full px-2 py-0.5">
                  {kpis.cumplimientoPct}% cumplimiento
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {(["mes", "bimestre", "trimestre"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`text-[11px] px-2.5 py-1 rounded-full ${
                    groupBy === g ? "bg-blue-bg text-blue" : "text-muted hover:text-text"
                  }`}
                >
                  {g === "mes" ? "Mensual" : g === "bimestre" ? "Bimestral" : "Trimestral"}
                </button>
              ))}
            </div>
          </div>
          <TrendChart series={series} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-bg2 border border-border rounded-lg p-4">
            <span className="text-[13px] font-semibold text-text block mb-3">Cumplimiento por categoría</span>
            <CategoryBarChart data={porCategoria} />
          </div>

          <div className="bg-bg2 border border-border rounded-lg p-4 flex flex-col items-center gap-1">
            <span className="text-[13px] font-semibold text-text">% de cumplimiento</span>
            <span className="text-4xl font-semibold text-blue">{kpis ? `${kpis.cumplimientoPct}%` : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
