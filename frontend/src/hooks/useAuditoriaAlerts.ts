"use client";

import { useEffect, useRef, useState } from "react";
import { getAlertas } from "@/services/auditorias.service";
import { tryEnableAudio, sonarCritica, sonarInfo } from "@/lib/sound";
import type { AlertasResponse } from "@/types/auditorias";

const POLL_MS = 60_000;

export function useAuditoriaAlerts(auditoriaId: string) {
  const [alertas, setAlertas] = useState<AlertasResponse | null>(null);
  const seenVencidas = useRef<Set<string>>(new Set());
  const seenProximas = useRef<Set<string>>(new Set());
  const baseTitle = useRef("");
  const firstLoad = useRef(true);

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
    baseTitle.current = document.title;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getAlertas(auditoriaId);
        if (cancelled) return;

        const nuevasVencidas = data.vencidas.filter((o) => !seenVencidas.current.has(o.id));
        const nuevasProximas = data.proximasAVencer.filter((o) => !seenProximas.current.has(o.id));
        if (!firstLoad.current && data.sonidoActivo) {
          if (nuevasVencidas.length > 0) sonarCritica();
          else if (nuevasProximas.length > 0) sonarInfo();
        }
        firstLoad.current = false;

        seenVencidas.current = new Set(data.vencidas.map((o) => o.id));
        seenProximas.current = new Set(data.proximasAVencer.map((o) => o.id));
        setAlertas(data);

        document.title = document.hidden && data.vencidas.length > 0 ? `(${data.vencidas.length}) ${baseTitle.current}` : baseTitle.current;
      } catch {
        // silencioso: se reintenta en el próximo ciclo
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.title = baseTitle.current;
    };
  }, [auditoriaId]);

  return alertas;
}
