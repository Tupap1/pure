# Quickstart — Validación del Módulo de Ejecución

Guía para comprobar de punta a punta que cada historia funciona (Constitución, Principio IV).
Los detalles de interfaz están en [contracts/](./contracts/) y los del modelo en
[data-model.md](./data-model.md).

## Prerrequisitos

- Node 22, Docker Desktop y el `.env` del proyecto. Además de las variables existentes, lleva:
  - `PURE_TZ`, `EXECUTION_SCHEDULER`, `REPORT_OWNER_NAME`, `PUBLIC_WEB_URL`;
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `REPORT_FROM`;
  - `VAPID_*` (para US7).
- Para US4 y US7: iPhone con iOS ≥ 16.4. Cloudflare Access configurado **antes** de publicar el
  hostname de la web.

## 1. Pruebas automatizadas

```bash
npm run test:all
```

Esperado: typecheck y Vitest en verde, incluido `__tests__/build/spec-traceability.test.ts`: cada
escenario no manual de `spec.md` tiene un test con su ID.

## 2. Stack local

```bash
docker compose up -d pure-db
npm run db:migrate
npm run dev
npm run mcp:start
curl http://localhost:3001/health
```

Esperado: las migraciones `008`–`011` aparecen aplicadas, `/health` responde OK y `tools/list`
(por MCP, con el bearer `MCP_API_KEY`) incluye las herramientas nuevas.

## 3. Validación por historia

| Historia | Pasos | Resultado esperado |
|---|---|---|
| Datos base | Por MCP: `manage_program init` (lunes 2026-09-14, mínimos 1,3,6,8,8,8,8,8,8,8), `manage_program upsert_habit` (`levantada_0600`, `celular_afuera`) y `manage_routine_slots create` (3 disparadores) | Semanas `pw-01…pw-10`, dos hábitos activos y tres disparadores |
| US1 | En el navegador (375×812 y escritorio): abrir Pure, tocar "Empezar tanda", recargar, intentar interrumpir sin razón | Hoy es la primera pantalla; la tanda arranca en un toque; el conteo sobrevive a la recarga; la interrupción exige razón; la barra móvil no tiene Configuración y el engranaje del encabezado la abre |
| US2 | A distintas horas, abrir Hoy; responder el disparador vigente | Siempre un solo disparador (el más reciente ya pasado) que desaparece al responder |
| US3 | Responder los hábitos de hoy; completar la tanda mínima | Las filas Sí/No desaparecen; el pie muestra "1 tanda hoy · Día cumplido"; nunca aparece "te faltan" |
| US4 `[manual]` | En el iPhone: Safari → `PUBLIC_WEB_URL` → Compartir → Agregar a inicio → abrir desde el ícono. Desde otro navegador sin sesión, abrir la URL | Abre a pantalla completa con el ícono de Pure; sin sesión de Access no se ve nada |
| US5 | Por MCP: `get_grade_projection` para Química | 3.33 para aprobar, 5.20 para la meta (inalcanzable), techo 4.34 |
| US6 | Destinatario de prueba: `manage_weekly_report set_partner` con el correo de Andres y `consented_at`. Luego `preview`, forzar el congelamiento (tick con la hora del domingo 19:00 o `send` sobre un reporte congelado) y repetir el tick | Llega **un** correo a Zoho con los números congelados; el segundo tick no reenvía; la web muestra el reporte sin el correo del destinatario |
| US7 | En la PWA: Configuración → Activar notificaciones → Enviar prueba. Empezar una tanda y bloquear el teléfono | Llega la prueba; a los 10:00 (±20 s) llega "Terminó la tanda", una sola vez |
| US8–US9 | Recorrer la planeación del domingo; abrir la vista de semana 3 veces | Materias con intención < 6 sin disparadores sugeridos; la 3.ª apertura pide razón |

## Matriz de pruebas

| Archivo de test | Cubre | Fase |
|---|---|---|
| `__tests__/build/spec-traceability.test.ts` | SC-007 | Foundational |
| `__tests__/domain/execution-time.test.ts` | FR-006, US1-AS7 | Foundational |
| `__tests__/db/execution-schema.test.ts` | Migración 008 en pg-mem, `running_lock` (FR-004), FK SET NULL | Foundational |
| `__tests__/validations/execution-schemas.test.ts` | FR-009 (claves extra), FR-017 (lunes), rangos | Foundational |
| `__tests__/mcp/execution-program.test.ts` | FR-017, FR-040, US3-AS7 | Foundational |
| `__tests__/mcp/execution-tandas.test.ts` | US1-AS1…AS7 | US1 |
| `__tests__/domain/today-view.test.ts` | US1-AS8, US3-AS8 | US1/US3 |
| `__tests__/domain/navigation.test.ts` | US1-AS9 (FR-041) | US1 |
| `__tests__/api/execution-routes.test.ts` | Lista blanca, 400, GET dinámico, US6-AS11 | US1/US6 |
| `__tests__/domain/execution-trigger.test.ts` | US2-AS1…AS5, AS10 | US2 |
| `__tests__/mcp/execution-routine.test.ts` | US2-AS6…AS9 | US2 |
| `__tests__/domain/execution-day.test.ts` | US3-AS1…AS4, AS6 | US3 |
| `__tests__/mcp/execution-checks.test.ts` | US3-AS5 | US3 |
| `__tests__/build/pwa-manifest.test.ts` | US4-AS3 | US4 |
| `__tests__/domain/grade-projection.test.ts` (+ `subject.test.ts`) | US5-AS1…AS5, AS7 | US5 |
| `__tests__/mcp/grade-projection-tool.test.ts` | US5-AS6 | US5 |
| `__tests__/domain/weekly-report.test.ts` | US6-AS5, AS7, AS10 | US6 |
| `__tests__/mcp/weekly-report.test.ts` | US6-AS1…AS4, AS6, AS8, AS9 | US6 |
| `__tests__/api/push-subscribe.test.ts` | US7-AS1 | US7 |
| `__tests__/mcp/execution-push.test.ts` | US7-AS2…AS5 | US7 |
| `__tests__/mcp/execution-planning.test.ts` | US8-AS1…AS5 | US8 |
| `__tests__/mcp/plan-views.test.ts` | US9-AS1…AS3 | US9 |

Los escenarios `[manual]` (US4-AS1 y US4-AS2) se validan en la fila US4 de la tabla anterior.

## 4. Despliegue

```bash
docker compose up -d --build pure-web pure-mcp
docker compose exec pure-mcp npm run db:migrate
```

Esperado: las dos imágenes arriba y las migraciones aplicadas (el contenedor `pure-mcp` no migra
solo). En `pure-mcp`, `EXECUTION_SCHEDULER=on`.

## 5. Cierre

Correr `/speckit-converge` y hacer la auditoría. El resultado es un informe sin trabajo pendiente
fuera de `tasks.md`.
