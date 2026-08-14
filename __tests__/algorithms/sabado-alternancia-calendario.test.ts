import { describe, it, expect } from 'vitest';
import { getSabadoTypeForDate, occursOnSabadoVariant } from '@/lib/algorithms/conflict-detector';

/**
 * El calendario ya no dibuja dos columnas fijas de Sábado A y Sábado B: al trabajar sobre
 * fechas reales resuelve, para cada sábado concreto, qué variante le toca a partir del
 * ancla configurada en la universidad. Estas pruebas cubren esa composición completa
 * -fecha, ancla y periodicidad de la clase- que es la que decide si un bloque se dibuja,
 * y no solo las piezas por separado.
 *
 * El escenario replica una configuración real verificada en el navegador: ancla en el
 * sábado 8 de agosto de 2026 (Sábado A) y una tutoría quincenal de Sábado B.
 */

const ANCHOR = '2026-08-08';

/** Los cinco sábados de agosto de 2026. Se usa mediodía UTC para no rozar el cambio de día. */
const AGOSTO_2026 = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29'];

const variantOf = (iso: string) => getSabadoTypeForDate(new Date(`${iso}T12:00:00Z`), ANCHOR);

const claseQuincenalB = { periodicity: 'sabado_b' as const, has_alternating_saturdays: true };
const claseQuincenalA = { periodicity: 'sabado_a' as const, has_alternating_saturdays: true };
const claseSemanal = { periodicity: 'semanal' as const, has_alternating_saturdays: true };

describe('Alternancia de sábados sobre fechas concretas', () => {
  it('alterna A y B partiendo del sábado configurado como ancla', () => {
    expect(AGOSTO_2026.map(variantOf)).toEqual([
      'sabado_b', // 1 ago: la semana anterior al ancla
      'sabado_a', // 8 ago: el ancla
      'sabado_b',
      'sabado_a',
      'sabado_b',
    ]);
  });

  it('dibuja la tutoría quincenal solo en los sábados de su variante', () => {
    const sabadosConClase = AGOSTO_2026.filter((iso) =>
      occursOnSabadoVariant(claseQuincenalB, variantOf(iso))
    );

    expect(sabadosConClase).toEqual(['2026-08-01', '2026-08-15', '2026-08-29']);
  });

  it('nunca dibuja las dos variantes el mismo sábado', () => {
    for (const iso of AGOSTO_2026) {
      const variante = variantOf(iso);
      const apareceA = occursOnSabadoVariant(claseQuincenalA, variante);
      const apareceB = occursOnSabadoVariant(claseQuincenalB, variante);
      expect(apareceA && apareceB, `${iso} muestra Sábado A y B a la vez`).toBe(false);
    }
  });

  it('dibuja la clase semanal en todos los sábados, sea cual sea la variante', () => {
    for (const iso of AGOSTO_2026) {
      expect(occursOnSabadoVariant(claseSemanal, variantOf(iso))).toBe(true);
    }
  });

  it('trata como semanal la clase de una universidad sin sábados alternos', () => {
    // Sin alternancia la periodicidad guardada deja de aplicar: la clase se dicta todas
    // las semanas y debe verse en cualquier sábado.
    const claseSinAlternancia = { periodicity: 'sabado_b' as const, has_alternating_saturdays: false };

    for (const iso of AGOSTO_2026) {
      expect(occursOnSabadoVariant(claseSinAlternancia, variantOf(iso))).toBe(true);
    }
  });

  it('mantiene la alternancia hacia atrás del ancla, no solo hacia adelante', () => {
    // Un semestre puede empezar antes de la fecha que el usuario recuerde como ancla.
    expect(variantOf('2026-07-25')).toBe('sabado_a');
    expect(variantOf('2026-07-18')).toBe('sabado_b');
  });
});
