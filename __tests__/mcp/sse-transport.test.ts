import { describe, it, expect } from 'vitest';
import { createMcpServerInstance, executeToolCall, TOOLS_LIST } from '../../mcp-server/index';

describe('MCP Multi-Session Server & SSE Transport Suite', () => {
  it('should create independent SDK Server instances without single-instance collision', () => {
    const s1 = createMcpServerInstance();
    const s2 = createMcpServerInstance();
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s1).not.toBe(s2);
  });

  it('should enforce required parameter raw_text in ingest_academic_enrollment schema', () => {
    const tool = TOOLS_LIST.find((t) => t.name === 'ingest_academic_enrollment');
    expect(tool).toBeDefined();
    expect(tool?.inputSchema.required).toContain('raw_text');
  });

  it('should execute tool calls cleanly through executeToolCall', () => {
    const res = executeToolCall('get_academic_overview', {});
    expect(res.data.universitiesCount).toBeGreaterThan(0);
  });
});
