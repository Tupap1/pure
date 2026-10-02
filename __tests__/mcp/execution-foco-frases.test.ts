import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageQuotes, handleGetToday } from '../../lib/execution/handlers';
import { POST } from '@/app/api/execution/route';

// US-F5 (004) -- Frase del día. Las frases latinas entran SOLO por MCP (manage_quotes), una a una o
// en carga múltiple todo o nada e idempotente por texto latino (sin distinguir mayúsculas ni espacios
// en los extremos, research R4), y Hoy las rota por fecha local (research R5). La carga real son las
// 50 frases de specs/004-foco-cronometro/frases.json. Bogotá es UTC-5: las 10:00 locales del lunes
// 14-sep son 2026-09-14T15:00:00Z.

const MON_10H = '2026-09-14T15:00:00.000Z';

const FRASES_PATH = path.resolve(__dirname, '..', '..', 'specs', '004-foco-cronometro', 'frases.json');
const FRASES_JSON: Array<{ text: string; translation?: string; source?: string }> = JSON.parse(
  fs.readFileSync(FRASES_PATH, 'utf-8')
);

function dataOf(res: any): any {
  expect(res.status).toBe('success');
  return res.status === 'success' ? res.data : undefined;
}

function expectError(res: any, code: string) {
  expect(res.status).toBe('error');
  if (res.status === 'error') expect(res.code).toBe(code);
}

/** Id determinista de una frase (research R4): `frase-` + 16 hex del SHA-256 de lower(trim(text)). */
function expectedId(text: string): string {
  return `frase-${crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex').slice(0, 16)}`;
}

async function createMany(frases: unknown[]): Promise<any> {
  return handleManageQuotes('create_many', { frases });
}

async function readQuotes(data: Record<string, unknown> = {}): Promise<any[]> {
  return dataOf(await handleManageQuotes('read', data)).frases;
}

/** `frase_del_dia` de get_today consultado en el instante `atIso`. */
async function fraseDelDia(atIso: string): Promise<any> {
  const today = dataOf(await handleGetToday({ at: atIso }));
  return today.frase_del_dia;
}

function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

