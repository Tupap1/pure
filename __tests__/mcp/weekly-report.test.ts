import { describe, it } from 'vitest';

describe('[001] US6 — Reporte semanal congelado por correo', () => {
  it.todo('US6-AS1 · a las 19:00 del domingo el proceso programado congela el reporte de la semana con los datos hasta ese instante');
  it.todo('US6-AS2 · registrar tandas después de congelar no cambia los números del reporte');
  it.todo('US6-AS3 · la nota se guarda dentro de la ventana de 60 minutos y se rechaza después de que cierra');
  it.todo('US6-AS4 · a las 20:00, con la ventana de nota cerrada, el reporte se envía exactamente una vez aunque el tick corra varias veces');
  it.todo('US6-AS6 · si el envío falla, hay como máximo 3 reintentos espaciados, el reporte queda fallido y el siguiente lo menciona');
  it.todo('US6-AS8 · si el sistema estuvo apagado el domingo, al volver congela con el corte original y avisa del retraso');
  it.todo('US6-AS9 · sin destinatario con consentimiento el envío falla por falta de destinatario; registrar uno sin consented_at se rechaza');
});
