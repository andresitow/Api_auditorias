import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev` fuerza --webpack (ver abajo); `npm run build` usa Turbopack (default de
  // Next 16). Este bloque vacío solo le confirma a Next que el uso de `webpack` de abajo es
  // intencional y no un descuido al migrar a Turbopack (si no, `next build` sin --webpack falla).
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      // El proyecto vive dentro de una carpeta sincronizada por OneDrive; los
      // eventos nativos de FS se pierden o llegan corruptos por el filtro de
      // OneDrive, lo que tumbaba el dev server. Polling evita depender de esos eventos.
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
