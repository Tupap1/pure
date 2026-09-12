import { describe, it } from 'vitest';

describe('[001] US8 — Planeación del domingo y tareas', () => {
  it.todo('US8-AS1 · una intención menor a 6 sin razón se rechaza; esa materia no recibe disparadores sugeridos');
  it.todo('US8-AS2 · una tarea estimada en más de 3 tandas se rechaza pidiendo partirla');
  it.todo('US8-AS3 · las tareas de ayer sin hacer no aparecen arrastradas como pendientes de hoy');
  it.todo('US8-AS4 · el reparto sugerido de tandas sale de las horas de trabajo independiente de la norma de créditos, con urgencia y proyección aparte');
  it.todo('US8-AS5 · la planeación del domingo muestra la semana pasada, las entregas de 14 días, las intenciones, los disparadores y su ensayo');
});
