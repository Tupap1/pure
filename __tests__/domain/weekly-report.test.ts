import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { createZeptoMailer } from '@/lib/execution/mailer';
import { computeVerdict, isTandaBeforeCutoff } from '@/lib/domain/execution';
import { localDateTimeToInstant } from '@/lib/execution/time';

// Tipos de lib/execution/report.ts repetidos aquí en vez de importados: ese módulo todavía no
// existe a la altura de este commit RED (T053 lo crea), y hasta un `import type` hace que Vite
// intente resolver la ruta al construir el grafo de módulos del archivo, lo que tumbaría la
// recolección de TODO este archivo — incluido el describe "ZeptoMail adapter" de abajo, que ya
// está en verde y no se debe tocar.
interface BuildReportPayloadInputRiskItem {
  subject_id: string;
  name: string;
  neededToPass: number;
  nextEvaluation: { title: string; due_date: string } | null;
}
interface BuildReportPayloadInput {
  program_week_id: string;
  week_number: number;
  starts_on: string;
  days_fulfilled: number;
  habits: { id: string; label: string; cumplidos: number; total: number }[];
  accumulated_fulfilled_days: number;
  horizon_days: number;
  en_riesgo: {
    perdidas: string[];
    necesita_refuerzo: BuildReportPayloadInputRiskItem[];
    abandonadas: string[];
    ciegas_count: number;
  };
  user_note: string | null;
  late_edits: number;
  late: boolean;
  previous_report_failed: boolean;
  second_consecutive_failure: boolean;
  plan_openings?: number;
}
interface ReportPayload extends BuildReportPayloadInput {
  ends_on: string;
  verdict: 'cumplida' | 'fallida' | 'parcial';
}

// US6 — Reporte semanal congelado por correo (FR-019..FR-024). Las pruebas de esta sección son
// deliberadamente puras (sin pg-mem): buildReportPayload y renderReportText reciben ya
// ensamblados los números de la semana (lib/execution/tick.ts es quien los junta desde
// getCompliance + computeGradeProjections); así se pueden fijar con exactitud, sin depender del
// reloj del servidor ni de sembrar datos. El estado en pg-mem (congelar, enviar, reintentar) se
// prueba en __tests__/mcp/weekly-report.test.ts (T050).

function baseReportInput(overrides: Partial<BuildReportPayloadInput> = {}): BuildReportPayloadInput {
  return {
    program_week_id: 'pw-01',
    week_number: 1,
    starts_on: '2026-09-14', // lunes
    days_fulfilled: 5,
    habits: [
      { id: 'levantada', label: 'Levantada 6:00', cumplidos: 5, total: 7 },
      { id: 'celular', label: 'Celular fuera del cuarto', cumplidos: 7, total: 7 },
    ],
    accumulated_fulfilled_days: 5,
    horizon_days: 66,
    en_riesgo: { perdidas: [], necesita_refuerzo: [], abandonadas: [], ciegas_count: 0 },
    user_note: null,
    late_edits: 0,
    late: false,
    previous_report_failed: false,
    second_consecutive_failure: false,
    ...overrides,
  };
}

