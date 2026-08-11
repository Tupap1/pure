import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { createRequestHandler } from '../../mcp-server/index';
import { createTestDb, TestDbHarness } from '../helpers/test-db';

async function parseStreamableResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (text.includes('data: ')) {
    const dataLine = text
      .split('\n')
      .find((line) => line.startsWith('data: '))
      ?.replace('data: ', '')
      .trim();
    if (dataLine) return JSON.parse(dataLine);
  }
  return JSON.parse(text);
}

describe('MCP Verification: Creación HTTP por POST /mcp de horarios Sábado A y Sábado B', () => {
  let server: http.Server;
  let baseUrl: string;
  let harness: TestDbHarness;
  const SECRET_KEY = 'Stability8-Showcase4-Lavish9-Petition3';

  beforeAll(async () => {
    harness = await createTestDb();
    const handler = createRequestHandler({ secretKey: SECRET_KEY });
    server = http.createServer(handler);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('Crear por HTTP POST /mcp dos horarios de Sábado a la misma hora (sabado_a y sabado_b) y leerlos de vuelta', async () => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${SECRET_KEY}`,
    };

    // 1. Crear Universidad y Materias previas
    await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'manage_universities',
          arguments: {
            action: 'create',
            data: { id: 'u-unad', name: 'UNAD Distancia', has_alternating_saturdays: true, first_sabado_a_date: '2026-08-01' },
          },
        },
      }),
    });

    await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'manage_subjects',
          arguments: {
            action: 'create',
            data: { id: 'sub-algebra', university_id: 'u-unad', name: 'Álgebra Lineal' },
          },
        },
      }),
    });

    await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'manage_subjects',
          arguments: {
            action: 'create',
            data: { id: 'sub-programacion', university_id: 'u-unad', name: 'Programación I' },
          },
        },
      }),
    });

    // 2. Crear Horario 1: Sábado 08:00 - 12:00 (Sábado A)
    const createARes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'manage_schedules',
          arguments: {
            action: 'create',
            data: {
              id: 'sch-sabado-a-curl',
              subject_id: 'sub-algebra',
              day_of_week: 6,
              start_time: '08:00',
              end_time: '12:00',
              classroom: 'Aula 101 (Tutoría A)',
              periodicity: 'sabado_a',
            },
          },
        },
      }),
    });

    expect(createARes.status).toBe(200);
    const dataA = await parseStreamableResponse(createARes);
    console.log('\n================ RESPUESTA CREAR SÁBADO A ================');
    console.log(JSON.stringify(dataA, null, 2));

    // 3. Crear Horario 2: Sábado 08:00 - 12:00 (Sábado B) - Misma Hora!
    const createBRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'manage_schedules',
          arguments: {
            action: 'create',
            data: {
              id: 'sch-sabado-b-curl',
              subject_id: 'sub-programacion',
              day_of_week: 6,
              start_time: '08:00',
              end_time: '12:00',
              classroom: 'Lab C (Tutoría B)',
              periodicity: 'sabado_b',
            },
          },
        },
      }),
    });

    expect(createBRes.status).toBe(200);
    const dataB = await parseStreamableResponse(createBRes);
    console.log('\n================ RESPUESTA CREAR SÁBADO B ================');
    console.log(JSON.stringify(dataB, null, 2));

    // 4. Leer Horarios de vuelta y verificar persistencia
    const readRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'manage_schedules',
          arguments: { action: 'read' },
        },
      }),
    });

    expect(readRes.status).toBe(200);
    const dataRead = await parseStreamableResponse(readRes);
    console.log('\n================ LECTURA DE HORARIOS PERSISTIDOS ================');
    console.log(JSON.stringify(dataRead, null, 2));

    const parsedContent = JSON.parse(dataRead.result.content[0].text);
    expect(parsedContent.status).toBe('success');
    expect(parsedContent.data.length).toBe(2);

    const schedA = parsedContent.data.find((s: any) => s.id === 'sch-sabado-a-curl');
    const schedB = parsedContent.data.find((s: any) => s.id === 'sch-sabado-b-curl');

    expect(schedA).toBeDefined();
    expect(schedA.periodicity).toBe('sabado_a');

    expect(schedB).toBeDefined();
    expect(schedB.periodicity).toBe('sabado_b');
  });
});
