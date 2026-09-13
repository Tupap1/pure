import { describe, it } from 'vitest';

describe('[002] US-B4 — Un día solo se cumple si hice las tandas mínimas', () => {
  it.todo('US-B4-AS1 · pocas tandas y hábitos cumplidos da día no cumplido');
  it.todo('US-B4-AS2 · tandas cumplidas y un hábito no cumplido da día no cumplido');
  it.todo('US-B4-AS3 · tandas cumplidas y un hábito sin registro da día no cumplido');
  it.todo('US-B4-AS4 · tandas cumplidas y hábitos según su horario da día cumplido');
  it.todo('US-B4-AS5 · un día fuera del programa no tiene evaluación');
  it.todo('US-B4-AS6 · la pantalla Hoy no muestra el mínimo ni las tandas que faltan');
  it.todo('US-B4-AS7 · un hábito futuro no aparece en el cumplimiento de semanas pasadas');
});
