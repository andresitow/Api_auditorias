export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigin: string;
  analyticsServiceUrl: string;
}

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function validateEnv(env: Record<string, unknown>) {
  for (const key of REQUIRED_VARS) {
    if (!env[key]) throw new Error(`Falta la variable de entorno requerida: ${key}`);
  }
  return env;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL ?? 'http://localhost:4100',
});