describe('[004] US-F5 — Frase del día', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    // Rareza del arnés: el reloj se fija ANTES de sembrar.
    vi.setSystemTime(new Date(MON_10H));
    await harness.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('US-F5-AS1 · frases.json trae 50 frases; create_many las carga y devuelve { creadas: 50, omitidas: 0 }', async () => {
    expect(FRASES_JSON).toHaveLength(50);
    expect(await readQuotes()).toEqual([]);

    const res = dataOf(await createMany(FRASES_JSON));
    expect(res).toEqual({ creadas: 50, omitidas: 0 });

    const frases = await readQuotes();
    expect(frases).toHaveLength(50);
    expect(frases.every((f) => f.active === true)).toBe(true);
    // Ids deterministas y orden estable por id.
    for (const f of frases) expect(f.id).toBe(expectedId(f.text));
    expect(frases.map((f) => f.id)).toEqual([...frases.map((f) => f.id)].sort());
    expect(frases.find((f) => f.text === 'Fortes fortuna adiuvat')).toMatchObject({
      translation: 'La suerte sonríe a los valientes.',
      source: 'Terencio, Formión',
    });
  });

  it('US-F5-AS1 · repetir la misma carga es idempotente: { creadas: 0, omitidas: 50 } y siguen 50 filas', async () => {
    expect(dataOf(await createMany(FRASES_JSON))).toEqual({ creadas: 50, omitidas: 0 });
    expect(dataOf(await createMany(FRASES_JSON))).toEqual({ creadas: 0, omitidas: 50 });
    expect(await readQuotes()).toHaveLength(50);
  });

  it('US-F5-AS1 · una variante con otras mayúsculas o espacios en los extremos se omite; solo entra la nueva', async () => {
    dataOf(await createMany(FRASES_JSON));

    const res = dataOf(
      await createMany([
        { text: '  FORTES FORTUNA ADIUVAT  ', translation: 'otra traducción' },
        { text: 'a bonis ad meliora' },
        { text: 'Veni, vidi, vici', translation: 'Vine, vi, vencí.', source: 'Julio César' },
      ])
    );
    expect(res).toEqual({ creadas: 1, omitidas: 2 });

    const frases = await readQuotes();
    expect(frases).toHaveLength(51);
    // La existente conserva su texto y su traducción originales: omitir no sobrescribe.
    expect(frases.find((f) => f.id === expectedId('Fortes fortuna adiuvat'))).toMatchObject({
      text: 'Fortes fortuna adiuvat',
      translation: 'La suerte sonríe a los valientes.',
    });
  });

  it('US-F5-AS1 · un lote con dos frases iguales entre sí (salvo mayúsculas) crea una y omite la otra', async () => {
    const res = dataOf(await createMany([{ text: 'Carpe diem' }, { text: ' CARPE DIEM ' }, { text: 'Festina lente' }]));
    expect(res).toEqual({ creadas: 2, omitidas: 1 });
    expect(await readQuotes()).toHaveLength(2);
  });

  it('US-F5-AS1 · create individual de una frase existente devuelve la existente sin duplicar; una nueva se crea activa', async () => {
    dataOf(await createMany(FRASES_JSON));
    const existing = (await readQuotes()).find((f) => f.text === 'Carpe diem');

    const again = dataOf(await handleManageQuotes('create', { text: ' carpe DIEM ', translation: 'otra' }));
    expect(again.id).toBe(existing.id);
    expect(again.text).toBe('Carpe diem');
    expect(again.translation).toBe('Aprovecha el día.');
    expect(await readQuotes()).toHaveLength(50);

    const created = dataOf(
      await handleManageQuotes('create', { text: 'Ad astra per aspera', translation: 'Hacia las estrellas.', source: 'Lema' })
    );
    expect(created).toMatchObject({
      id: expectedId('Ad astra per aspera'),
      text: 'Ad astra per aspera',
      translation: 'Hacia las estrellas.',
      source: 'Lema',
      active: true,
    });
    expect(await readQuotes()).toHaveLength(51);

    // Traducción y fuente son opcionales.
    const bare = dataOf(await handleManageQuotes('create', { text: 'Sola' }));
    expect(bare.translation).toBeNull();
    expect(bare.source).toBeNull();
  });

  it('US-F5-AS1 · update cambia traducción, fuente y texto sin cambiar el id; un id inexistente es NO_ENCONTRADO', async () => {
    const created = dataOf(await handleManageQuotes('create', { text: 'Fortes fortuna adiuvat', translation: 'a', source: 'b' }));

    const updated = dataOf(
      await handleManageQuotes('update', {
        id: created.id,
        text: 'Audaces fortuna iuvat',
        translation: 'La fortuna ayuda a los audaces.',
      })
    );
    expect(updated.id).toBe(created.id);
    expect(updated.text).toBe('Audaces fortuna iuvat');
    expect(updated.translation).toBe('La fortuna ayuda a los audaces.');
    expect(updated.source).toBe('b'); // lo no enviado no se toca
    expect(updated.active).toBe(true);

    const frases = await readQuotes();
    expect(frases).toHaveLength(1);
    expect(frases[0]).toMatchObject({ id: created.id, text: 'Audaces fortuna iuvat' });

    expectError(await handleManageQuotes('update', { id: 'frase-no-existe', translation: 'x' }), 'NO_ENCONTRADO');
    expectError(await handleManageQuotes('update', { id: created.id, text: '   ' }), 'DATOS_INVALIDOS');
    expectError(await handleManageQuotes('update', { text: 'sin id' }), 'DATOS_INVALIDOS');
  });

  it('US-F5-AS2 · un lote con una frase sin texto, con texto de 301, traducción de 301 o fuente de 121 se rechaza entero y no escribe nada', async () => {
    const buenas = [{ text: 'Carpe diem' }, { text: 'Festina lente', translation: 'Apresúrate despacio.' }];
    const invalidas: Array<[string, unknown]> = [
      ['sin texto', { translation: 'solo traducción' }],
      ['texto vacío', { text: '' }],
      ['texto en blanco', { text: '   ' }],
      ['texto de 301', { text: 'a'.repeat(301) }],
      ['traducción de 301', { text: 'Valida', translation: 'b'.repeat(301) }],
      ['fuente de 121', { text: 'Valida', source: 'c'.repeat(121) }],
      ['clave desconocida', { text: 'Valida', autor: 'x' }],
    ];

    for (const [caso, mala] of invalidas) {
      // La mala va al final: las buenas que la preceden NO deben quedar escritas (todo o nada).
      const res = await createMany([...buenas, mala]);
      expectError(res, 'DATOS_INVALIDOS');
      expect(await readQuotes({ include_inactive: true }), caso).toEqual([]);
    }

    // Lote vacío y lote de más de 200: también DATOS_INVALIDOS.
    expectError(await createMany([]), 'DATOS_INVALIDOS');
    expectError(
      await createMany(Array.from({ length: 201 }, (_, i) => ({ text: `Frase número ${i}` }))),
      'DATOS_INVALIDOS'
    );
    expectError(await handleManageQuotes('create_many', {}), 'DATOS_INVALIDOS');
    expect(await readQuotes({ include_inactive: true })).toEqual([]);

    // Control: justo en el límite (300 / 300 / 120) sí entra, y las buenas después del rechazo también.
    const limite = dataOf(
      await createMany([
        { text: 'a'.repeat(300), translation: 'b'.repeat(300), source: 'c'.repeat(120) },
        ...buenas,
      ])
    );
    expect(limite).toEqual({ creadas: 3, omitidas: 0 });
    expect(await readQuotes()).toHaveLength(3);
  });

  it('US-F5-AS2 · create individual con texto vacío, de 301, traducción de 301 o fuente de 121 es DATOS_INVALIDOS', async () => {
    expectError(await handleManageQuotes('create', { text: '' }), 'DATOS_INVALIDOS');
    expectError(await handleManageQuotes('create', { text: 'a'.repeat(301) }), 'DATOS_INVALIDOS');
    expectError(await handleManageQuotes('create', { text: 'Valida', translation: 'b'.repeat(301) }), 'DATOS_INVALIDOS');
    expectError(await handleManageQuotes('create', { text: 'Valida', source: 'c'.repeat(121) }), 'DATOS_INVALIDOS');
    expectError(await handleManageQuotes('create'), 'DATOS_INVALIDOS');
    expectError(await handleManageQuotes('borrar' as any, { id: 'x' }), 'DATOS_INVALIDOS');
    expect(await readQuotes({ include_inactive: true })).toEqual([]);
  });

  it('US-F5-AS3 · get_today devuelve la misma frase el mismo día, otra al día siguiente y las N en N días', async () => {
    dataOf(await createMany(FRASES_JSON));

    const hoy1 = await fraseDelDia(MON_10H);
    const hoy2 = await fraseDelDia('2026-09-14T22:30:00.000Z'); // mismo día local, otra hora
    expect(hoy1).toMatchObject({ text: expect.any(String) });
    expect(hoy2).toEqual(hoy1);
    expect(Object.keys(hoy1).sort()).toEqual(['source', 'text', 'translation']);

    expect(await fraseDelDia(addDaysIso(MON_10H, 1))).not.toEqual(hoy1);

    const vistas = new Set<string>();
    for (let i = 0; i < 50; i++) vistas.add((await fraseDelDia(addDaysIso(MON_10H, i))).text);
    expect(vistas.size).toBe(50);
  });

  it('US-F5-AS4 · sin frases get_today.frase_del_dia es null; con todas desactivadas también', async () => {
    const vacio = dataOf(await handleGetToday({ at: MON_10H }));
    expect(vacio.frase_del_dia).toBeNull();

    const a = dataOf(await handleManageQuotes('create', { text: 'Carpe diem' }));
    dataOf(await handleManageQuotes('deactivate', { id: a.id }));
    const inactivas = dataOf(await handleGetToday({ at: MON_10H }));
    expect(inactivas.frase_del_dia).toBeNull();
  });

  it('US-F5-AS5 · deactivate saca la frase de la rotación: en N − 1 días no aparece y read la oculta salvo include_inactive', async () => {
    dataOf(await createMany(FRASES_JSON));
    const frases = await readQuotes();
    const quitada = frases[7];

    const res = dataOf(await handleManageQuotes('deactivate', { id: quitada.id }));
    expect(res).toMatchObject({ id: quitada.id, active: false });

    // Idempotente: desactivar dos veces no es un error.
    expect(dataOf(await handleManageQuotes('deactivate', { id: quitada.id })).active).toBe(false);
    expectError(await handleManageQuotes('deactivate', { id: 'frase-no-existe' }), 'NO_ENCONTRADO');

    expect(await readQuotes()).toHaveLength(49);
    expect(await readQuotes({ include_inactive: true })).toHaveLength(50);

    const vistas = new Set<string>();
    for (let i = 0; i < 49; i++) vistas.add((await fraseDelDia(addDaysIso(MON_10H, i))).text);
    expect(vistas.size).toBe(49);
    expect(vistas.has(quitada.text)).toBe(false);

    // Reactivarla con update la devuelve a la rotación.
    dataOf(await handleManageQuotes('update', { id: quitada.id, active: true }));
    expect(await readQuotes()).toHaveLength(50);
  });

  describe('US-F5-AS6 — la web no puede crear ni modificar frases', () => {
    async function post(body: unknown): Promise<{ status: number; json: any }> {
      const response = await POST(new Request('http://localhost/api/execution', { method: 'POST', body: JSON.stringify(body) }));
      return { status: response.status, json: await response.json() };
    }

    it('US-F5-AS6 · POST /api/execution con manage_quotes create, create_many, update y deactivate se rechaza con 400 y no escribe nada', async () => {
      const existing = dataOf(await handleManageQuotes('create', { text: 'Carpe diem' }));

      const attempts: Array<[string, unknown]> = [
        ['create', { text: 'Desde la web' }],
        ['create_many', { frases: [{ text: 'Desde la web 1' }, { text: 'Desde la web 2' }] }],
        ['update', { id: existing.id, translation: 'cambiada desde la web' }],
        ['deactivate', { id: existing.id }],
        ['read', {}],
      ];
      for (const [action, data] of attempts) {
        const res = await post({ tool: 'manage_quotes', action, data });
        expect(res.status, action).toBe(400);
        expect(res.json.status).toBe('error');
        expect(res.json.code).toBe('DATOS_INVALIDOS');
      }

      // Nada cambió: una frase, activa, con su traducción original.
      const frases = await readQuotes({ include_inactive: true });
      expect(frases).toHaveLength(1);
      expect(frases[0]).toMatchObject({ id: existing.id, active: true, translation: null });
    });
  });
});
