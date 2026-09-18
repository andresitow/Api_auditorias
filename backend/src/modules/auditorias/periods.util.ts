import { Frecuencia } from '@prisma/client';

export interface PeriodDef {
  periodo: string;
  fechaProgramada: Date;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(anio: number, monthIndex0: number): Date {
  return new Date(Date.UTC(anio, monthIndex0 + 1, 0));
}

function lastDayOfBimester(anio: number, b: number): Date {
  return new Date(Date.UTC(anio, b * 2, 0));
}

function lastDayOfQuarter(anio: number, q: number): Date {
  return new Date(Date.UTC(anio, q * 3, 0));
}

function lastDayOfSemester(anio: number, s: number): Date {
  return new Date(Date.UTC(anio, s === 1 ? 6 : 12, 0));
}

function weeksOfYear(anio: number): { week: number; fecha: Date }[] {
  const start = new Date(Date.UTC(anio, 0, 1));
  const end = new Date(Date.UTC(anio, 11, 31));
  const weeks: { week: number; fecha: Date }[] = [];
  const cursor = new Date(start);
  let week = 1;
  while (cursor <= end) {
    const weekEnd = new Date(cursor);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 4);
    weeks.push({ week, fecha: weekEnd > end ? end : weekEnd });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    week += 1;
  }
  return weeks;
}

/** Genera los periodos (y su fecha de vencimiento por defecto) que le corresponden
 * a una actividad de una frecuencia dada dentro de un año calendario. Las frecuencias
 * A_DEMANDA/CUANDO_SE_REQUIERA no se pre-generan: se registran manualmente. UNICA
 * tampoco: su única ocurrencia se crea explícitamente con la fecha programada al
 * crear la actividad (ver ActivitiesService.create). */
export function periodsForYear(frecuencia: Frecuencia, anio: number): PeriodDef[] {
  switch (frecuencia) {
    case Frecuencia.UNICA:
      return [];
    case Frecuencia.DIARIO:
      return weeksOfYear(anio).map(({ week, fecha }) => ({
        periodo: `${anio}-W${pad2(week)}`,
        fechaProgramada: fecha,
      }));
    case Frecuencia.MENSUAL:
      return Array.from({ length: 12 }, (_, i) => ({
        periodo: `${anio}-${pad2(i + 1)}`,
        fechaProgramada: lastDayOfMonth(anio, i),
      }));
    case Frecuencia.BIMENSUAL:
      return [1, 2, 3, 4, 5, 6].map((b) => ({
        periodo: `${anio}-B${b}`,
        fechaProgramada: lastDayOfBimester(anio, b),
      }));
    case Frecuencia.TRIMESTRAL:
      return [1, 2, 3, 4].map((q) => ({
        periodo: `${anio}-Q${q}`,
        fechaProgramada: lastDayOfQuarter(anio, q),
      }));
    case Frecuencia.SEMESTRAL:
      return [1, 2].map((s) => ({
        periodo: `${anio}-S${s}`,
        fechaProgramada: lastDayOfSemester(anio, s),
      }));
    case Frecuencia.ANUAL:
      return [{ periodo: `${anio}`, fechaProgramada: new Date(Date.UTC(anio, 11, 31)) }];
    case Frecuencia.A_DEMANDA:
    case Frecuencia.CUANDO_SE_REQUIERA:
      return [];
    default:
      return [];
  }
}

/** Etiqueta legible de un periodo para UI/reportes, ej. "Marzo 2026", "Q1 2026". */
export function labelPeriodo(periodo: string): string {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const mensualMatch = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (mensualMatch) return `${meses[Number(mensualMatch[2]) - 1]} ${mensualMatch[1]}`;
  const bimensualMatch = /^(\d{4})-B(\d)$/.exec(periodo);
  if (bimensualMatch) return `Bimestre ${bimensualMatch[2]} ${bimensualMatch[1]}`;
  const trimestralMatch = /^(\d{4})-Q(\d)$/.exec(periodo);
  if (trimestralMatch) return `Trimestre ${trimestralMatch[2]} ${trimestralMatch[1]}`;
  const semestralMatch = /^(\d{4})-S(\d)$/.exec(periodo);
  if (semestralMatch) return `Semestre ${semestralMatch[2]} ${semestralMatch[1]}`;
  const semanalMatch = /^(\d{4})-W(\d{2})$/.exec(periodo);
  if (semanalMatch) return `Semana ${semanalMatch[2]} ${semanalMatch[1]}`;
  return periodo;
}
