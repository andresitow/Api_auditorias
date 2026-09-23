import { Injectable } from '@nestjs/common';
import { EstadoActividad } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaConfigService } from './config.service';
import {
  CATEGORIAS_AUDITORIA,
  compararCategorias,
} from './dto/create-activity.dto';

type EstadoCounts = Record<EstadoActividad, number>;

function emptyCounts(): EstadoCounts {
  return { PLANEADO: 0, EJECUTADO: 0, REPROGRAMADO: 0, NO_REALIZADO: 0 };
}

const DAY_MS = 86_400_000;

/** Porcentaje entero (redondeado) de `parte` sobre `total`; 0 si `total` es 0. */
function pct(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

/** Límite superior de la ventana "próximas a vencer": el mayor de los días de
 * anticipación configurados (o 7 si no hay ninguno) a partir de `now`. */
function dueSoonHorizon(now: Date, diasAntes: number[]): Date {
  const maxDias = diasAntes.length ? Math.max(...diasAntes) : 7;
  return new Date(now.getTime() + maxDias * DAY_MS);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AuditoriaConfigService,
  ) {}

  /** Ocurrencias (estado y fecha) de las actividades activas de la auditoría en el año. */
  private findYearOccurrences(
    auditoriaId: string,
    anio: number,
    categoria?: string,
  ) {
    return this.prisma.activityOccurrence.findMany({
      where: {
        periodo: { startsWith: String(anio) },
        activity: {
          auditoriaId,
          activa: true,
          categoria: categoria || undefined,
        },
      },
      select: { estado: true, fechaProgramada: true },
    });
  }

  async kpis(auditoriaId: string, anio: number, categoria?: string) {
    const occurrences = await this.findYearOccurrences(
      auditoriaId,
      anio,
      categoria,
    );

    const cfg = await this.configService.get();
    const now = new Date();
    const horizon = dueSoonHorizon(now, cfg.diasAntes);

    const porEstado = emptyCounts();
    for (const o of occurrences) porEstado[o.estado] += 1;

    const total = occurrences.length;
    const vencidas = occurrences.filter(
      (o) => o.estado === EstadoActividad.PLANEADO && o.fechaProgramada < now,
    ).length;
    const proximasAVencer = occurrences.filter(
      (o) =>
        o.estado === EstadoActividad.PLANEADO &&
        o.fechaProgramada >= now &&
        o.fechaProgramada <= horizon,
    ).length;
    const cumplimientoPct = pct(porEstado.EJECUTADO, total);
    const semaforo =
      cumplimientoPct >= cfg.semaforoVerdePct
        ? 'verde'
        : cumplimientoPct >= cfg.semaforoAmarilloPct
          ? 'amarillo'
          : 'rojo';

    return {
      anio,
      total,
      porEstado,
      vencidas,
      proximasAVencer,
      cumplimientoPct,
      semaforo,
    };
  }

  async series(
    auditoriaId: string,
    anio: number,
    groupBy: 'mes' | 'bimestre' | 'trimestre',
    categoria?: string,
  ) {
    const occurrences = await this.findYearOccurrences(
      auditoriaId,
      anio,
      categoria,
    );

    const buckets = new Map<
      string,
      { programado: number; ejecutado: number }
    >();
    for (const o of occurrences) {
      const month = o.fechaProgramada.getUTCMonth();
      const key =
        groupBy === 'trimestre'
          ? `Q${Math.floor(month / 3) + 1}`
          : groupBy === 'bimestre'
            ? `B${Math.floor(month / 2) + 1}`
            : String(month + 1).padStart(2, '0');
      const bucket = buckets.get(key) ?? { programado: 0, ejecutado: 0 };
      bucket.programado += 1;
      if (o.estado === EstadoActividad.EJECUTADO) bucket.ejecutado += 1;
      buckets.set(key, bucket);
    }

    const keys =
      groupBy === 'trimestre'
        ? ['Q1', 'Q2', 'Q3', 'Q4']
        : groupBy === 'bimestre'
          ? ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']
          : Array.from({ length: 12 }, (_, i) =>
              String(i + 1).padStart(2, '0'),
            );
    return keys.map((periodo) => {
      const b = buckets.get(periodo) ?? { programado: 0, ejecutado: 0 };
      return {
        periodo,
        programado: b.programado,
        ejecutado: b.ejecutado,
        cumplimientoPct: pct(b.ejecutado, b.programado),
      };
    });
  }

  async porCategoria(auditoriaId: string, anio: number) {
    const occurrences = await this.prisma.activityOccurrence.findMany({
      where: {
        periodo: { startsWith: String(anio) },
        activity: { auditoriaId, activa: true },
      },
      select: { estado: true, activity: { select: { categoria: true } } },
    });

    const map = new Map<string, EstadoCounts>();
    for (const categoria of CATEGORIAS_AUDITORIA)
      map.set(categoria, emptyCounts());
    for (const o of occurrences) {
      const entry = map.get(o.activity.categoria) ?? emptyCounts();
      entry[o.estado] += 1;
      map.set(o.activity.categoria, entry);
    }

    return [...map.entries()]
      .map(([categoria, e]) => {
        const total =
          e.PLANEADO + e.EJECUTADO + e.REPROGRAMADO + e.NO_REALIZADO;
        return {
          categoria,
          ...e,
          cumplimientoPct: pct(e.EJECUTADO, total),
        };
      })
      .sort((a, b) => compararCategorias(a.categoria, b.categoria));
  }

  async alertas(auditoriaId: string) {
    const cfg = await this.configService.get();
    const now = new Date();
    const horizon = dueSoonHorizon(now, cfg.diasAntes);

    const candidatas = await this.prisma.activityOccurrence.findMany({
      where: {
        estado: EstadoActividad.PLANEADO,
        fechaProgramada: { lte: horizon },
        activity: { auditoriaId, activa: true },
      },
      include: { activity: true },
      orderBy: { fechaProgramada: 'asc' },
    });

    const vencidas = candidatas.filter((o) => o.fechaProgramada < now);
    const proximasAVencer = candidatas
      .filter((o) => o.fechaProgramada >= now)
      .map((o) => ({
        ...o,
        diasRestantes: Math.ceil(
          (o.fechaProgramada.getTime() - now.getTime()) / DAY_MS,
        ),
      }))
      .filter((o) => cfg.diasAntes.includes(o.diasRestantes));

    return { vencidas, proximasAVencer, sonidoActivo: cfg.sonidoActivo };
  }
}