// lib/execution/report.ts todavía no existe a la altura de este commit RED (T053 lo crea). Se
// carga con `import()` dinámico dentro de un beforeAll DE ESTE describe (no a nivel de archivo),
// para que su ausencia falle solo estas pruebas y no arrastre a la falla de recolección al
// describe "ZeptoMail adapter" de abajo, que ya está en verde y no se debe tocar.
describe('[001] US6 — Reporte semanal congelado por correo', () => {
  let buildReportPayload: (input: BuildReportPayloadInput) => ReportPayload;
  let renderReportText: (payload: ReportPayload) => string;

  beforeAll(async () => {
    const modulePath = '@/lib/execution/report';
    const reportModule = await import(/* @vite-ignore */ modulePath);
    buildReportPayload = reportModule.buildReportPayload;
    renderReportText = reportModule.renderReportText;
  });

  afterEach(() => {
    delete process.env.REPORT_OWNER_NAME;
  });

  it('computeVerdict: 6 o 7 días es "cumplida", 3 o menos es "fallida", el resto "parcial"', () => {
    expect(computeVerdict(7)).toBe('cumplida');
    expect(computeVerdict(6)).toBe('cumplida');
    expect(computeVerdict(5)).toBe('parcial');
    expect(computeVerdict(4)).toBe('parcial');
    expect(computeVerdict(3)).toBe('fallida');
    expect(computeVerdict(0)).toBe('fallida');
  });

  it('el corte del domingo 19:00 excluye las tandas posteriores', () => {
    const cutoff = localDateTimeToInstant('2026-09-20', '19:00'); // domingo, corte del reporte
    expect(isTandaBeforeCutoff('2026-09-20T23:00:00.000Z', cutoff)).toBe(true); // 18:00 Bogotá: antes del corte
    expect(isTandaBeforeCutoff(cutoff.toISOString(), cutoff)).toBe(true); // exactamente en el corte, cuenta
    const oneSecondLater = new Date(cutoff.getTime() + 1000).toISOString();
    expect(isTandaBeforeCutoff(oneSecondLater, cutoff)).toBe(false); // un segundo después, ya no
  });

  it('US6-AS5 · sin nota del usuario, el reporte dice "Andrés no dio explicación."', () => {
    delete process.env.REPORT_OWNER_NAME;
    const payload = buildReportPayload(baseReportInput({ user_note: null }));
    const text = renderReportText(payload);
    expect(text).toContain('Andrés no dio explicación.');
    expect(text).not.toContain('dice:');
  });

  it('con una nota del usuario, el reporte la cita literalmente en vez de "no dio explicación"', () => {
    const payload = buildReportPayload(
      baseReportInput({ user_note: 'el martes me acosté a las 3 por el trabajo.' })
    );
    const text = renderReportText(payload);
    expect(text).toContain('Andrés dice: "el martes me acosté a las 3 por el trabajo."');
    expect(text).not.toContain('no dio explicación');
  });

  it('US6-AS7 · dos semanas seguidas con veredicto fallida agregan "Segunda semana fallida. Si puedes, llámalo."', () => {
    const payload = buildReportPayload(baseReportInput({ days_fulfilled: 2, second_consecutive_failure: true }));
    expect(payload.verdict).toBe('fallida');
    const text = renderReportText(payload);
    expect(text).toContain('Segunda semana fallida. Si puedes, llámalo.');
  });

  it('sin una segunda semana fallida seguida, no agrega esa línea', () => {
    const payload = buildReportPayload(baseReportInput({ days_fulfilled: 2, second_consecutive_failure: false }));
    const text = renderReportText(payload);
    expect(text).not.toContain('Segunda semana fallida');
  });

  it('US6-AS10 · el reporte trae días cumplidos sobre 7, el acumulado frente al horizonte, hábitos por fracción, veredicto, en riesgo y ediciones tardías', () => {
    const payload = buildReportPayload(
      baseReportInput({
        days_fulfilled: 5,
        accumulated_fulfilled_days: 5,
        horizon_days: 66,
        late_edits: 1,
        en_riesgo: {
          perdidas: [],
          necesita_refuerzo: [
            {
              subject_id: 'sub-quimica',
              name: 'Química',
              neededToPass: 3.33,
              nextEvaluation: { title: 'Parcial 2', due_date: '2026-09-24T23:59:00.000Z' },
            },
          ],
          abandonadas: [],
          ciegas_count: 8,
        },
        user_note: 'el martes me acosté a las 3 por el trabajo.',
      })
    );

    expect(payload.days_fulfilled).toBe(5);
    expect(payload.accumulated_fulfilled_days).toBe(5);
    expect(payload.horizon_days).toBe(66);
    expect(payload.habits).toEqual([
      { id: 'levantada', label: 'Levantada 6:00', cumplidos: 5, total: 7 },
      { id: 'celular', label: 'Celular fuera del cuarto', cumplidos: 7, total: 7 },
    ]);
    expect(payload.verdict).toBe('parcial');
    expect(payload.late_edits).toBe(1);

    const text = renderReportText(payload);
    expect(text).toContain('Días cumplidos: 5 de 7');
    expect(text).toContain('Desde el inicio: 5 de 66');
    expect(text).toContain('Levantada 6:00: 5/7');
    expect(text).toContain('Celular fuera del cuarto: 7/7');
    expect(text).toContain('Veredicto: parcial');
    expect(text).toContain('Química: necesita 3.33 en lo que queda para aprobar. Próxima: Parcial 2, jueves 24.');
    expect(text).toContain('8 materias sin evaluaciones registradas.');
    expect(text).toContain('Andrés dice: "el martes me acosté a las 3 por el trabajo."');
    expect(text).toContain('Ediciones después del cierre: 1');
  });

  it('con el sistema apagado el domingo, el reporte avisa del retraso', () => {
    const payload = buildReportPayload(baseReportInput({ late: true }));
    const text = renderReportText(payload);
    expect(text).toContain(
      'Pure estuvo apagado: este reporte se congeló con el corte del domingo 19:00 y se envía con retraso.'
    );
  });

  it('si el reporte anterior falló, el siguiente lo menciona', () => {
    const payload = buildReportPayload(baseReportInput({ previous_report_failed: true }));
    const text = renderReportText(payload);
    expect(text).toContain('La semana pasada el reporte no se pudo entregar.');
  });
});

