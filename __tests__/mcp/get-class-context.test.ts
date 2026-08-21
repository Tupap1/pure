import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleGetClassContext } from '../../mcp-server/tools-handler';

describe('handleGetClassContext - Retrieves class session context with syllabus topics', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  it('should return full session context when session_id is provided', async () => {
    // Seed: university, subject, class_session, syllabus_topics
    const uniId = 'uni-context-' + Date.now();
    const subjectId = 'sub-context-' + Date.now();
    const sessionId = 'session-context-' + Date.now();
    const topic1Id = 'topic-1-' + Date.now();
    const topic2Id = 'topic-2-' + Date.now();

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

    // Insert class session with transcript, summary, topics_covered, action_items, questions
    const transcriptText = 'Prof: hola\nAna: chau';
    const aiSummary = 'Resumen X';
    const topicsCovered = ['tema1', 'tema2'];
    const aiActionItems = ['item1', 'item2'];
    const aiQuestions = ['¿Q1?', '¿Q2?'];

    await harness.pool.query(
      `INSERT INTO class_sessions (id, subject_id, schedule_id, session_date, title, summary, ai_summary, recording_url, topics_covered, notes, transcript_text, ai_action_items, ai_questions, duration_minutes, session_source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
      [
        sessionId,
        subjectId,
        null,
        '2026-08-20T10:00:00Z',
        'Test Session',
        'Session summary',
        aiSummary,
        null,
        topicsCovered,
        null,
        transcriptText,
        aiActionItems,
        aiQuestions,
        60,
        'manual',
      ]
    );

    // Insert two syllabus topics for this subject
    await harness.pool.query(
      'INSERT INTO syllabus_topics (id, subject_id, title, mastery_status, order_index) VALUES ($1, $2, $3, $4, $5)',
      [topic1Id, subjectId, 'Topic 1', 'no_iniciado', 0]
    );

    await harness.pool.query(
      'INSERT INTO syllabus_topics (id, subject_id, title, mastery_status, order_index) VALUES ($1, $2, $3, $4, $5)',
      [topic2Id, subjectId, 'Topic 2', 'en_estudio', 1]
    );

    // Call handler with session_id
    const res = await handleGetClassContext({ session_id: sessionId });

    // Verify success
    expect(res.status).toBe('success');
    expect(res.data).toBeDefined();
    expect(res.data!.id).toBe(sessionId);
    expect(res.data!.title).toBe('Test Session');
    expect(res.data!.session_date).toBe('2026-08-20T10:00:00.000Z');

    // Verify subject info
    expect(res.data!.subject).toBeDefined();
    expect(res.data!.subject!.id).toBe(subjectId);
    expect(res.data!.subject!.name).toBe('Test Subject');

    // Verify transcript
    expect(res.data!.transcript_text).toBe(transcriptText);
    expect(res.data!.transcript_available).toBe(true);

    // Verify summary and topics
    expect(res.data!.summary).toBe(aiSummary);
    expect(res.data!.topics).toEqual(topicsCovered);
    expect(res.data!.action_items).toEqual(aiActionItems);
    expect(res.data!.questions).toEqual(aiQuestions);

    // Verify related syllabus topics
    expect(res.data!.related_syllabus_topics).toBeDefined();
    expect(res.data!.related_syllabus_topics!.length).toBe(2);
    expect(res.data!.related_syllabus_topics![0]).toHaveProperty('id');
    expect(res.data!.related_syllabus_topics![0]).toHaveProperty('title');
    expect(res.data!.related_syllabus_topics![0]).toHaveProperty('mastery_status');
  });

  it('should return error when session_id does not exist', async () => {
    const res = await handleGetClassContext({ session_id: 'nope' });
    expect(res.status).toBe('error');
    expect(res.message).toContain('Sesión de clase no encontrada');
  });

  it('should return error when neither session_id nor subject_id is provided', async () => {
    const res = await handleGetClassContext({});
    expect(res.status).toBe('error');
    expect(res.message).toContain('Debe indicar session_id o subject_id');
  });

  it('should fetch most recent session when subject_id is provided without session_id', async () => {
    const uniId = 'uni-subject-' + Date.now();
    const subjectId = 'sub-subject-' + Date.now();
    const sessionId1 = 'session-old-' + Date.now();
    const sessionId2 = 'session-recent-' + Date.now();

    // Insert university and subject
    await harness.pool.query(
      'INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade) VALUES ($1, $2, $3, $4, $5, $6)',
      [uniId, 'Test University', 'presencial', 0.0, 5.0, 3.0]
    );

    await harness.pool.query(
      'INSERT INTO subjects (id, university_id, name, code, credits, difficulty, modality, target_grade, current_grade) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [subjectId, uniId, 'Test Subject', 'TST-002', 3, 3, 'presencial', 4.5, 0.0]
    );

    // Insert older session
    await harness.pool.query(
      `INSERT INTO class_sessions (id, subject_id, schedule_id, session_date, title, summary, recording_url, topics_covered, notes, transcript_text, session_source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [sessionId1, subjectId, null, '2026-08-18T10:00:00Z', 'Old Session', null, null, [], null, null, 'manual']
    );

    // Insert recent session
    await harness.pool.query(
      `INSERT INTO class_sessions (id, subject_id, schedule_id, session_date, title, summary, recording_url, topics_covered, notes, transcript_text, session_source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [sessionId2, subjectId, null, '2026-08-20T15:00:00Z', 'Recent Session', null, null, [], null, null, 'manual']
    );

    // Call handler with subject_id
    const res = await handleGetClassContext({ subject_id: subjectId });

    // Verify it returns the most recent session
    expect(res.status).toBe('success');
    expect(res.data!.id).toBe(sessionId2);
    expect(res.data!.title).toBe('Recent Session');
  });

  it('should handle session without transcript gracefully', async () => {
    const uniId = 'uni-no-trans-' + Date.now();
    const subjectId = 'sub-no-trans-' + Date.now();
    const sessionId = 'session-no-trans-' + Date.now();

    await harness.pool.query(
      'INSERT INTO universities (id, name, modality, scale_min, scale_max, passing_grade) VALUES ($1, $2, $3, $4, $5, $6)',
      [uniId, 'Test University', 'presencial', 0.0, 5.0, 3.0]
    );

    await harness.pool.query(
      'INSERT INTO subjects (id, university_id, name, code, credits, difficulty, modality, target_grade, current_grade) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [subjectId, uniId, 'Test Subject', 'TST-003', 3, 3, 'presencial', 4.5, 0.0]
    );

    // Insert session without transcript_text
    await harness.pool.query(
      `INSERT INTO class_sessions (id, subject_id, schedule_id, session_date, title, summary, recording_url, topics_covered, notes, transcript_text, session_source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [sessionId, subjectId, null, '2026-08-20T12:00:00Z', 'Session No Transcript', null, null, [], null, null, 'manual']
    );

    const res = await handleGetClassContext({ session_id: sessionId });

    expect(res.status).toBe('success');
    expect(res.data!.transcript_text).toBeNull();
    expect(res.data!.transcript_available).toBe(false);
  });
});
