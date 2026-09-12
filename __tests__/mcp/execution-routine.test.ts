import { describe, it } from 'vitest';

describe('[001] US2 — Un solo disparador vigente', () => {
  it.todo('US2-AS6 · crear un disparador con duración, número de tandas o método de estudio se rechaza (SOBRE_ESPECIFICACION)');
  it.todo('US2-AS7 · "Empezar tanda" en un disparador de estudio lo marca hecho y liga la tanda a él y a su materia');
  it.todo('US2-AS8 · responder "No" en un disparador de hábito deja ese hábito como no cumplido hoy');
  it.todo('US2-AS9 · ensayar un disparador ya ensayado esta semana no registra un segundo ensayo');
});
