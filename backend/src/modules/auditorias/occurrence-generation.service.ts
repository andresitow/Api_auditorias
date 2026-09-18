import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Activity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { periodsForYear } from './periods.util';

@Injectable()
export class OccurrenceGenerationService {
  private readonly logger = new Logger(OccurrenceGenerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Crea (de forma idempotente) las ocurrencias que le corresponden a una actividad
   * para un año calendario, según su frecuencia. No genera nada para A_DEMANDA/CUANDO_SE_REQUIERA.
   * Solo inserta los periodos que todavía no existen: nunca toca `fechaProgramada` de una
   * ocurrencia ya creada, para no pisar una fecha corregida manualmente (ver `editarFecha`
   * en OccurrencesService).
   *
   * `fechaInicio` (opcional) descarta los periodos anteriores a esa fecha: se usa al crear
   * (o reactivar) una actividad con programación por frecuencia para que no aparezcan
   * ocurrencias "Planeado" ya vencidas de meses/periodos previos al inicio real. El cron
   * anual y "generar año siguiente" no la usan: ahí sí interesa cubrir el año completo. */
  async generateForYear(activity: Pick<Activity, 'id' | 'frecuencia' | 'observacion'>, anio: number, fechaInicio?: Date) {
    let periodos = periodsForYear(activity.frecuencia, anio);
    if (fechaInicio) periodos = periodos.filter((p) => p.fechaProgramada >= fechaInicio);
    if (periodos.length === 0) return { periodos: 0, creadas: 0 };

    const existentes = await this.prisma.activityOccurrence.findMany({
      where: { activityId: activity.id, periodo: { in: periodos.map((p) => p.periodo) } },
      select: { periodo: true },
    });
    const existentesSet = new Set(existentes.map((e) => e.periodo));
    const faltantes = periodos.filter((p) => !existentesSet.has(p.periodo));

    if (faltantes.length > 0) {
      await this.prisma.activityOccurrence.createMany({
        data: faltantes.map(({ periodo, fechaProgramada }) => ({
          activityId: activity.id,
          periodo,
          fechaProgramada,
          observaciones: activity.observacion,
        })),
        skipDuplicates: true,
      });
    }
    return { periodos: periodos.length, creadas: faltantes.length };
  }

  /** Genera (de forma idempotente) las ocurrencias de un año calendario para todas las
   * actividades activas de una auditoría, reutilizando la misma plantilla de actividades
   * (categorías, responsables, frecuencias) ya definida — es el equivalente manual/bajo
   * demanda del cron anual, pero limitado a una auditoría y disparable en cualquier momento. */
  async generateYearForAuditoria(auditoriaId: string, anio: number) {
    const activities = await this.prisma.activity.findMany({ where: { auditoriaId, activa: true } });
    let periodosTotal = 0;
    let creadasTotal = 0;
    for (const activity of activities) {
      const { periodos, creadas } = await this.generateForYear(activity, anio);
      periodosTotal += periodos;
      creadasTotal += creadas;
    }
    return { anio, actividadesProcesadas: activities.length, periodosTotal, creadasTotal };
  }

  /** Cron anual: el 15 de diciembre a las 10:00 genera el año siguiente para todas
   * las actividades activas de frecuencia periódica, para que el 1 de enero ya
   * existan filas "Planeado" listas para usarse. */
  @Cron('0 10 15 12 *')
  async generateNextYearForAllActive() {
    const anio = new Date().getFullYear() + 1;
    const activities = await this.prisma.activity.findMany({ where: { activa: true } });
    let total = 0;
    for (const activity of activities) {
      const { creadas } = await this.generateForYear(activity, anio);
      total += creadas;
    }
    this.logger.log(`Generadas ${total} ocurrencias para el año ${anio}`);
  }
}
