export interface FirefliesSummary {
  overview: string;
  short_summary: string;
  keywords: string[];
  action_items: string[];
  topics: string[];
}

export interface FirefliesSentence {
  speaker_name: string;
  text: string;
  start_time: number; // seconds
  end_time: number;   // seconds
  ai_filters?: {
    task?: string;
    question?: string;
  };
}

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string; // ISO datetime
  duration: number; // minutes
  video_url?: string;
  audio_url?: string;
  summary?: FirefliesSummary;
  sentences?: FirefliesSentence[];
}

async function makeGraphQLRequest(query: string, variables?: any): Promise<any> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    console.error('FIREFLIES_API_KEY not set');
    return null;
  }

  try {
    const response = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
    });

    if (!response.ok) {
      console.error(`Fireflies API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.errors) {
      // Fireflies devuelve errores PARCIALES: en el plan Free, campos como audio_url
      // o video_url dan "paid_required" pero el resto de la respuesta (id, título,
      // fecha, resumen, sentences) sí llega. Se loguea el detalle pero NO se descarta
      // la respuesta si trae datos utilizables; antes bastaba un error para retornar [].
      console.error('Fireflies GraphQL errors (parcial, se conserva la data válida):', JSON.stringify(data.errors));
    }

    return data.data ?? null;
  } catch (error) {
    console.error('Fireflies API request failed:', error);
    return null;
  }
}

// Campos alineados con el esquema real de Fireflies y con lo que permite el plan Free.
// audio_url / video_url / transcript_url son SOLO de plan pago ("paid_required") y
// hacían fallar la query, así que NO se piden: en Free no hay captura de video de
// todas formas, y la transcripción se reconstruye desde `sentences`. `dateString` es
// el ISO del meeting; `topics_discussed` es el nombre correcto del campo (no `topics`).
const TRANSCRIPT_FIELDS = `
  id
  title
  dateString
  duration
  summary {
    overview
    short_summary
    keywords
    action_items
    topics_discussed
  }
  sentences {
    speaker_name
    text
    start_time
    end_time
    ai_filters {
      question
    }
  }
`;

function mapTranscript(t: any): FirefliesTranscript {
  const rawActionItems = t.summary?.action_items;
  const actionItems: string[] = Array.isArray(rawActionItems)
    ? rawActionItems
    : typeof rawActionItems === 'string' && rawActionItems.trim()
      ? rawActionItems.split('\n').map((s: string) => s.trim()).filter(Boolean)
      : [];

  return {
    id: t.id,
    title: t.title,
    date: t.dateString || t.date,
    duration: t.duration || 0,
    video_url: t.video_url,
    audio_url: t.audio_url,
    summary: t.summary
      ? {
          overview: t.summary.overview || t.summary.short_summary || '',
          short_summary: t.summary.short_summary || '',
          keywords: t.summary.keywords || [],
          action_items: actionItems,
          topics: t.summary.topics_discussed || [],
        }
      : undefined,
    sentences: t.sentences || [],
  };
}

export async function fetchRecentTranscripts(since?: Date): Promise<FirefliesTranscript[]> {
  // No se filtra por fecha en la query (el argumento/tipo de fecha varía entre
  // versiones del esquema y rompería toda la consulta). Se traen las 50 recientes
  // y el dedup por fireflies_transcript_id evita reimportar. `since` queda como
  // filtro opcional aplicado en memoria.
  const query = `
    query GetTranscripts($limit: Int) {
      transcripts(mine: true, limit: $limit) {
        ${TRANSCRIPT_FIELDS}
      }
    }
  `;

  const data = await makeGraphQLRequest(query, { limit: 50 });

  if (!data || !data.transcripts) {
    return [];
  }

  const list: FirefliesTranscript[] = data.transcripts.map(mapTranscript);
  return since ? list.filter((t) => new Date(t.date).getTime() >= since.getTime()) : list;
}

export async function fetchTranscriptById(id: string): Promise<FirefliesTranscript | null> {
  const query = `
    query GetTranscript($id: String!) {
      transcript(id: $id) {
        ${TRANSCRIPT_FIELDS}
      }
    }
  `;

  const data = await makeGraphQLRequest(query, { id });

  if (!data || !data.transcript) {
    return null;
  }

  return mapTranscript(data.transcript);
}
