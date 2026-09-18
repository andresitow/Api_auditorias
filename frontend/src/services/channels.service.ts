import { api } from "./api";
import type { AlarmEntry, MonitorConfig } from "@/types";

export interface ChannelInfo {
  id: string;
  nombre: string;
  host: string;
  umbral: number;
}

export function listChannels() {
  return api.get<ChannelInfo[]>("/channels").then((r) => r.data);
}

export function createChannel(nombre: string, host: string) {
  return api.post("/channels", { name: nombre, host });
}

export function removeChannel(id: string) {
  return api.delete(`/channels/${id}`);
}

export function getConfig() {
  return api.get<MonitorConfig>("/channels/config").then((r) => r.data);
}

export function updateConfig(partial: Partial<MonitorConfig>) {
  return api.patch("/channels/config", partial);
}

export function getHistory(channelId: string) {
  return api.get<AlarmEntry[]>(`/channels/${channelId}/history`).then((r) => r.data);
}