describe('[001] ZeptoMail adapter', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock fetch globalmente
    fetchMock = vi.spyOn(globalThis, 'fetch' as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ZEPTOMAIL_TOKEN;
    delete process.env.ZEPTOMAIL_URL;
    delete process.env.REPORT_FROM;
    delete process.env.REPORT_FROM_NAME;
    delete process.env.REPORT_REPLY_TO;
  });

  it('envía un correo con la forma y cabeceras correctas a ZeptoMail', async () => {
    process.env.ZEPTOMAIL_TOKEN = 'token-de-prueba';
    process.env.ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
    process.env.REPORT_FROM = 'report@btw-one.com';
    process.env.REPORT_FROM_NAME = 'Pure';
    process.env.REPORT_REPLY_TO = 'andres@example.com';

    fetchMock.mockResolvedValueOnce({
      status: 201,
      ok: true,
    } as Response);

    const mailer = createZeptoMailer();
    await mailer.send({
      to: 'recipient@example.com',
      toName: 'Recipient Name',
      subject: 'Test Subject',
      text: 'Test body',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];

    // Verifica URL y método
    expect(call[0]).toBe('https://api.zeptomail.com/v1.1/email');
    const options = call[1] as RequestInit;
    expect(options.method).toBe('POST');

    // Verifica cabeceras
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Zoho-enczapikey token-de-prueba');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Accept']).toBe('application/json');

    // Verifica cuerpo
    const body = JSON.parse(options.body as string);
    expect(body.from).toEqual({
      address: 'report@btw-one.com',
      name: 'Pure',
    });
    expect(body.to).toEqual([
      {
        email_address: {
          address: 'recipient@example.com',
          name: 'Recipient Name',
        },
      },
    ]);
    expect(body.reply_to).toEqual([{ address: 'andres@example.com' }]);
    expect(body.subject).toBe('Test Subject');
    expect(body.textbody).toBe('Test body');
    expect(body.track_clicks).toBe(false);
    expect(body.track_opens).toBe(false);
  });

  it('resuelve sin error con respuesta 201', async () => {
    process.env.ZEPTOMAIL_TOKEN = 'token-de-prueba';
    process.env.ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
    process.env.REPORT_FROM = 'report@btw-one.com';
    process.env.REPORT_FROM_NAME = 'Pure';
    process.env.REPORT_REPLY_TO = 'andres@example.com';

    fetchMock.mockResolvedValueOnce({
      status: 201,
      ok: true,
    } as Response);

    const mailer = createZeptoMailer();
    await expect(
      mailer.send({
        to: 'recipient@example.com',
        toName: 'Recipient',
        subject: 'Subject',
        text: 'Body',
      })
    ).resolves.not.toThrow();
  });

  it('lanza error con código HTTP y detalles cuando la respuesta es 400', async () => {
    process.env.ZEPTOMAIL_TOKEN = 'token-de-prueba';
    process.env.ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
    process.env.REPORT_FROM = 'report@btw-one.com';
    process.env.REPORT_FROM_NAME = 'Pure';
    process.env.REPORT_REPLY_TO = 'andres@example.com';

    fetchMock.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email address',
        },
      }),
    } as Response);

    const mailer = createZeptoMailer();
    await expect(
      mailer.send({
        to: 'bad-email',
        toName: 'Recipient',
        subject: 'Subject',
        text: 'Body',
      })
    ).rejects.toThrow(/400.*INVALID_EMAIL.*Invalid email address/);
  });

  it('lanza error cuando el fetch rechaza (fallo de red)', async () => {
    process.env.ZEPTOMAIL_TOKEN = 'token-de-prueba';
    process.env.ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
    process.env.REPORT_FROM = 'report@btw-one.com';
    process.env.REPORT_FROM_NAME = 'Pure';
    process.env.REPORT_REPLY_TO = 'andres@example.com';

    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const mailer = createZeptoMailer();
    await expect(
      mailer.send({
        to: 'recipient@example.com',
        toName: 'Recipient',
        subject: 'Subject',
        text: 'Body',
      })
    ).rejects.toThrow(/Network error|fetch failed/i);
  });

  it('falla sin ZEPTOMAIL_TOKEN configurado', async () => {
    delete process.env.ZEPTOMAIL_TOKEN;
    process.env.ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
    process.env.REPORT_FROM = 'report@btw-one.com';
    process.env.REPORT_FROM_NAME = 'Pure';
    process.env.REPORT_REPLY_TO = 'andres@example.com';

    fetchMock.mockResolvedValueOnce({
      status: 201,
      ok: true,
    } as Response);

    const mailer = createZeptoMailer();
    await expect(
      mailer.send({
        to: 'recipient@example.com',
        toName: 'Recipient',
        subject: 'Subject',
        text: 'Body',
      })
    ).rejects.toThrow(/ZEPTOMAIL_TOKEN|token|configured/i);
  });

  it('falla sin REPORT_FROM configurado', async () => {
    delete process.env.REPORT_FROM;
    process.env.ZEPTOMAIL_TOKEN = 'token-de-prueba';
    process.env.ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
    process.env.REPORT_FROM_NAME = 'Pure';
    process.env.REPORT_REPLY_TO = 'andres@example.com';

    fetchMock.mockResolvedValueOnce({
      status: 201,
      ok: true,
    } as Response);

    const mailer = createZeptoMailer();
    await expect(
      mailer.send({
        to: 'recipient@example.com',
        toName: 'Recipient',
        subject: 'Subject',
        text: 'Body',
      })
    ).rejects.toThrow(/REPORT_FROM|from|configured/i);
  });

  it('falla sin REPORT_REPLY_TO configurado', async () => {
    delete process.env.REPORT_REPLY_TO;
    process.env.ZEPTOMAIL_TOKEN = 'token-de-prueba';
    process.env.ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
    process.env.REPORT_FROM = 'report@btw-one.com';
    process.env.REPORT_FROM_NAME = 'Pure';

    fetchMock.mockResolvedValueOnce({
      status: 201,
      ok: true,
    } as Response);

    const mailer = createZeptoMailer();
    await expect(
      mailer.send({
        to: 'recipient@example.com',
        toName: 'Recipient',
        subject: 'Subject',
        text: 'Body',
      })
    ).rejects.toThrow(/REPORT_REPLY_TO|reply_to|configured/i);
  });

  it('lee variables de entorno en el momento del envío, no al crear el mailer', async () => {
    process.env.ZEPTOMAIL_TOKEN = 'token-de-prueba';
    process.env.ZEPTOMAIL_URL = 'https://api.zeptomail.com/v1.1/email';
    process.env.REPORT_FROM = 'original@btw-one.com';
    process.env.REPORT_FROM_NAME = 'Pure';
    process.env.REPORT_REPLY_TO = 'andres@example.com';

    fetchMock.mockResolvedValueOnce({
      status: 201,
      ok: true,
    } as Response);

    const mailer = createZeptoMailer();

    // Cambiar REPORT_FROM después de crear el mailer
    process.env.REPORT_FROM = 'updated@btw-one.com';

    await mailer.send({
      to: 'recipient@example.com',
      toName: 'Recipient',
      subject: 'Subject',
      text: 'Body',
    });

    // Verificar que se usó el valor actualizado
    const call = fetchMock.mock.calls[0];
    const options = call[1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.from.address).toBe('updated@btw-one.com');
  });
});
