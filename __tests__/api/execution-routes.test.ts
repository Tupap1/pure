import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { POST } from '@/app/api/execution/route';
import { GET, dynamic } from '@/app/api/execution/today/route';

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

describe('[001] US6 — Reporte semanal congelado por correo', () => {
  it.todo('US6-AS11 · entre el congelamiento y el envío, la web muestra el reporte y la nota sin el correo del destinatario');
});
