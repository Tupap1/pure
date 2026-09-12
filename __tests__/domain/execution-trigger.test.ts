import { describe, it } from 'vitest';

describe('[001] US2 — Un solo disparador vigente', () => {
  it.todo('US2-AS1 · con varios disparadores para hoy, solo aparece el de hora de referencia más reciente ya pasada y sin responder');
  it.todo('US2-AS2 · el siguiente disparador (que todavía no llega) no aparece');
  it.todo('US2-AS3 · un disparador ya respondido hoy no vuelve a aparecer hoy');
  it.todo('US2-AS4 · un disparador "al salir de clase" usa el fin de esa clase según el horario, con su día y alternancia de sábados');
  it.todo('US2-AS5 · un disparador de sábado B no aparece en sábado A');
  it.todo('US2-AS10 · un disparador sin respuesta con más de 4 horas de antigüedad no aparece');
});
