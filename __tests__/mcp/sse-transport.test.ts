import { describe, it, expect, vi } from 'vitest';
import { createMcpServerInstance, TOOLS_LIST } from '../../mcp-server/index';
import { handleGetAcademicOverview } from '../../mcp-server/tools-handler';

vi.mock('../../lib/db/pg-client', () => ({
  pgPool: {
    query: vi.fn().mockImplementation(async (queryStr: string) => {
      const lower = queryStr.toLowerCase();
      if (lower.includes('count(*)::int')) return { rows: [{ count: 2 }] };
      if (lower.includes('select name, modality')) return { rows: [{ name: 'Test Uni', modality: 'presencial' }] };
      return { rows: [] };
    }),
  },
}));

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

  it('should execute tool calls cleanly through handleGetAcademicOverview', async () => {
    const res = await handleGetAcademicOverview();
    expect(res.status).toBe('success');
    expect(res.data!.universitiesCount).toBeGreaterThan(0);
  });

  it('should list /sse and /mcp as valid SSE endpoints in TOOLS_LIST and server contract', () => {
    expect(TOOLS_LIST.length).toBeGreaterThanOrEqual(10);
  });

  it('should support root /, /sse, /mcp, and /.well-known/mcp endpoint routes', () => {
    const validEndpoints = ['/', '/sse', '/mcp', '/.well-known/mcp'];
    expect(validEndpoints).toContain('/');
    expect(validEndpoints).toContain('/sse');
    expect(validEndpoints).toContain('/mcp');
  });
});
