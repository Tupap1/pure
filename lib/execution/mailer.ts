/**
 * Adaptador de correo sobre la API HTTP de ZeptoMail
 * Contrato: specs/001-modulo-ejecucion/contracts/notifications.md
 */

export interface Mailer {
  send(to: string, name: string, subject: string, textbody: string): Promise<void>;
}

/**
 * Crea un mailer que envía reportes semanales vía ZeptoMail.
 *
 * Variables de entorno requeridas:
 * - ZEPTOMAIL_TOKEN: token de API (obligatorio)
 * - ZEPTOMAIL_URL: URL de la API (default: https://api.zeptomail.com/v1.1/email)
 * - REPORT_FROM: dirección de origen (del dominio verificado)
 * - REPORT_FROM_NAME: nombre del remitente
 * - REPORT_REPLY_TO: correo de respuesta (obligatorio para ZeptoMail)
 *
 * Lanza error si ZEPTOMAIL_TOKEN no está configurado.
 * En caso de respuesta no-201 o fallo de red, lanza error con formato:
 * `{status} {error.code} {error.message}` (recortado a 500 caracteres)
 */
export function createZeptoMailer(): Mailer {
  const url = process.env.ZEPTOMAIL_URL ?? 'https://api.zeptomail.com/v1.1/email';
  const from = process.env.REPORT_FROM ?? '';
  const fromName = process.env.REPORT_FROM_NAME ?? '';
  const replyTo = process.env.REPORT_REPLY_TO ?? '';

  return {
    async send(to: string, name: string, subject: string, textbody: string): Promise<void> {
      const token = process.env.ZEPTOMAIL_TOKEN;
      if (!token) {
        throw new Error('ZEPTOMAIL_TOKEN must be configured');
      }

      const body = {
        from: {
          address: from,
          name: fromName,
        },
        to: [
          {
            email_address: {
              address: to,
              name: name,
            },
          },
        ],
        reply_to: [{ address: replyTo }],
        subject: subject,
        textbody: textbody,
        track_clicks: false,
        track_opens: false,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-enczapikey ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status !== 201) {
        let errorMessage = `${response.status}`;
        try {
          const errorBody = await response.json() as {
            error?: { code?: string; message?: string };
          };
          if (errorBody.error?.code) {
            errorMessage += ` ${errorBody.error.code}`;
          }
          if (errorBody.error?.message) {
            errorMessage += ` ${errorBody.error.message}`;
          }
        } catch {
          // Si no es JSON válido, solo usamos el status
        }

        // Recortar a 500 caracteres como especifica el contrato
        if (errorMessage.length > 500) {
          errorMessage = errorMessage.substring(0, 497) + '...';
        }

        throw new Error(errorMessage);
      }
    },
  };
}
