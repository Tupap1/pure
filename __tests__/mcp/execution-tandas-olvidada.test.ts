import { describe, it } from 'vitest';

describe('[002] US-B2 — La tanda olvidada no bloquea el sistema', () => {
  it.todo('US-B2-AS1 · empezar una tanda nueva cierra la vencida en la misma acción');
  it.todo('US-B2-AS2 · el tick cierra la tanda una sola vez y notifica una vez');
  it.todo('US-B2-AS3 · una tanda a las 22:25 termina por tiempo sin cierre de hora');
});
