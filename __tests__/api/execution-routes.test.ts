import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { POST } from '@/app/api/execution/route';
import { GET, dynamic } from '@/app/api/execution/today/route';
import { handleManageProgram, handleManageWeeklyReport } from '@/lib/execution/handlers';

// Rutas web del Módulo de Ejecución (contracts/web-api.md). Son delgadas: validan contra una
// lista blanca y delegan en los mismos handlers que el MCP (lib/execution/handlers.ts). No
// tienen autenticación propia (la tiene todo el sitio vía Cloudflare Access), así que la lista
// blanca es la única barrera contra una acción que la web no debería poder disparar (por
// ejemplo, sembrar el programa con manage_program:init, reservado al asistente de IA por FR-040).

describe('[001] US1 — Rutas web del Módulo de Ejecución', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  it('POST /api/execution rechaza con 400 DATOS_INVALIDOS lo que está fuera de la lista blanca', async () => {
    const casosFueraDeLista = [
      { tool: 'manage_program', action: 'init', data: {} },
      { tool: 'manage_weekly_report', action: 'set_partner', data: {} },
    ];

    for (const body of casosFueraDeLista) {
      const request = new Request('http://localhost/api/execution', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const response = await POST(request);
      const json = await response.json();
      expect(response.status).toBe(400);
      expect(json.status).toBe('error');
      expect(json.code).toBe('DATOS_INVALIDOS');
    }
  });

  it('POST /api/execution acepta manage_tandas:start (en la lista blanca) y responde 200', async () => {
    const request = new Request('http://localhost/api/execution', {
      method: 'POST',
      body: JSON.stringify({ tool: 'manage_tandas', action: 'start', data: {} }),
    });
    const response = await POST(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.status).toBe('success');
    expect(json.data.tanda.status).toBe('en_curso');
  });

  it('un error del handler se devuelve como 400 conservando su code', async () => {
    const request = new Request('http://localhost/api/execution', {
      method: 'POST',
      body: JSON.stringify({ tool: 'manage_tandas', action: 'finish', data: { id: 'no-existe' } }),
    });
    const response = await POST(request);
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.status).toBe('error');
    expect(json.code).toBe('NO_ENCONTRADO');
  });

  it('Principio VI: un fallo interno inesperado (p. ej. de la base de datos) no filtra su mensaje crudo en la respuesta', async () => {
    // lib/execution/handlers.ts atrapa cualquier excepción inesperada dentro de cada handler y la
    // traduce a {status:'error', code, message}; si ese `message` fuera el `error.message` crudo,
    // un fallo real de Postgres (credenciales, host, nombres de tabla) llegaría intacto hasta
    // quien llame a esta ruta, que no tiene autenticación propia (Constitución, Principio VI).
    const { pgPool } = await import('@/lib/db/pg-client');
    const originalQuery = pgPool.query;
    const rawDbMessage = 'password authentication failed for user "produser_secreto" at host 10.0.0.7:5432';
    (pgPool as any).query = vi.fn().mockRejectedValue(new Error(rawDbMessage));

    try {
      const request = new Request('http://localhost/api/execution', {
        method: 'POST',
        body: JSON.stringify({ tool: 'manage_tandas', action: 'current', data: {} }),
      });
      const response = await POST(request);
      const text = await response.text();

      expect(response.status).toBe(400);
      expect(text).not.toContain('produser_secreto');
      expect(text).not.toContain('10.0.0.7');
      expect(text).not.toContain('password authentication failed');
    } finally {
      pgPool.query = originalQuery;
    }
  });

  it('GET /api/execution/today exporta dynamic=force-dynamic y devuelve el payload de get_today', async () => {
    expect(dynamic).toBe('force-dynamic');

    const response = await GET();
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.status).toBe('success');
    expect(json.data).toHaveProperty('server_now');
    expect(json.data).toHaveProperty('date');
    expect(json.data).toHaveProperty('running_tanda');
    expect(json.data).toHaveProperty('tandas_today');
  });
});

// GET /api/execution/report y la entrada de manage_weekly_report en la lista blanca dependen de
// lib/execution/tick.ts (T054) y de app/api/execution/report/route.ts (T056), que todavía no
// existen a la altura de este commit RED: se cargan con `import()` dinámico dentro de cada
// prueba (nunca como import estático de archivo) para que la falta de esos módulos no rompa la
// recolección de TODO este archivo, incluidas las pruebas de US1 de arriba que ya están en verde.
describe('[001] US6 — Reporte semanal congelado por correo', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function freezeOneWeek() {
    await handleManageProgram('init', { starts_on: '2026-09-14', weeks: [{ min_tandas_dia: 1, phase: 'arranque' }] });
    await handleManageWeeklyReport('set_partner', {
      name: 'Andrés',
      email: 'andres@example.com',
      consented_at: '2026-09-11T00:00:00.000Z',
    });
    vi.setSystemTime(new Date('2026-09-21T00:00:30.000Z')); // domingo 19:00:30 Bogotá: se congela
    const tickModulePath = '@/lib/execution/tick';
    const { runExecutionTick } = await import(/* @vite-ignore */ tickModulePath);
    await runExecutionTick(new Date(), { mailer: { send: async () => {} } });
  }

  it('US6-AS11 · entre el congelamiento y el envío, la web muestra el reporte y la nota sin el correo del destinatario', async () => {
    await freezeOneWeek();

    const reportRouteModulePath = '@/app/api/execution/report/route';
    const { GET: getReport } = await import(/* @vite-ignore */ reportRouteModulePath);
    const response = await getReport();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe('success');
    expect(json.data.status).toBe('congelado');
    expect(json.data.partner_name).toBe('Andrés');
    expect(JSON.stringify(json)).not.toContain('andres@example.com');
  });

  it('manage_weekly_report:set_note está en la lista blanca de POST /api/execution y set_partner no', async () => {
    await freezeOneWeek();

    const okRequest = new Request('http://localhost/api/execution', {
      method: 'POST',
      body: JSON.stringify({
        tool: 'manage_weekly_report',
        action: 'set_note',
        data: { program_week_id: 'pw-01', note: 'hola' },
      }),
    });
    const okResponse = await POST(okRequest);
    const okJson = await okResponse.json();
    expect(okResponse.status).toBe(200);
    expect(okJson.status).toBe('success');

    const blockedRequest = new Request('http://localhost/api/execution', {
      method: 'POST',
      body: JSON.stringify({ tool: 'manage_weekly_report', action: 'set_partner', data: {} }),
    });
    const blockedResponse = await POST(blockedRequest);
    const blockedJson = await blockedResponse.json();
    expect(blockedResponse.status).toBe(400);
    expect(blockedJson.code).toBe('DATOS_INVALIDOS');
  });
});
