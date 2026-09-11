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

- **Transporte**: la interfaz `Mailer`, implementada con `nodemailer` sobre SMTP.
  - Conexión: `SMTP_HOST`, `SMTP_PORT` (465 → `secure: true`), `SMTP_USER` y `SMTP_PASS`.
  - Remitente y respuestas: `from = REPORT_FROM || SMTP_USER`, `replyTo = SMTP_USER`, así que las
    respuestas le llegan a Andres.
  - Si falta configuración, el error aparece al enviar: el reporte queda en `fallido` con
    `last_error`.
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
  - Segunda semana `fallida` seguida: `Segunda semana fallida. Si puedes, llámalo.`
  - Desde US9: `Aperturas del plan: {N}`.
- **Veredicto**: ≥ 6/7 días cumplidos → `cumplida`; ≤ 3/7 → `fallida`; en otro caso `parcial`.
