import { describe, it } from 'vitest';

describe('[001] US7 — Avisos en el teléfono', () => {
  it.todo('US7-AS2 · al cumplirse los 10 minutos con el teléfono bloqueado llega un único aviso "Terminó la tanda" en ≤ 20 s');
  it.todo('US7-AS3 · al congelar el reporte llega un aviso con la hora límite de la nota; si falla el envío, llega un aviso del fallo');
  it.todo('US7-AS4 · una suscripción cuya respuesta es 404/410 se elimina');
  it.todo('US7-AS5 · en cualquier día con disparadores configurados no se envía ningún recordatorio del plan');
});
