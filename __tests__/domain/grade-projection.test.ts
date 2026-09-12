import { describe, it } from 'vitest';

describe('[001] US5 — Proyección de nota por materia', () => {
  it.todo('US5-AS1 · Química (1.7 al 20%, 80% pendiente, aprobatoria 3.0, meta 4.5) da necesaria 3.33, meta 5.20 (inalcanzable) y techo 4.34');
  it.todo('US5-AS2 · pesos que suman 105% se marcan "pesos inconsistentes" y no calculan necesaria ni techo');
  it.todo('US5-AS3 · una evaluación "completado" sin nota se marca "entregado sin nota"');
  it.todo('US5-AS4 · una evaluación pendiente cuya fecha ya pasó se marca "vencido sin registrar"');
  it.todo('US5-AS5 · una materia cuyo techo es menor que la aprobatoria se marca "materia perdida"');
  it.todo('US5-AS7 · una evaluación "entregada" con nota cuenta como calificada en cualquier vista');
});
