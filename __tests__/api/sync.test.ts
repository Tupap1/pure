import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/sync/route';

// Mock DB pool to prevent real queries during unit test execution
vi.mock('@/lib/db/pg-client', () => ({
  pgPool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

describe('POST /api/sync Security & Validation', () => {
  it('should reject unauthorized table names with 400 Bad Request to prevent SQL injection', async () => {
    const maliciousPayload = {
      action: 'delete',
      table: 'universities; DROP TABLE professors; --',
      data: { id: 'test-id' },
    };

    const request = new Request('http://localhost/api/sync', {
      method: 'POST',
      body: JSON.stringify(maliciousPayload),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.status).toBe('error');
    expect(json.message).toContain('Invalid or unauthorized table name');
  });

  it('should allow valid whitelisted tables', async () => {
    const validTables = ['universities', 'professors', 'subjects', 'schedules', 'deliverables', 'syllabus_topics'];

    for (const table of validTables) {
      const validPayload = {
        action: 'delete',
        table,
        data: { id: 'test-1' },
      };

      const request = new Request('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.status).toBe('success');
    }
  });

  it('should reject non-whitelisted tables like users or random strings', async () => {
    const invalidPayload = {
      action: 'delete',
      table: 'users',
      data: { id: 'user-1' },
    };

    const request = new Request('http://localhost/api/sync', {
      method: 'POST',
      body: JSON.stringify(invalidPayload),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.status).toBe('error');
  });
});
