/**
 * Represents a single line in a parsed transcript.
 * speaker is null if the line doesn't match the "Speaker: text" format.
 */
export interface TranscriptLine {
  speaker: string | null;
  text: string;
}

/**
 * Parses transcript text into structured transcript lines.
 *
 * Rules:
 * - null/undefined/'' → []
 * - Split by '\n', trim each line, skip empty lines
 * - If a line matches /^([\p{L}][^:]{0,39}):\s+(.+)$/u (speaker MUST start with letter):
 *   → { speaker: trimmed_match[1], text: trimmed_match[2] }
 * - Otherwise → { speaker: null, text: trimmed_line }
 */
export function parseTranscript(text: string | null | undefined): TranscriptLine[] {
  if (!text) {
    return [];
  }

  const lines = text.split('\n');
  const result: TranscriptLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Regex explanation:
    // ^([\p{L}][^:]{0,39}): Speaker must start with a Unicode letter, followed by up to 39 non-colon chars
    // :\s+(.+)$ Followed by colon, whitespace, and the text content
    const speakerMatch = trimmed.match(/^([\p{L}][^:]{0,39}):\s+(.+)$/u);

    if (speakerMatch) {
      result.push({
        speaker: speakerMatch[1].trim(),
        text: speakerMatch[2].trim(),
      });
    } else {
      result.push({
        speaker: null,
        text: trimmed,
      });
    }
  }

  return result;
}

/**
 * Searches transcript lines by text content (case-insensitive).
 *
 * Rules:
 * - If query.trim() === '' → return all lines unchanged
 * - Else → return lines where line.text.toLowerCase().includes(query.trim().toLowerCase())
 */
export function searchTranscript(
  lines: TranscriptLine[],
  query: string
): TranscriptLine[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery === '') {
    return lines;
  }

  const lowerQuery = trimmedQuery.toLowerCase();
  return lines.filter((line) =>
    line.text.toLowerCase().includes(lowerQuery)
  );
}
