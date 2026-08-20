import { fetchRecentTranscripts, FirefliesSentence, FirefliesTranscript } from './fireflies';
import { ScheduleEntity, SubjectEntity, ClassSessionEntity } from '@/lib/db/dexie-schema';

export interface SyncResult {
  newSessions: ClassSessionEntity[];
  matched: number;
  unmatched: number;
}

function parseISO8601Date(isoString: string): { dayOfWeek: number; hour: number; minute: number } {
  const date = new Date(isoString);
  // ISO: Monday=1, Sunday=7; JavaScript: Sunday=0, Monday=1
  const jsDay = date.getDay();
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;
  const hour = date.getHours();
  const minute = date.getMinutes();
  return { dayOfWeek, hour, minute };
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function extractQuestions(sentences?: FirefliesSentence[]): string[] {
  if (!sentences) return [];
  return sentences
    .filter(s => s.ai_filters?.question)
    .map(s => s.ai_filters!.question!)
    .filter(Boolean);
}

function findMatchingSchedule(
  transcript: FirefliesTranscript,
  schedules: ScheduleEntity[]
): ScheduleEntity | null {
  const { dayOfWeek, hour, minute } = parseISO8601Date(transcript.date);
  const transcriptTimeMinutes = hour * 60 + minute;

  for (const schedule of schedules) {
    if (schedule.day_of_week !== dayOfWeek) continue;

    const scheduleTimeMinutes = timeToMinutes(schedule.start_time);
    const timeDiff = Math.abs(transcriptTimeMinutes - scheduleTimeMinutes);

    // ±30 minute tolerance
    if (timeDiff <= 30) {
      return schedule;
    }
  }

  return null;
}

export async function syncFirefliesTranscripts(
  apiKey: string,
  schedules: ScheduleEntity[],
  subjects: SubjectEntity[],
  existingSessions: ClassSessionEntity[]
): Promise<SyncResult> {
  const newSessions: ClassSessionEntity[] = [];
  let matched = 0;
  let unmatched = 0;

  // Fetch transcripts from Fireflies
  const transcripts = await fetchRecentTranscripts();

  // Create a set of existing fireflies IDs for fast lookup
  const existingFirefliesIds = new Set(
    existingSessions
      .filter(s => s.fireflies_transcript_id)
      .map(s => s.fireflies_transcript_id)
  );

  for (const transcript of transcripts) {
    // Skip if already synced
    if (existingFirefliesIds.has(transcript.id)) {
      unmatched++;
      continue;
    }

    // Find matching schedule
    const matchedSchedule = findMatchingSchedule(transcript, schedules);

    if (!matchedSchedule) {
      unmatched++;
      continue;
    }

    // Create ClassSessionEntity
    const session: ClassSessionEntity = {
      id: `session-fireflies-${transcript.id}`,
      subject_id: matchedSchedule.subject_id,
      schedule_id: matchedSchedule.id,
      session_date: transcript.date,
      title: transcript.title,
      summary: transcript.summary?.overview || null,
      notion_link: null,
      recording_url: transcript.video_url || null,
      topics_covered: transcript.summary?.keywords || [],
      notes: null,
      fireflies_transcript_id: transcript.id,
      transcript_text: null,
      ai_summary: transcript.summary?.overview || null,
      ai_action_items: transcript.summary?.action_items || [],
      ai_questions: extractQuestions(transcript.sentences),
      duration_minutes: transcript.duration,
      session_source: 'fireflies',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    newSessions.push(session);
    matched++;
  }

  return {
    newSessions,
    matched,
    unmatched,
  };
}
