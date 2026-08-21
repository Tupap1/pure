import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { fetchAllDataFromDb, fetchClassSessionTranscriptFromDb } from '../../lib/db/repository-pg';

describe('Class Session Transcript On-Demand Access', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  it('should exclude transcript_text from fetchAllDataFromDb() bulk pull', async () => {
    // Seed database with minimal required data
    const uniId = 'uni-test-' + Date.now();
    const subjectId = 'sub-test-' + Date.now();
    const sessionId = 'session-test-' + Date.now();

    // Insert university
    await harness.pool.query(
      'INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade) VALUES ($1, $2, $3, $4, $5, $6)',
      [uniId, 'Test University', 'presencial', 0.0, 5.0, 3.0]
    );

    // Insert subject
    await harness.pool.query(
      'INSERT INTO subjects (id, university_id, name, code, credits, difficulty, modality, target_grade, current_grade) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [subjectId, uniId, 'Test Subject', 'TST-001', 3, 3, 'presencial', 4.5, 0.0]
    );

    // Insert class session with non-empty transcript_text
    const transcriptContent = 'Prof: Buenos días estudiantes\nAna: Hola profesor\nCarlos: ¿Cuándo es el parcial?';
    await harness.pool.query(
      `INSERT INTO class_sessions (id, subject_id, schedule_id, session_date, title, summary, notion_link, recording_url, topics_covered, notes, transcript_text, session_source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [sessionId, subjectId, null, '2026-08-20T10:00:00Z', 'Lecture 1', 'Introduction', null, null, '{}', null, transcriptContent, 'manual']
    );

    // Fetch all data
    const data = await fetchAllDataFromDb();

    // Verify session is in the result
    expect(data.classSessions).toBeDefined();
    expect(data.classSessions.length).toBeGreaterThan(0);

    const session = data.classSessions.find((s: any) => s.id === sessionId);
    expect(session).toBeDefined();

    // Verify transcript_text is NOT in the returned object
    expect(session).not.toHaveProperty('transcript_text');
  });

  it('should return transcript_text via fetchClassSessionTranscriptFromDb when it exists', async () => {
    // Seed database
    const uniId = 'uni-trans-' + Date.now();
    const subjectId = 'sub-trans-' + Date.now();
    const sessionId = 'session-trans-' + Date.now();

    await harness.pool.query(
      'INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade) VALUES ($1, $2, $3, $4, $5, $6)',
      [uniId, 'Test University', 'presencial', 0.0, 5.0, 3.0]
    );

    await harness.pool.query(
      'INSERT INTO subjects (id, university_id, name, code, credits, difficulty, modality, target_grade, current_grade) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [subjectId, uniId, 'Test Subject', 'TST-002', 3, 3, 'presencial', 4.5, 0.0]
    );

    const transcriptContent = 'Prof: hola\nAna: chau';
    await harness.pool.query(
      `INSERT INTO class_sessions (id, subject_id, schedule_id, session_date, title, summary, notion_link, recording_url, topics_covered, notes, transcript_text, session_source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [sessionId, subjectId, null, '2026-08-20T11:00:00Z', 'Lecture 2', null, null, null, '{}', null, transcriptContent, 'manual']
    );

    // Fetch transcript
    const result = await fetchClassSessionTranscriptFromDb(sessionId);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('transcript_text');
    expect(result?.transcript_text).toBe(transcriptContent);
  });

  it('should return null for non-existent session ID', async () => {
    const result = await fetchClassSessionTranscriptFromDb('does-not-exist-id-' + Date.now());
    expect(result).toBeNull();
  });
});
