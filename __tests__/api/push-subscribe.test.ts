import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { fetchPushSubscriptionsFromDb } from '../../lib/db/execution-pg';

// US7 — Avisos en el teléfono (FR-032/FR-033). Rutas de suscripción push (contracts/web-api.md):
// POST /api/push/subscribe valida y hace upsert idempotente por sha256(endpoint); DELETE borra;
// GET /api/push/public-key entrega la clave VAPID en tiempo de ejecución. Ninguna de las tres
// rutas existe todavía a la altura de este commit RED (T060 las crea), así que se cargan con
// import() dinámico en beforeAll — igual que __tests__/mcp/weekly-report.test.ts hace con
// lib/execution/tick — para que la falta de la funcionalidad sea la razón del fallo.

function subscriptionId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

describe('[001] US7 — Avisos en el teléfono', () => {
  let harness: TestDbHarness;
  let subscribeRoute: {
    POST: (req: Request) => Promise<Response>;
    DELETE: (req: Request) => Promise<Response>;
  };
  let publicKeyRoute: { GET: () => Promise<Response> };
  let testRoute: { POST: () => Promise<Response> };

  beforeAll(async () => {
    harness = await createTestDb();
    subscribeRoute = await import(/* @vite-ignore */ '../../app/api/push/subscribe/route');
    publicKeyRoute = await import(/* @vite-ignore */ '../../app/api/push/public-key/route');
    testRoute = await import(/* @vite-ignore */ '../../app/api/push/test/route');
  });

  beforeEach(async () => {
    await harness.reset();
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  it('US7-AS1 · activar los avisos con un gesto registra el dispositivo y el aviso de prueba llega', async () => {
    const endpoint = 'https://push.example.com/abc123';
    const body = { endpoint, keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' } };

    const postRequest = new Request('http://localhost/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const postResponse = await subscribeRoute.POST(postRequest);
    const postJson = await postResponse.json();
    expect(postResponse.status).toBe(200);
    expect(postJson.status).toBe('success');

    // id = sha256(endpoint), como exige data-model.md.
    const saved = await fetchPushSubscriptionsFromDb(subscriptionId(endpoint));
    expect(saved).toBeTruthy();
    expect((saved as any).id).toBe(subscriptionId(endpoint));
    expect((saved as any).endpoint).toBe(endpoint);
    expect((saved as any).p256dh).toBe('clave-p256dh');
    expect((saved as any).auth).toBe('clave-auth');

    // Segundo POST con el mismo endpoint: upsert idempotente, no duplica la fila.
    const secondPostResponse = await subscribeRoute.POST(
      new Request('http://localhost/api/push/subscribe', { method: 'POST', body: JSON.stringify(body) })
    );
    expect(secondPostResponse.status).toBe(200);
    const allRaw = await fetchPushSubscriptionsFromDb();
    const all = Array.isArray(allRaw) ? allRaw : [];
    expect(all.filter((s: any) => s.endpoint === endpoint)).toHaveLength(1);

    // El dispositivo puede pedir un aviso de prueba por el mismo Pusher que usa el tick.
    const testResponse = await testRoute.POST();
    const testJson = await testResponse.json();
    expect(testResponse.status).toBe(200);
    expect(testJson).toHaveProperty('sent');
    expect(testJson).toHaveProperty('removed');

    // DELETE borra la suscripción.
    const deleteResponse = await subscribeRoute.DELETE(
      new Request('http://localhost/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) })
    );
    expect(deleteResponse.status).toBe(200);
    const afterDelete = await fetchPushSubscriptionsFromDb(subscriptionId(endpoint));
    expect(afterDelete).toBeNull();
  });

  it('POST /api/push/subscribe rechaza un endpoint que no es https (DATOS_INVALIDOS)', async () => {
    const request = new Request('http://localhost/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: 'http://inseguro.example.com', keys: { p256dh: 'x', auth: 'y' } }),
    });
    const response = await subscribeRoute.POST(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.status).toBe('error');
    expect(json.code).toBe('DATOS_INVALIDOS');
  });

  it('POST /api/push/subscribe rechaza si falta keys.p256dh o keys.auth', async () => {
    const request = new Request('http://localhost/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: 'https://push.example.com/x', keys: { p256dh: 'solo-esta' } }),
    });
    const response = await subscribeRoute.POST(request);
    expect(response.status).toBe(400);
  });

  it('GET /api/push/public-key devuelve la clave VAPID configurada, leída en tiempo de ejecución', async () => {
    process.env.VAPID_PUBLIC_KEY = 'clave-publica-de-prueba';
    const response = await publicKeyRoute.GET();
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.key).toBe('clave-publica-de-prueba');
  });
});
