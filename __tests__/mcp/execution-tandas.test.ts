import { describe, it } from 'vitest';

describe('[001] US1 — Tanda de 10 minutos en un toque', () => {
  it.todo('US1-AS1 · empezar una tanda la deja en curso con la hora de inicio del sistema y el fin previsto 10 minutos después');
  it.todo('US1-AS2 · con una tanda en curso, empezar otra se rechaza (ya hay una tanda en curso)');
  it.todo('US1-AS3 · una tanda cuyo tiempo ya se cumplió queda completada (10 min) en cualquier operación posterior');
  it.todo('US1-AS4 · terminar una tanda a la que le queda tiempo se rechaza: solo se puede interrumpir');
  it.todo('US1-AS5 · interrumpir sin razón se rechaza; con una razón de una línea queda interrumpida con los minutos reales');
  it.todo('US1-AS6 · cambiar la materia de una tanda cerrada después de las 03:00 se guarda y queda marcada como editada tras el cierre');
  it.todo('US1-AS7 · una tanda empezada a las 23:55 hora de Bogotá cuenta para el día en que empezó');
});
