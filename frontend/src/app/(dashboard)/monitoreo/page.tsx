"use client";

import { useEffect, useRef, useState } from "react";
import { useChannelEvents } from "@/hooks/useChannelEvents";
import { getConfig, updateConfig, removeChannel } from "@/services/channels.service";
import { tryEnableAudio, sonarCritica, sonarInfo, sonarRecuperado } from "@/lib/sound";
import { ChannelCard } from "@/components/monitoreo/ChannelCard";
import { AddChannelForm } from "@/components/monitoreo/AddChannelForm";
import { AlertLog, type LogLine } from "@/components/monitoreo/AlertLog";
import { PingLogBox, type PingLine } from "@/components/monitoreo/PingLogBox";
import { HistoryModal } from "@/components/monitoreo/HistoryModal";
import type { ChannelEventPayload, MonitorConfig } from "@/types";

const PING_EVENT_TYPES = new Set([
  "estable",
  "perdida_inicio",
  "perdida_silenciosa",
  "alerta_critica",
  "alerta_critica_continua",
  "latencia_alta_inicio",
  "latencia_alta_silenciosa",
  "alerta_lentitud",
  "canal_recuperado",
  "latencia_recuperada",
  "parcial_recuperado",
  "config_update",
  "snap",
]);

export default function MonitoreoPage() {
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [pingLogs, setPingLogs] = useState<Record<string, PingLine[]>>({});
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [cfg, setCfg] = useState<MonitorConfig | null>(null);
  const alarmIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const cfgSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushLog = (canal: string, msg: string, sev: LogLine["sev"]) => {
    const hora = new Date().toTimeString().slice(0, 8);
    setLogLines((prev) => [{ hora, canal, msg, sev }, ...prev].slice(0, 200));
  };

  const pushPingLine = (d: ChannelEventPayload) => {
    const hora = new Date().toTimeString().slice(0, 8);
    const perdida = (d.actual === null || d.actual === undefined) && d.total > 0;
    const line: PingLine = perdida
      ? { hora, cls: "err", msText: "TIMEOUT", raw: d.ping_raw || "Sin respuesta" }
      : {
          hora,
          cls: d.actual! > (d.umbral || 100) ? "warn" : "ok",
          msText: `${d.actual!.toFixed(1)} ms`,
          raw: d.ping_raw || "",
        };
    setPingLogs((prev) => {
      const arr = [line, ...(prev[d.id] ?? [])].slice(0, 100);
      return { ...prev, [d.id]: arr };
    });
  };

  const startCriticalAlarm = (cid: string) => {
    if (alarmIntervals.current.has(cid)) return;
    sonarCritica();
    const iv = setInterval(sonarCritica, 8000);
    alarmIntervals.current.set(cid, iv);
  };
  const stopCriticalAlarm = (cid: string) => {
    const iv = alarmIntervals.current.get(cid);
    if (iv) clearInterval(iv);
    alarmIntervals.current.delete(cid);
  };

  const { channels, connected } = useChannelEvents((payload) => {
    if ("accion" in payload) {
      stopCriticalAlarm(payload.id);
      setPingLogs((prev) => {
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
      return;
    }

    const d = payload as ChannelEventPayload;
    if (PING_EVENT_TYPES.has(d.tipo) || d.tipo === "snap") pushPingLine(d);

    switch (d.tipo) {
      case "alerta_critica":
        startCriticalAlarm(d.id);
        pushLog(d.nombre, d.nueva_alarma?.motivo || "Caída crítica", "critica");
        break;
      case "alerta_lentitud":
        sonarInfo();
        pushLog(d.nombre, d.nueva_alarma?.motivo || "Latencia alta sostenida", "informativa");
        break;
      case "canal_recuperado":
        stopCriticalAlarm(d.id);
        sonarRecuperado();
        pushLog(d.nombre, d.nueva_alarma?.motivo || "Canal recuperado", "recuperado");
        break;
      case "latencia_recuperada":
        sonarRecuperado();
        pushLog(d.nombre, d.nueva_alarma?.motivo || "Latencia recuperada", "recuperado");
        break;
      case "parcial_recuperado":
        stopCriticalAlarm(d.id);
        pushLog(d.nombre, d.nueva_alarma?.motivo || "Parcialmente recuperado", "informativa");
        break;
    }
  });

  useEffect(() => {
    const handler = () => tryEnableAudio();
    ["click", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, handler));
    const t = setTimeout(handler, 600);
    return () => {
      ["click", "keydown", "touchstart"].forEach((ev) => document.removeEventListener(ev, handler));
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    getConfig().then(setCfg).catch(() => undefined);
  }, []);

  const saveCfg = (partial: Partial<MonitorConfig>) => {
    setCfg((prev) => (prev ? { ...prev, ...partial } : prev));
    if (cfgSaveTimer.current) clearTimeout(cfgSaveTimer.current);
    cfgSaveTimer.current = setTimeout(() => updateConfig(partial).catch(() => undefined), 500);
  };

  const channelList = Object.values(channels).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const historyChannel = historyFor ? channels[historyFor] : null;

  return (
    <div>
      {!connected && (
        <div className="bg-red-bg border border-red rounded-lg px-4 py-2.5 mb-4 text-red text-[13px]">
          Sin conexión con la API. Verifica que el backend esté corriendo.
        </div>
      )}

      {cfg && (
        <div className="bg-bg2 border border-border rounded-lg px-4 py-3 flex gap-4 items-center flex-wrap mb-4">
          <label className="text-muted text-xs flex items-center gap-2">
            Umbral latencia
            <input
              type="number"
              min={10}
              max={5000}
              value={cfg.umbralMs}
              onChange={(e) => saveCfg({ umbralMs: parseInt(e.target.value) || 100 })}
              className="bg-bg3 border border-border text-text rounded-md px-2 h-7 w-[66px] text-[13px] outline-none"
            />
            ms
          </label>
          <label className="text-muted text-xs flex items-center gap-2">
            Intervalo
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={cfg.intervaloSeg}
              onChange={(e) => saveCfg({ intervaloSeg: parseFloat(e.target.value) })}
              className="w-20 accent-blue"
            />
            <span className="font-mono text-xs text-blue">{cfg.intervaloSeg}s</span>
          </label>
          <label className="text-muted text-xs flex items-center gap-2">
            Pérdida &gt;
            <select
              value={cfg.duracionPerdida}
              onChange={(e) => saveCfg({ duracionPerdida: parseInt(e.target.value) })}
              className="bg-bg3 border border-border text-text rounded-md px-2 h-7 text-[13px] outline-none"
            >
              {[10, 20, 30, 60].map((v) => (
                <option key={v} value={v}>
                  {v} s
                </option>
              ))}
            </select>
          </label>
          <label className="text-muted text-xs flex items-center gap-2">
            Latencia &gt;
            <select
              value={cfg.duracionLat}
              onChange={(e) => saveCfg({ duracionLat: parseInt(e.target.value) })}
              className="bg-bg3 border border-border text-text rounded-md px-2 h-7 text-[13px] outline-none"
            >
              {[3, 5, 10, 20].map((v) => (
                <option key={v} value={v}>
                  {v} s
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3 items-center ml-auto flex-wrap">
            {[
              ["#3fb950", "Estable"],
              ["#d29922", "Latencia alta"],
              ["#e07b3a", "Alerta lentitud"],
              ["#f85149", "Caída crítica"],
              ["#58a6ff", "Recuperado"],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      <AddChannelForm />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3.5 mb-5">
        {channelList.length === 0 && <div className="col-span-full text-center py-12 text-muted">Esperando datos…</div>}
        {channelList.map((d) => (
          <ChannelCard key={d.id} data={d} onRemove={(id) => removeChannel(id)} onShowHistory={setHistoryFor} />
        ))}
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-4 items-start max-[900px]:grid-cols-1">
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2.5">Log de ping por canal</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
            {channelList.map((d) => {
              const lastLine = pingLogs[d.id]?.[0];
              const status = lastLine?.cls === "err" ? "crit" : lastLine?.cls === "warn" ? "warn" : "ok";
              return (
                <PingLogBox key={d.id} nombre={d.nombre} host={d.host} lines={pingLogs[d.id] ?? []} status={status} />
              );
            })}
          </div>
        </div>
        <AlertLog lines={logLines} onClear={() => setLogLines([])} />
      </div>

      {historyChannel && (
        <HistoryModal nombre={historyChannel.nombre} alarmas={historyChannel.alarmas} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}
