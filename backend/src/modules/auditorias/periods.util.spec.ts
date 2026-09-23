import { Frecuencia } from '@prisma/client';
import { labelPeriodo, periodsForYear } from './periods.util';

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('periodsForYear', () => {
  describe('frecuencias que no se pre-generan', () => {
    it.each([
      Frecuencia.UNICA,
      Frecuencia.A_DEMANDA,
      Frecuencia.CUANDO_SE_REQUIERA,
    ])('%s devuelve lista vacía', (frecuencia) => {
      expect(periodsForYear(frecuencia, 2026)).toEqual([]);
    });

    it('una frecuencia desconocida devuelve lista vacía (rama default)', () => {
      expect(periodsForYear('OTRA' as unknown as Frecuencia, 2026)).toEqual([]);
    });
  });

  describe('MENSUAL', () => {
    it('genera 12 periodos AAAA-MM con el último día de cada mes', () => {
      const res = periodsForYear(Frecuencia.MENSUAL, 2026);
      expect(res).toHaveLength(12);
      expect(res.map((p) => p.periodo)).toEqual([
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
      ]);
      expect(res.map((p) => iso(p.fechaProgramada))).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
        '2026-05-31',
        '2026-06-30',
        '2026-07-31',
        '2026-08-31',
        '2026-09-30',
        '2026-10-31',
        '2026-11-30',
        '2026-12-31',
      ]);
    });

    it('febrero en año bisiesto termina el día 29', () => {
      const feb = periodsForYear(Frecuencia.MENSUAL, 2024)[1];
      expect(feb.periodo).toBe('2024-02');
      expect(iso(feb.fechaProgramada)).toBe('2024-02-29');
    });

    it('febrero 2100 (no bisiesto por regla de siglos) termina el día 28', () => {
      const feb = periodsForYear(Frecuencia.MENSUAL, 2100)[1];
      expect(iso(feb.fechaProgramada)).toBe('2100-02-28');
    });

    it('las fechas son medianoche UTC', () => {
      for (const p of periodsForYear(Frecuencia.MENSUAL, 2026)) {
        expect(p.fechaProgramada.getUTCHours()).toBe(0);
        expect(p.fechaProgramada.getUTCMinutes()).toBe(0);
      }
    });
  });

  describe('BIMENSUAL', () => {
    it('genera 6 bimestres cerrando en fin de febrero, abril, junio, ...', () => {
      const res = periodsForYear(Frecuencia.BIMENSUAL, 2026);
      expect(res.map((p) => p.periodo)).toEqual([
        '2026-B1',
        '2026-B2',
        '2026-B3',
        '2026-B4',
        '2026-B5',
        '2026-B6',
      ]);
      expect(res.map((p) => iso(p.fechaProgramada))).toEqual([
        '2026-02-28',
        '2026-04-30',
        '2026-06-30',
        '2026-08-31',
        '2026-10-31',
        '2026-12-31',
      ]);
    });

    it('B1 de un año bisiesto cierra el 29 de febrero', () => {
      expect(
        iso(periodsForYear(Frecuencia.BIMENSUAL, 2028)[0].fechaProgramada),
      ).toBe('2028-02-29');
    });
  });

  describe('TRIMESTRAL', () => {
    it('genera 4 trimestres', () => {
      const res = periodsForYear(Frecuencia.TRIMESTRAL, 2026);
      expect(res.map((p) => p.periodo)).toEqual([
        '2026-Q1',
        '2026-Q2',
        '2026-Q3',
        '2026-Q4',
      ]);
      expect(res.map((p) => iso(p.fechaProgramada))).toEqual([
        '2026-03-31',
        '2026-06-30',
        '2026-09-30',
        '2026-12-31',
      ]);
    });
  });

  describe('SEMESTRAL', () => {
    it('genera 2 semestres', () => {
      const res = periodsForYear(Frecuencia.SEMESTRAL, 2026);
      expect(res.map((p) => p.periodo)).toEqual(['2026-S1', '2026-S2']);
      expect(res.map((p) => iso(p.fechaProgramada))).toEqual([
        '2026-06-30',
        '2026-12-31',
      ]);
    });
  });

  describe('ANUAL', () => {
    it('genera un único periodo "AAAA" el 31 de diciembre', () => {
      const res = periodsForYear(Frecuencia.ANUAL, 2026);
      expect(res).toHaveLength(1);
      expect(res[0].periodo).toBe('2026');
      expect(iso(res[0].fechaProgramada)).toBe('2026-12-31');
    });
  });

  describe('DIARIO (semanal en la práctica)', () => {
    it('genera 53 semanas en un año común (365 días)', () => {
      expect(periodsForYear(Frecuencia.DIARIO, 2026)).toHaveLength(53);
    });

    it('genera 53 semanas en un año bisiesto (366 días)', () => {
      expect(periodsForYear(Frecuencia.DIARIO, 2024)).toHaveLength(53);
    });

    it('numera las semanas con relleno de 2 dígitos: AAAA-Wnn', () => {
      const res = periodsForYear(Frecuencia.DIARIO, 2026);
      expect(res[0].periodo).toBe('2026-W01');
      expect(res[8].periodo).toBe('2026-W09');
      expect(res[52].periodo).toBe('2026-W53');
    });

    it('cada semana vence 4 días después de su inicio (inicio = 1 de enero + 7*(n-1))', () => {
      const res = periodsForYear(Frecuencia.DIARIO, 2026);
      expect(iso(res[0].fechaProgramada)).toBe('2026-01-05');
      expect(iso(res[1].fechaProgramada)).toBe('2026-01-12');
    });

    it('la última semana queda recortada al 31 de diciembre', () => {
      const res = periodsForYear(Frecuencia.DIARIO, 2026);
      expect(iso(res[res.length - 1].fechaProgramada)).toBe('2026-12-31');
      const bis = periodsForYear(Frecuencia.DIARIO, 2024);
      expect(iso(bis[bis.length - 1].fechaProgramada)).toBe('2024-12-31');
    });

    it('ninguna fecha se sale del año pedido y son monótonas crecientes', () => {
      const res = periodsForYear(Frecuencia.DIARIO, 2026);
      for (let i = 0; i < res.length; i++) {
        expect(res[i].fechaProgramada.getUTCFullYear()).toBe(2026);
        if (i > 0)
          expect(res[i].fechaProgramada.getTime()).toBeGreaterThan(
            res[i - 1].fechaProgramada.getTime(),
          );
      }
    });
  });

  it('los identificadores de periodo son únicos por frecuencia', () => {
    for (const f of [
      Frecuencia.DIARIO,
      Frecuencia.MENSUAL,
      Frecuencia.BIMENSUAL,
      Frecuencia.TRIMESTRAL,
      Frecuencia.SEMESTRAL,
      Frecuencia.ANUAL,
    ]) {
      const ids = periodsForYear(f, 2026).map((p) => p.periodo);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('labelPeriodo', () => {
  it.each([
    ['2026-01', 'Enero 2026'],
    ['2026-03', 'Marzo 2026'],
    ['2026-12', 'Diciembre 2026'],
    ['2026-B1', 'Bimestre 1 2026'],
    ['2026-B6', 'Bimestre 6 2026'],
    ['2026-Q1', 'Trimestre 1 2026'],
    ['2026-Q4', 'Trimestre 4 2026'],
    ['2026-S1', 'Semestre 1 2026'],
    ['2026-S2', 'Semestre 2 2026'],
    ['2026-W07', 'Semana 07 2026'],
    ['2026-W53', 'Semana 53 2026'],
  ])('%s -> %s', (periodo, etiqueta) => {
    expect(labelPeriodo(periodo)).toBe(etiqueta);
  });

  it.each(['2026', '2026-03-15-unica', '2026-03-abc123', 'cualquier cosa', ''])(
    'devuelve el periodo tal cual si no reconoce el formato: "%s"',
    (periodo) => {
      expect(labelPeriodo(periodo)).toBe(periodo);
    },
  );

  it('los periodos generados por periodsForYear siempre tienen etiqueta reconocible (distinta del id)', () => {
    for (const f of [
      Frecuencia.DIARIO,
      Frecuencia.MENSUAL,
      Frecuencia.BIMENSUAL,
      Frecuencia.TRIMESTRAL,
      Frecuencia.SEMESTRAL,
    ]) {
      for (const p of periodsForYear(f, 2026)) {
        expect(labelPeriodo(p.periodo)).not.toBe(p.periodo);
      }
    }
  });

  it('mes fuera de rango (2026-13) produce "undefined 2026" (comportamiento actual)', () => {
    // Caracterización: no hay validación del mes; documenta el comportamiento actual.
    expect(labelPeriodo('2026-13')).toBe('undefined 2026');
  });
});
