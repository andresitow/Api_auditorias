import axios from "axios";
import Cookies from "js-cookie";

const BACKEND_PORT = 4000;
const ANALYTICS_PORT = 4100;

// NEXT_PUBLIC_API_URL se hornea en el bundle en build/dev time, así que un
// único valor no puede servir a la vez a quien entra por localhost y a quien
// entra por un link de devtunnel. Por eso, salvo que se fije explícitamente,
// derivamos la URL del backend (y la de analytics-service) a partir de dónde
// está parado el navegador.
function resolveServiceUrl(explicitEnvUrl: string | undefined, port: number): string {
  if (explicitEnvUrl) return explicitEnvUrl;
  if (typeof window === "undefined") return `http://localhost:${port}`;

  const { protocol, hostname, port: currentPort } = window.location;

  // Túneles de VS Code / devtunnels: <id>-<puertoFrontend>.<region>.devtunnels.ms
  const devtunnelMatch = hostname.match(/^(.+)-(\d+)(\..+\.devtunnels\.ms)$/i);
  if (devtunnelMatch) {
    return `${protocol}//${devtunnelMatch[1]}-${port}${devtunnelMatch[3]}`;
  }

  // localhost o acceso por IP de LAN: mismo host, puerto del servicio.
  if (currentPort) {
    return `${protocol}//${hostname}:${port}`;
  }

  return `${protocol}//${hostname}`;
}

export const API_URL = resolveServiceUrl(process.env.NEXT_PUBLIC_API_URL, BACKEND_PORT);

// analytics-service (Python): el frontend se conecta directo a su WebSocket para
// el progreso en vivo de la generación del plan de acción (ver
// hooks/usePlanAccionJob.ts). Las descargas y el disparo del job pasan por el
// backend NestJS como de costumbre (ver services/plan-accion.service.ts).
export const ANALYTICS_URL = resolveServiceUrl(process.env.NEXT_PUBLIC_ANALYTICS_URL, ANALYTICS_PORT);
export const ANALYTICS_WS_URL = ANALYTICS_URL.replace(/^http/, "ws");

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      Cookies.remove("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
