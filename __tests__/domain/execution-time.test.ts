import { describe, it, expect } from 'vitest';
import { localParts, localDateTimeToInstant, addDays, mondayOf, splitByLocalDay } from '@/lib/execution/time';

// FR-006: cada tanda pertenece al día local en que empezó (zona horaria configurable, por
// defecto America/Bogota), aunque termine después de medianoche UTC. Toda la aritmética de
// zona horaria vive aquí en TypeScript (Constitución, Principio III), nunca en SQL.

describe('[001] US1 — Tanda de 10 minutos en un toque', () => {
  describe('lib/execution/time.ts — zona horaria (FR-006)', () => {
    it('localParts descompone un instante UTC en fecha, día de la semana y minutos locales de Bogotá', () => {
      const parts = localParts('2026-09-15T01:30:00Z');
      expect(parts).toEqual({ dateKey: '2026-09-14', dayOfWeek: 1, minutes: 1230 });
    });

    it('localDateTimeToInstant convierte una fecha y hora local de Bogotá a su instante UTC', () => {
      const instant = localDateTimeToInstant('2026-09-15', '03:00');
      expect(instant.toISOString()).toBe('2026-09-15T08:00:00.000Z');
    });

    it('addDays suma días de calendario sin depender de la zona horaria del host', () => {
      expect(addDays('2026-09-14', 1)).toBe('2026-09-15');
      expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
      expect(addDays('2026-09-14', -1)).toBe('2026-09-13');
    });

    it('mondayOf devuelve el lunes de la semana que contiene la fecha dada', () => {
      expect(mondayOf('2026-09-14')).toBe('2026-09-14'); // ya es lunes
      expect(mondayOf('2026-09-20')).toBe('2026-09-14'); // domingo de esa semana
      expect(mondayOf('2026-09-16')).toBe('2026-09-14'); // miércoles de esa semana
    });

    it('US1-AS7 · un instante de las 04:55 UTC cae en el día anterior de Bogotá', () => {
      const parts = localParts('2026-09-15T04:55:00Z');
      expect(parts.dateKey).toBe('2026-09-14');
      expect(parts.dayOfWeek).toBe(1);
    });
  });
});

// 004 · FR-F14a: un cronómetro que abarca varios días locales se reparte cortando en cada
// medianoche de PURE_TZ (Bogotá, UTC−5 fijo). Las horas de los tests van en UTC: las 23:00 locales
// del 5-oct-2026 son 2026-10-06T04:00:00Z. El reparto se calcula al leer (research R6).
describe('[004] splitByLocalDay — reparto por medianoche local (FR-F14a)', () => {
  const sumOf = (shares: { minutes: number }[]) => shares.reduce((acc, s) => acc + s.minutes, 0);

  it('una sesión dentro de un mismo día local da un solo tramo', () => {
    // 10:00 → 11:30 locales del 5-oct = 15:00 → 16:30 UTC
    const shares = splitByLocalDay('2026-10-05T15:00:00Z', '2026-10-05T16:30:00Z');
    expect(shares).toEqual([{ date: '2026-10-05', minutes: 90 }]);
  });

  it('US-F1-AS10 · 23:00→01:30 local se reparte 60 + 90', () => {
    // 23:00 del 5-oct local = 04:00Z del 6-oct; 01:30 del 6-oct local = 06:30Z
    const shares = splitByLocalDay('2026-10-06T04:00:00Z', '2026-10-06T06:30:00Z');
    expect(shares).toEqual([
      { date: '2026-10-05', minutes: 60 },
      { date: '2026-10-06', minutes: 90 },
    ]);
  });

  it('US-F1-AS10 · lunes 22:00 → miércoles 02:00 se reparte 120 + 1440 + 120', () => {
    // lunes 5-oct 22:00 local = 03:00Z del martes 6; miércoles 7-oct 02:00 local = 07:00Z
    const shares = splitByLocalDay('2026-10-06T03:00:00Z', '2026-10-07T07:00:00Z');
    expect(shares).toEqual([
      { date: '2026-10-05', minutes: 120 },
      { date: '2026-10-06', minutes: 1440 },
      { date: '2026-10-07', minutes: 120 },
    ]);
  });

  it('el piso es acumulado: 23:00:30 → 00:10:40 da 59 + 11 = 70, nunca 59 + 10 = 69', () => {
    // 23:00:30 local = 04:00:30Z; 00:10:40 local del día siguiente = 05:10:40Z
    const shares = splitByLocalDay('2026-10-06T04:00:30Z', '2026-10-06T05:10:40Z');
    expect(shares).toEqual([
      { date: '2026-10-05', minutes: 59 },
      { date: '2026-10-06', minutes: 11 },
    ]);
    expect(sumOf(shares)).toBe(70);
  });

  it('la suma de los tramos siempre es floor((fin − inicio) / 60 s), con segundos y milisegundos sueltos', () => {
    // Generador congruencial con semilla fija: el barrido es reproducible. 300 pares con inicios
    // repartidos en 3 días (cruzan varias medianoches locales) y duraciones de hasta 5 días.
    let seed = 20261005;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const base = Date.UTC(2026, 9, 1);
    for (let i = 0; i < 300; i++) {
      const startMs = base + Math.floor(next() * 3 * 86_400_000);
      const durMs = Math.floor(next() * 5 * 86_400_000);
      const shares = splitByLocalDay(new Date(startMs).toISOString(), new Date(startMs + durMs).toISOString());
      expect(sumOf(shares)).toBe(Math.floor(durMs / 60_000));
      expect(shares.every((s) => s.minutes >= 0)).toBe(true);
      // los días son consecutivos y empiezan en el día local de inicio
      expect(shares[0].date).toBe(localParts(new Date(startMs)).dateKey);
      for (let k = 1; k < shares.length; k++) expect(shares[k].date).toBe(addDays(shares[k - 1].date, 1));
    }
  });

  it('un día con menos de un minuto queda con 0 minutos pero la suma se conserva (23:59:30 → 00:01:00 = 0 + 1)', () => {
    // 23:59:30 local = 04:59:30Z del 6-oct; 00:01:00 local = 05:01:00Z
    const shares = splitByLocalDay('2026-10-06T04:59:30Z', '2026-10-06T05:01:00Z');
    expect(shares).toEqual([
      { date: '2026-10-05', minutes: 0 },
      { date: '2026-10-06', minutes: 1 },
    ]);
  });

  it('un fin exactamente en la medianoche local no abre un tramo vacío en el día siguiente', () => {
    // 23:00 local del 5-oct → 00:00 local del 6-oct (= 05:00Z)
    expect(splitByLocalDay('2026-10-06T04:00:00Z', '2026-10-06T05:00:00Z')).toEqual([
      { date: '2026-10-05', minutes: 60 },
    ]);
  });

  it('un inicio exactamente en la medianoche local pertenece al día que empieza', () => {
    // 00:00 local del 6-oct (= 05:00Z) → 02:00 local
    expect(splitByLocalDay('2026-10-06T05:00:00Z', '2026-10-06T07:00:00Z')).toEqual([
      { date: '2026-10-06', minutes: 120 },
    ]);
  });

  it('una sesión de duración cero da un solo tramo de 0 minutos en su día de inicio', () => {
    expect(splitByLocalDay('2026-10-06T04:00:00Z', '2026-10-06T04:00:00Z')).toEqual([
      { date: '2026-10-05', minutes: 0 },
    ]);
  });
});
