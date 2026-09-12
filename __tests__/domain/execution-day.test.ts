import { describe, it } from 'vitest';

describe('[001] US3 — Hábitos del día y día cumplido', () => {
  it.todo('US3-AS1 · con todos los hábitos activos cumplidos y al menos el mínimo de tandas, el día queda cumplido');
  it.todo('US3-AS2 · un hábito activo sin registro deja el día no cumplido');
  it.todo('US3-AS3 · un hábito marcado "no aplica" no impide que el día quede cumplido');
  it.todo('US3-AS4 · el mínimo de hoy es el de la semana, sin sumar lo que faltó ayer');
  it.todo('US3-AS6 · un hábito que empieza más adelante no se exige antes de su fecha de inicio');
});
