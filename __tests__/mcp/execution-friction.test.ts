import { describe, it } from 'vitest';

describe('[002] US-B5 — Registrar la fricción del teléfono y sacarla cuando me irrita', () => {
  it.todo('US-B5-AS1 · habilitar dos medidas y rechazar la tercera por límite');
  it.todo('US-B5-AS2 · habilitar una medida inválida se rechaza');
  it.todo('US-B5-AS3 · verificar una medida cambia su estado de confirmada');
  it.todo('US-B5-AS4 · deshabilitar una medida es idempotente');
  it.todo('US-B5-AS5 · calificar la irritación es única por semana y rechaza valores inválidos');
  it.todo('US-B5-AS6 · dos semanas con irritación alta retiran la medida más nueva');
  it.todo('US-B5-AS7 · una semana con baja irritación en medio no retira nada');
  it.todo('US-B5-AS8 · el reporte congelado menciona las medidas retiradas por irritación');
  it.todo('US-B5-AS9 · la fricción muestra el total activo y la irritación de la semana');
});
