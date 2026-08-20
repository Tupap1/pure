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
      console.error('GraphQL errors:', data.errors);
      return null;
    }

    return data.data;
  } catch (error) {
    console.error('Fireflies API request failed:', error);
    return null;
  }
}

export async function fetchRecentTranscripts(since?: Date): Promise<FirefliesTranscript[]> {
  const query = `
    query GetTranscripts($startDate: String) {
      transcripts(start_date: $startDate) {
        id
        title
        date
        duration
        video_url
        audio_url
        summary {
          overview
          short_summary
          keywords
          action_items
          topics
        }
        sentences {
          speaker_name
          text
          start_time
          end_time
          ai_filters {
            task
            question
          }
        }
      }
    }
  `;

  const variables = since ? { startDate: since.toISOString() } : {};
  const data = await makeGraphQLRequest(query, variables);

  if (!data || !data.transcripts) {
    return [];
  }

  return data.transcripts.map((t: any) => ({
    id: t.id,
    title: t.title,
    date: t.date,
    duration: t.duration || 0,
    video_url: t.video_url,
    audio_url: t.audio_url,
    summary: t.summary ? {
      overview: t.summary.overview || '',
      short_summary: t.summary.short_summary || '',
      keywords: t.summary.keywords || [],
      action_items: t.summary.action_items || [],
      topics: t.summary.topics || [],
    } : undefined,
    sentences: t.sentences || [],
  }));
}

export async function fetchTranscriptById(id: string): Promise<FirefliesTranscript | null> {
  const query = `
    query GetTranscript($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        video_url
        audio_url
        summary {
          overview
          short_summary
          keywords
          action_items
          topics
        }
        sentences {
          speaker_name
          text
          start_time
          end_time
          ai_filters {
            task
            question
          }
        }
      }
    }
  `;

  const data = await makeGraphQLRequest(query, { id });

  if (!data || !data.transcript) {
    return null;
  }

  const t = data.transcript;
  return {
    id: t.id,
    title: t.title,
    date: t.date,
    duration: t.duration || 0,
    video_url: t.video_url,
    audio_url: t.audio_url,
    summary: t.summary ? {
      overview: t.summary.overview || '',
      short_summary: t.summary.short_summary || '',
      keywords: t.summary.keywords || [],
      action_items: t.summary.action_items || [],
      topics: t.summary.topics || [],
    } : undefined,
    sentences: t.sentences || [],
  };
}
