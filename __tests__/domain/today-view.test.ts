import { describe, it, expect } from 'vitest';
import { clockOffset, secondsLeft, formatCountdown, resolveConnectionState, buildTodayFooterView } from '../../lib/execution/today-view';

describe('[001] US1 — Tanda de 10 minutos en un toque', () => {
  it('US1-AS8 · el tiempo restante se calcula con la hora del sistema, no con la del teléfono desfasado', () => {
    // server_now real al momento de la consulta: 15:00:00Z. El reloj del cliente está 5 minutos
    // ADELANTADO cuando se captura el offset (server_now - Date.now()).
    const serverNowAtFetch = '2026-09-14T15:00:00.000Z';
    const clientNowAtFetch = new Date('2026-09-14T15:05:00.000Z').getTime();
    const offsetMs = clockOffset(serverNowAtFetch, clientNowAtFetch);
    expect(offsetMs).toBe(-5 * 60 * 1000);

    // La tanda termina a las 15:10:00Z (10 minutos después del server_now real capturado).
    const endsAt = '2026-09-14T15:10:00.000Z';

    // Pasa 1 minuto real. El reloj del cliente (todavía desfasado +5min) ahora marca 15:06:00Z.
    // Con el offset corregido, el "ahora" real es 15:01:00Z y deberían quedar 9 minutos (540s),
    // no los 4 minutos que daría una lectura cruda de Date.now() sin corregir.
    const clientNowAtTick = new Date('2026-09-14T15:06:00.000Z').getTime();
    expect(secondsLeft(endsAt, offsetMs, clientNowAtTick)).toBe(9 * 60);
  });

  it('formatCountdown devuelve mm:ss', () => {
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(59)).toBe('00:59');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5)).toBe('00:00'); // nunca un contador negativo
  });

  it('sin datos del servidor, el modelo expone el estado "sin conexión" (caso borde de spec.md)', () => {
    expect(resolveConnectionState(null)).toBe('offline');
    expect(resolveConnectionState(undefined)).toBe('offline');
    expect(resolveConnectionState({ server_now: '2026-09-14T15:00:00.000Z' })).toBe('online');
  });
});

describe('[001] US3 — Hábitos del día y día cumplido', () => {
  it('US3-AS8 · los hábitos de hoy sin responder aparecen como filas Sí/No, sin minutos totales ni proyecciones de nota', () => {
    const withPending = buildTodayFooterView({
      pending_checks: [{ habit_id: 'levantada', label: 'Levantarme a las 6:00' }],
      tandas_today: 0,
      day_fulfilled: null,
    });
    expect(withPending.checks).toEqual([{ habit_id: 'levantada', label: 'Levantarme a las 6:00' }]);
    expect(withPending.tandasLine).toBeNull(); // sin tandas hoy: FR-018 no muestra "0 tandas"
    expect(withPending.dayFulfilledLine).toBeNull();

    const dayDone = buildTodayFooterView({ pending_checks: [], tandas_today: 3, day_fulfilled: true });
    expect(dayDone.checks).toEqual([]);
    expect(dayDone.tandasLine).toBe('3 tandas hoy');
    expect(dayDone.dayFulfilledLine).toBe('Día cumplido');

    // FR-018/FR-008: el modelo nunca expone minutos totales, mínimo faltante, proyecciones de
    // nota ni un selector de modo de trabajo — solo trae estas tres claves.
    expect(Object.keys(dayDone).sort()).toEqual(['checks', 'dayFulfilledLine', 'tandasLine']);
  });
});
