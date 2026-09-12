# Contrato — Avisos push y correo del reporte

## Avisos push (US7, FR-032)

Solo existen tres tipos. Cualquier otro tipo de aviso viola FR-032.

| Tipo | Cuándo | `title` | `body` | `tag` | `url` |
|---|---|---|---|---|---|
| Fin de tanda | El tick finaliza por tiempo una tanda con `end_notified_at` nulo | `Terminó la tanda` | `10 minutos de {materia}` o `10 minutos` | `tanda` | `/` |
| Reporte congelado | El tick congela un reporte con `freeze_notified_at` nulo | `Reporte de la semana congelado` | `Tu nota hasta las {HH:MM}` | `reporte` | `/` |
| Fallo de envío | Un reporte pasa a `fallido` | `No se pudo enviar el reporte` | `Revisa Configuración → Notificaciones` | `reporte-fallo` | `/` |

- **Payload** (JSON): `{ title, body, url, tag }`. Opciones de `web-push`: `urgency: 'high'`,
  `TTL: 600` para el fin de tanda y `TTL: 3600` para los demás.
- **Service worker** (`public/sw.js`): en `push` **siempre** llama `showNotification`, que iOS
  exige para no revocar la suscripción. En `notificationclick` enfoca una ventana existente o abre
  `url`. No tiene handler de `fetch` ni caché.
- **Permiso**: solo con un gesto del usuario, dentro de la app instalada en iOS (FR-033).
- **Limpieza**: una respuesta 404 o 410 del servicio de push borra la suscripción.
- **Variables**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:`). Sin ellas,
  `Pusher` no hace nada y deja un `warn` (el push es opcional).

## Correo del reporte (US6, FR-021/FR-022)

- **Transporte**: la interfaz `Mailer`, implementada sobre la **API HTTP de ZeptoMail**
  (`POST https://api.zeptomail.com/v1.1/email`). No se usa `nodemailer` ni SMTP.
  - Cabeceras: `Authorization: Zoho-enczapikey {ZEPTOMAIL_TOKEN}`, `Content-Type: application/json`
    y `Accept: application/json`. En `.env` el token va **sin** el prefijo `Zoho-enczapikey `; lo
    antepone el código.
  - Cuerpo:

    ```json
    {
      "from": { "address": "{REPORT_FROM}", "name": "{REPORT_FROM_NAME}" },
      "to": [ { "email_address": { "address": "correo del destinatario", "name": "su nombre" } } ],
      "reply_to": [ { "address": "{REPORT_REPLY_TO}" } ],
      "subject": "...",
      "textbody": "...",
      "track_clicks": false,
      "track_opens": false
    }
    ```

  - `reply_to` es obligatorio: el usuario de ZeptoMail es una llave de API, no un buzón, así que
    sin él las respuestas del destinatario se pierden. Apunta al correo de Andres.
  - El remitente tiene que ser una dirección del dominio verificado en ZeptoMail (`btw-one.com`).
  - Sin rastreo: `track_clicks` y `track_opens` en `false`, y el cuerpo va en `textbody`.
  - Éxito: HTTP 201. Cualquier otro código, o un fallo de red, cuenta como intento fallido y
    `last_error` guarda `{status} {error.code} {error.message}` recortado a 500 caracteres.
  - Variables: `ZEPTOMAIL_TOKEN`, `ZEPTOMAIL_URL` (por defecto la de arriba), `REPORT_FROM`,
    `REPORT_FROM_NAME` y `REPORT_REPLY_TO`. Sin `ZEPTOMAIL_TOKEN` el envío falla y el reporte
    queda en `fallido` con `last_error`; el tick nunca se cae por eso.
- **Asunto**: `Pure — semana {N} ({dd}–{dd} {mes}): {veredicto}`.
- **Cuerpo**: texto plano, corto (cabe en una pantalla de teléfono), con las cifras del `payload`
  congelado. Ejemplo:

```text
Andrés — semana 1 (14–20 sep)

Días cumplidos: 5 de 7 (domingo hasta las 19:00)
Desde el inicio: 5 de 66
Levantada 6:00: 5/7
Celular fuera del cuarto: 7/7
Veredicto: parcial

En riesgo:
· Química: necesita 3.33 en lo que queda para aprobar. Próxima: Parcial 2, jueves 24.
· 8 materias sin evaluaciones registradas.

Andrés dice: "el martes me acosté a las 3 por el trabajo."

Ediciones después del cierre: 1
```

- **Líneas condicionales**:
  - Sin nota: `Andrés no dio explicación.` (en lugar de la línea "dice").
  - Congelado tarde: `Pure estuvo apagado: este reporte se congeló con el corte del domingo 19:00 y se envía con retraso.`
  - El reporte anterior falló: `La semana pasada el reporte no se pudo entregar.`
  - Segunda semana `fallida` seguida: `Segunda semana fallida seguida. Esto ya no es un mal día:
    revisa el plan antes del domingo.`
  - Desde US9: `Aperturas del plan: {N}`.
- **Veredicto**: ≥ 6/7 días cumplidos → `cumplida`; ≤ 3/7 → `fallida`; en otro caso `parcial`.
