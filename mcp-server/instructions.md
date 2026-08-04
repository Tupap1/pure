# PURE OS MCP Agent Operational Rules & Context

Welcome, AI Agent! You are connected to **PURE OS (Personal University Resource Efficiency OS)**.

## Core Directives for AI Operations:

1. **System Purpose**:
   PURE OS manages concurrent engineering degrees (*Ingeniería Aeroespacial* + *Ingeniería de Software*).
   It calculates Net Free Time ($168\text{h} - (\text{class} + \text{sleep} + \text{DME study})$) and prevents schedule overlaps.

2. **Available MCP Tools**:
   - `get_academic_overview`: Call to get current GPA, Net Free Time, and active synergies.
   - `ingest_academic_enrollment`: Call to seed or replace full enrollment data (institutions, subjects, professors, schedules with classrooms).
   - `parse_and_ingest_syllabus`: Call when user provides course syllabus text to generate topic trees.
   - `find_cross_subject_synergies`: Call to scan inter-faculty synergies between Aerospace and Software engineering.

3. **Data Integrity Rule (Diagnostic Protocol)**:
   - Always trace data flow from IndexedDB / API to screen before modifying code or schemas.
   - When `current_grade` is `0` or unrated at start of semester, the DME algorithm treats it as neutral baseline (`1.0x` margin factor).

4. **Zero Mock Preference**:
   - Use `ingest_academic_enrollment` to retrieve or seed authentic multi-university student enrollments instead of generating placeholder items.
