// Siembra los datos base del Módulo de Ejecución llamando a las herramientas MCP,
// que es la única vía permitida para escribir datos (CLAUDE.md, Constitución I).
// Uso: node scripts/seed-execution.mjs
import 'dotenv/config';

const URL_MCP = `http://localhost:${process.env.MCP_PORT || 3001}/mcp`;
const TOKEN = (process.env.MCP_API_KEY || '').trim();

let id = 0;

async function call(name, args) {
  const res = await fetch(URL_MCP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++id,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const texto = await res.text();
  // El transporte puede responder como SSE: se toma la última línea `data:`.
  const linea = texto.includes('data:')
    ? texto.split('\n').filter((l) => l.startsWith('data:')).pop().slice(5)
    : texto;
  let json;
  try {
    json = JSON.parse(linea);
  } catch {
    return { status: 'error', message: `respuesta no JSON (${res.status}): ${texto.slice(0, 200)}` };
  }
  const contenido = json.result?.content?.[0]?.text;
  if (!contenido) return json.error ?? json;
  try {
    return JSON.parse(contenido);
  } catch {
    return { status: 'success', message: contenido.slice(0, 300) };
  }
}

function linea(etiqueta, r) {
  const ok = r?.status === 'success';
  const detalle = ok ? r.message || '' : `${r?.code || ''} ${r?.message || JSON.stringify(r).slice(0, 160)}`;
  console.log(`${ok ? 'OK  ' : 'ERR '} ${etiqueta}: ${detalle}`.trim());
  return ok;
}

const main = async () => {
  // 1. Programa de 10 semanas desde el lunes 14 de septiembre de 2026.
  linea(
    'programa',
    await call('manage_program', {
      action: 'init',
      data: {
        starts_on: '2026-09-14',
        weeks: [1, 3, 6, 8, 8, 8, 8, 8, 8, 8].map((min_tandas_dia, i) => ({
          min_tandas_dia,
          phase: i === 0 ? 'arranque' : i < 4 ? 'consolidacion' : 'automatizacion',
        })),
      },
    })
  );

  // 2. Hábitos. El gimnasio arranca dos semanas después, cuando ya hay rutina.
  for (const h of [
    { id: 'levantada_0600', label: 'Levantarse a las 6:00', started_on: '2026-09-14' },
    { id: 'celular_afuera', label: 'Celular fuera del cuarto', started_on: '2026-09-14' },
  ]) {
    linea(`hábito ${h.id}`, await call('manage_program', { action: 'upsert_habit', data: h }));
  }

  // 3. Destinatario del reporte: Andres mismo.
  linea(
    'destinatario del reporte',
    await call('manage_weekly_report', {
      action: 'set_partner',
      data: {
        name: 'Andrés',
        email: 'andresdavidcantillo@gmail.com',
        consented_at: new Date().toISOString(),
      },
    })
  );

  // 4. Estado resultante.
  const hoy = await call('get_today', {});
  console.log('\nget_today:', JSON.stringify(hoy?.data ?? hoy, null, 2).slice(0, 700));
};

main().catch((e) => {
  console.error('fallo:', e.message);
  process.exit(1);
});
