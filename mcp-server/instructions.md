# PURE OS MCP Agent Operational Rules & Context

Welcome, AI Agent! You are connected to **PURE OS (Personal University Resource Efficiency OS)**.

## Core Directives for AI Operations:

1. **System Purpose**:
   PURE OS manages concurrent engineering degrees (*Ingeniería Aeroespacial* + *Ingeniería de Software*).
   It calculates Net Free Time ($168\text{h} - (\text{class} + \text{sleep} + \text{DME study})$) and prevents schedule overlaps.

2. **Available MCP Tools**:
   - `get_academic_overview`: Call to get current GPA, Net Free Time, and active synergies.
   - `ingest_academic_enrollment`: Call to seed or update enrollment data. Pass `raw_text` as a JSON string with arrays `universities`, `professors`, `subjects`, and `schedules` (using `day_of_week`: 1=Lunes..7=Domingo and optional `periodicity`: 'semanal' | 'sabado_a' | 'sabado_b'). Minimal example: `{"universities":[{"id":"u1","name":"UdeA"}],"professors":[{"id":"p1","university_id":"u1","name":"Dr. Curie"}],"subjects":[{"id":"s1","university_id":"u1","professor_id":"p1","name":"Cálculo"}],"schedules":[{"id":"sch1","subject_id":"s1","day_of_week":6,"start_time":"08:00","end_time":"10:00","classroom":"2-209","periodicity":"sabado_a"}]}`.
   - `parse_and_ingest_syllabus`: Call when user provides course syllabus text to generate topic trees.
   - `find_cross_subject_synergies`: Call to scan inter-faculty synergies between Aerospace and Software engineering.

3. **Data Integrity Rule (Diagnostic Protocol)**:
   - Always trace data flow from IndexedDB / API to screen before modifying code or schemas.
   - When `current_grade` is `0` or unrated at start of semester, the DME algorithm treats it as neutral baseline (`1.0x` margin factor).

4. **Zero Mock Preference**:
   - Use `ingest_academic_enrollment` to retrieve or seed authentic multi-university student enrollments instead of generating placeholder items.

5. **Execution Module Rules** (Módulo de Ejecución — US1–US9):
   - **Days of the week** go from 1 (Monday) to 7 (Sunday), never 0–6.
   - **Only one active trigger per moment**: `get_today` returns a single trigger (`trigger: { ... } | null`), never a list. The trigger that matches first wins, based on anchor time and a 240-minute window.
   - **Triggers have no duration, batch count, or method**: a trigger contains only the signal (`cue_text`, `anchor_time`) and the action (`action_text`). Fields like `default_tandas`, `duration`, or `how` are not allowed and trigger `SOBRE_ESPECIFICACION`.
   - **No retroactive task entry**: `manage_tandas:start` accepts no `started_at` from the client. All time comes from the server clock. Auditing past sessions happens through `manage_tandas:read` with date filters, never by inserting backdated rows.
   - **Seed data only via MCP tools**: the program, habits, triggers, tasks, and report recipient are created and updated only through tool handlers (`manage_program`, `manage_routine_slots`, `manage_tasks`, `manage_weekly_report:set_partner`). They are never written directly to SQL, hardcoded in UI, or passed via migrations.
   - **Report data flows through the same schema**: when you call `manage_weekly_report:preview` or `run_tick`, you get the payload for that week. The payload is frozen on Sunday 19:00 and sent once on Sunday 20:00; calling `run_tick` again does not resend and is idempotent.
   - **Plan the week without `program_week_id`**: `plan_week:preview`, `plan_week:set_intentions`, and `manage_routine_slots:rehearse` without an explicit week resolve via `resolvePlanningWeek`: if today is Sunday with a week starting tomorrow, that one; otherwise the week containing today; otherwise the next week that starts; otherwise `NO_ENCONTRADO` (program has no weeks or already finished).
   - **`open_view` accepts `program_week_id`; planning views have no gate**: opening a week that hasn't started yet is a planning view (`surface='planeacion'`), never gated, never counts in plan openings, needs no reason even if already opened. Once a week starts, views are gated: 2 free, 3.ª onward requires reason.
   - **`manage_friction`: Pure registers, the OS executes**: maximum 2 enabled at once (`LIMITE_FRICCION` if trying to enable a 3.ª); weekly irritation rating 0–10; two consecutive weeks with score ≥7 automatically retire the most recently enabled measure without notice; phone friction measures only (`sin_biometria`, `clave_larga`, `escala_grises`, `redes_fuera_home`, `app_desinstalada`); `celular_afuera` is a habit, not a measure.
