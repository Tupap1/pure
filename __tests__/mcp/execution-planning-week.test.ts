import { describe, it } from 'vitest';

describe('[002] US-B1 — Planear la semana que todavía no empieza', () => {
  it.todo('US-B1-AS1 · el domingo resuelve la semana que arranca mañana');
  it.todo('US-B1-AS2 · dentro de la semana resuelve la semana en curso');
  it.todo('US-B1-AS3 · el último día de la semana resuelve la siguiente');
  it.todo('US-B1-AS4 · antes de que empiece el programa resuelve la primera');
  it.todo('US-B1-AS5 · después del programa se rechaza con mensaje de fin');
  it.todo('US-B1-AS6 · indicar una semana explícita la usa sin resolución');
  it.todo('US-B1-AS7 · registrar intenciones para una semana válida las guarda');
  it.todo('US-B1-AS8 · abrir una semana futura es planeación sin compuerta');
  it.todo('US-B1-AS9 · sin indicar semana, abre la que contiene hoy o la próxima');
  it.todo('US-B1-AS10 · la vista previa del reporte usa solo la semana en curso');
});
