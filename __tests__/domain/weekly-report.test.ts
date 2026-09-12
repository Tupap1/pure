import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createZeptoMailer } from '@/lib/execution/mailer';

describe('[001] US6 — Reporte semanal congelado por correo', () => {
  it.todo('US6-AS5 · sin nota del usuario, el reporte dice "Andrés no dio explicación."');
  it.todo('US6-AS7 · dos semanas seguidas con veredicto fallida agregan "Segunda semana fallida. Si puedes, llámalo."');
  it.todo('US6-AS10 · el reporte trae días cumplidos sobre 7, el acumulado frente al horizonte, hábitos por fracción, veredicto, en riesgo y ediciones tardías');
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
