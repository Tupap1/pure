# Mandatory Rule: Exclusively Use MCP Server Tools for Application Data Handling

> **CRITICAL RULE**: 
> Whenever reading, processing, ingesting, or populating application data (universities, enrolled subjects, professors, weekly schedules, syllabus, deliverables, and DME metrics), you MUST EXCLUSIVELY use the **MCP Server (`mcp-server`) tools and tool handlers** (`ingest_academic_enrollment`, `get_academic_overview`, `parse_and_ingest_syllabus`, `find_cross_subject_synergies`).
> 
> - NEVER hardcode raw static seed arrays directly into frontend components or DB helper files without calling the MCP tool handler pipeline.
> - ALL new subjects, universities (such as UdeA and UdeC), and schedule variations (such as Sábados A/B) MUST be defined within and served through the MCP server tools.
