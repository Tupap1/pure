import { fetchRecentTranscripts, FirefliesSentence, FirefliesTranscript } from './fireflies';
import { ScheduleEntity, SubjectEntity, ClassSessionEntity } from '@/lib/db/dexie-schema';

export interface SyncResult {
  newSessions: ClassSessionEntity[];
  matched: number;
  unmatched: number;
}

// El timestamp de Fireflies viene en UTC. Hay que interpretarlo en la zona horaria
// del estudiante (Colombia por defecto), NO en la del servidor: en Docker el proceso
// corre en UTC y una clase de las 09:00 quedaría comparada como si fueran las 14:00,
// desfase de 5h que rompe el match. Configurable con PURE_TZ.
function parseISO8601Date(isoString: string): { dayOfWeek: number; hour: number; minute: number } {
  const timeZone = process.env.PURE_TZ || 'America/Bogota';
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const wd = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  if (hour === 24) hour = 0; // algunos entornos devuelven '24' a medianoche
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { dayOfWeek: map[wd] ?? 1, hour, minute };
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

// La transcripción completa se persiste en PURE (no solo el resumen) para que
// sobreviva cuando Fireflies purgue la grabación al llegar a su tope de almacenamiento.
function buildTranscriptText(sentences?: FirefliesSentence[]): string | null {
  if (!sentences || sentences.length === 0) return null;
  return sentences
    .map(s => `${s.speaker_name ? s.speaker_name + ': ' : ''}${s.text}`)
    .join('\n');
}

function findMatchingSchedule(
  transcript: FirefliesTranscript,
  schedules: ScheduleEntity[]
): ScheduleEntity | null {
  const { dayOfWeek, hour, minute } = parseISO8601Date(transcript.date);
  const t = hour * 60 + minute;

  // Match por VENTANA de clase: la grabación pega si empieza dentro del bloque
  // (con 30 min de gracia antes y 15 después), y entre las que califican gana la
  // de inicio más cercano. Así una grabación que arranca a mitad de clase también entra.
  let best: ScheduleEntity | null = null;
  let bestDiff = Infinity;

  for (const schedule of schedules) {
    if (schedule.day_of_week !== dayOfWeek) continue;

    const start = timeToMinutes(schedule.start_time);
    const end = timeToMinutes(schedule.end_time);
    const withinWindow = t >= start - 30 && t <= end + 15;
    if (!withinWindow) continue;

    const diff = Math.abs(t - start);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = schedule;
    }
  }

  return best;
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

    // Ignorar grabaciones basura: silenciosas o de duración casi nula (< 1 min).
    if (!transcript.duration || transcript.duration < 1) {
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
      transcript_text: buildTranscriptText(transcript.sentences),
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
