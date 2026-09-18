"use client";

import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { API_URL } from "@/services/api";
import type { ChannelEventPayload } from "@/types";

type RemovedEvent = { accion: "quitar"; id: string };

export function useChannelEvents(onEvent?: (payload: ChannelEventPayload | RemovedEvent) => void) {
  const [channels, setChannels] = useState<Record<string, ChannelEventPayload>>({});
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function connect() {
      while (!cancelled) {
        try {
          const token = Cookies.get("token");
          const resp = await fetch(`${API_URL}/channels/events`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          });
          if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
          setConnected(true);

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith("data:")) continue;
              try {
                const payload = JSON.parse(line.slice(5).trim()) as ChannelEventPayload | RemovedEvent;
                if ("accion" in payload) {
                  const removedId = payload.id;
                  setChannels((prev) => {
                    const next = { ...prev };
                    delete next[removedId];
                    return next;
                  });
                } else {
                  const channelPayload = payload;
                  setChannels((prev) => ({ ...prev, [channelPayload.id]: channelPayload }));
                }
                onEventRef.current?.(payload);
              } catch {
                continue;
              }
            }
          }
        } catch {
          setConnected(false);
        }
        if (!cancelled) await new Promise((r) => setTimeout(r, 4000));
      }
    }

    void connect();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { channels, connected };
}
