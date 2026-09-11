---

description: "Task list template for feature implementation — override de PURE OS (TDD obligatorio)"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: MANDATORY. Lo exige el Principio II de la Constitución de PURE OS (Test-First, NO
NEGOCIABLE). Cada escenario de aceptación no manual `USn-ASm` de spec.md se convierte en un test
nombrado por su ID. Cada historia empieza con sus tareas de test (RED), que DEBEN fallar por la
razón esperada antes de la tarea de implementación correspondiente (GREEN). Ninguna tarea de
implementación va sin su tarea de test previa.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- La descripción empieza con el tipo de tarea:
  - `TEST`: escribir tests en rojo;
  - `IMPL`: implementación hasta verde;
  - `VERIFY`: verificación empírica (Principio IV);
  - `MANUAL`: paso que hace una persona.

## Path Conventions (PURE OS)

- Dominio puro y algoritmos: `lib/domain/`, `lib/algorithms/`
- Servicios y handlers compartidos por la web y el MCP: `lib/<módulo>/` (por ejemplo, `lib/execution/`)
- Repositorios Postgres: `lib/db/`; validación Zod: `lib/validations/schemas.ts`
- Migraciones: `db/migrations/NNN_nombre.sql`. Deben correr en pg-mem (Principio III)
- Servidor MCP: `mcp-server/index.ts` (`TOOLS_LIST` + registro de la tool) y `mcp-server/tools-handler.ts`
- Web: `app/` (páginas y `app/api/`), `components/`, `lib/hooks/`
- Tests: `__tests__/`, espejando el árbol de fuentes (`domain/`, `algorithms/`, `mcp/`, `api/`, `db/`, `build/`, `validations/`)
  - Las pruebas contra la base usan `createTestDb()` de `__tests__/helpers/test-db.ts`.
  - El tiempo se controla con `vi.setSystemTime`.

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Acceptance scenarios USn-ASm from spec.md (one test per non-manual scenario)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints and MCP tools from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  Every story phase MUST list its TEST tasks before its IMPL tasks.

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Crear la rama `NNN-nombre` y confirmar `npm run test:all` en verde como línea base
- [ ] T002 [P] Agregar dependencias nuevas en package.json
- [ ] T003 [P] Declarar variables nuevas en .env.example y docker-compose.yml (sin secretos)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on the feature):

- [ ] T004 TEST Test de trazabilidad spec ↔ tests en __tests__/build/spec-traceability.test.ts, más placeholders `it.todo('USn-ASm · …')` para cada escenario no manual en su archivo de test
- [ ] T005 TEST La migración nueva corre en pg-mem y el `reset()` del arnés la limpia, en __tests__/db/[name]-schema.test.ts
- [ ] T006 IMPL Migración db/migrations/NNN_[name].sql + tablas nuevas en `reset()` de __tests__/helpers/test-db.ts (hijas primero)
- [ ] T007 [P] TEST Esquemas Zod de la feature en __tests__/validations/[name]-schemas.test.ts
- [ ] T008 IMPL Esquemas Zod en lib/validations/schemas.ts
- [ ] T009 IMPL Repositorio en lib/db/[name]-pg.ts y handlers compartidos en lib/[módulo]/handlers.ts, re-exportados en mcp-server/tools-handler.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (MANDATORY — RED antes de implementar) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**
> Convertir los `it.todo` de la historia en tests reales nombrados por su ID de escenario.
> Correr `npx vitest run <archivo>` y confirmar que fallan por la razón esperada.
> Commit en la rama: `test(NNN): US1 escenarios en rojo`.

- [ ] T010 [P] [US1] TEST US1-AS1…US1-ASn (herramientas MCP / servicios) en __tests__/mcp/[name].test.ts
- [ ] T011 [P] [US1] TEST Modelo de vista (lógica de UI como función pura) en __tests__/domain/[name]-view.test.ts

### Implementation for User Story 1

- [ ] T012 [US1] IMPL Reglas de dominio en lib/domain/[name].ts
- [ ] T013 [US1] IMPL Servicio y handler en lib/[módulo]/[name].ts + registro de la tool en mcp-server/index.ts
- [ ] T014 [US1] IMPL Ruta API en app/api/[módulo]/route.ts (try/catch, lista blanca)
- [ ] T015 [US1] IMPL Componente en components/[...].tsx sobre el modelo de vista ya en verde
- [ ] T016 [US1] VERIFY quickstart de US1: /health del MCP y llamadas a las tools; UI en navegador a 375 px y escritorio, sin errores de consola

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (MANDATORY — RED antes de implementar) ⚠️

- [ ] T017 [P] [US2] TEST US2-AS1…US2-ASn en __tests__/[area]/[name].test.ts

### Implementation for User Story 2

- [ ] T018 [US2] IMPL [Service/feature] en lib/[...]
- [ ] T019 [US2] IMPL Integración con los componentes de US1 (si aplica)
- [ ] T020 [US2] VERIFY quickstart de US2

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (MANDATORY — RED antes de implementar) ⚠️

- [ ] T021 [P] [US3] TEST US3-AS1…US3-ASn en __tests__/[area]/[name].test.ts

### Implementation for User Story 3

- [ ] T022 [US3] IMPL [Service/feature] en lib/[...]
- [ ] T023 [US3] VERIFY quickstart de US3

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern: TEST before IMPL, then VERIFY]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentación: mcp-server/instructions.md, mcp-server/README.md, CLAUDE.md, docs/README.md
- [ ] TXXX Limpieza y refactor, con los tests en verde
- [ ] TXXX [P] Tests de regresión adicionales en __tests__/
- [ ] TXXX Endurecimiento de seguridad (Principio VI)
- [ ] TXXX VERIFY quickstart.md completo + `npm run test:all` + `/speckit-converge`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Principio II): TEST → IMPL → VERIFY
- Models before services
- Services before endpoints
- La lógica de UI va como función pura en verde antes del componente
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "TEST US1-AS1…US1-ASn in __tests__/mcp/[name].test.ts"
Task: "TEST view model in __tests__/domain/[name]-view.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (RED por la razón esperada, no por un import roto)
- Commits en la rama:
  - uno RED (`test(NNN): …`) y uno GREEN (`feat(NNN): …`) por historia;
  - en español, sin trailer `Co-Authored-By`;
  - `main` solo recibe la rama con `npm run test:all` en verde.
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
