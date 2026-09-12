// Adaptador de avisos push del Módulo de Ejecución (US7, FR-032/FR-033).
// Contrato: specs/001-modulo-ejecucion/contracts/notifications.md — solo existen tres tipos de
// aviso (fin de tanda, reporte congelado, fallo de envío); cualquier otro violaría FR-032.
//
// Mismo patrón que lib/execution/mailer.ts: una interfaz (Pusher) con una implementación real
// detrás (createWebPusher, sobre el paquete `web-push`) que lee las variables VAPID_* en el
// momento de notificar, nunca al construirse. A diferencia del correo, el push es opcional
// (contracts/notifications.md): sin VAPID configurado, notify() nunca lanza, solo deja un
// console.warn y no hace nada — que falte esa configuración no puede tumbar el tick ni el envío
// del reporte (US6).

import webpush from 'web-push';
import {
  fetchPushSubscriptionsFromDb,
  deletePushSubscriptionFromDb,
  markPushSubscriptionSuccessInDb,
  PushSubscriptionRecord,
} from '../db/execution-pg';

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface PushSendResult {
  /** Suscripciones a las que se les mandó el aviso con éxito. */
  sent: number;
  /** Suscripciones eliminadas por responder 404/410 (contracts/notifications.md: "una respuesta
   * 404 o 410 borra la suscripción"). */
  removed: number;
}

export interface Pusher {
  notify(payload: PushNotificationPayload): Promise<PushSendResult>;
}

/** FR-032: TTL de 600s para el fin de tanda (aviso urgente, de vida corta: si el dispositivo
 * estuvo offline más que eso, ya no vale la pena entregarlo) y 3600s para los otros dos avisos,
 * según contracts/notifications.md. */
const TANDA_TTL_SECONDS = 600;
const DEFAULT_TTL_SECONDS = 3600;

function ttlFor(tag: string): number {
  return tag === 'tanda' ? TANDA_TTL_SECONDS : DEFAULT_TTL_SECONDS;
}

/** true si `error` es la respuesta 404/410 de un servicio de push a una suscripción muerta. La
 * librería `web-push` expone el código HTTP como `statusCode` en el error que lanza. */
function isGoneStatusCode(error: unknown): boolean {
  const statusCode = (error as { statusCode?: number } | null | undefined)?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

/**
 * Crea el Pusher real sobre `web-push`. Lee VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT en
 * el momento de notificar (nunca al construirse, igual que createZeptoMailer con
 * ZEPTOMAIL_TOKEN): sin esas tres variables, notify() no hace nada más que un console.warn — el
 * push es opcional (contracts/notifications.md) y su ausencia nunca debe tumbar el tick.
 *
 * Un aviso se manda a TODAS las suscripciones registradas (Pure es de un solo usuario, pero
 * puede tener el mismo dispositivo o varios). El fallo de una suscripción individual (de red, o
 * cualquier código que no sea 404/410) no debe impedir que las demás reciban el aviso: el push es
 * best-effort.
 */
export function createWebPusher(): Pusher {
  return {
    async notify(payload: PushNotificationPayload): Promise<PushSendResult> {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      const subject = process.env.VAPID_SUBJECT;

      if (!publicKey || !privateKey || !subject) {
        console.warn('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT no están configurados: no se envía ningún aviso push.');
        return { sent: 0, removed: 0 };
      }

      webpush.setVapidDetails(subject, publicKey, privateKey);

      const subsRaw = await fetchPushSubscriptionsFromDb();
      const subs = (Array.isArray(subsRaw) ? subsRaw : []) as PushSubscriptionRecord[];
      if (subs.length === 0) return { sent: 0, removed: 0 };

      const body = JSON.stringify(payload);
      const options = { TTL: ttlFor(payload.tag), urgency: 'high' as const };
      const now = new Date();

      let sent = 0;
      let removed = 0;

      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              body,
              options
            );
            sent++;
            await markPushSubscriptionSuccessInDb(sub.id, now);
          } catch (error) {
            if (isGoneStatusCode(error)) {
              await deletePushSubscriptionFromDb(sub.id);
              removed++;
            }
            // Cualquier otro error (de red, temporal) no borra la suscripción ni tumba el resto
            // de los avisos: se reintentará en el próximo evento que dispare un push.
          }
        })
      );

      return { sent, removed };
    },
  };
}
