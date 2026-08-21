import { describe, it, expect } from 'vitest';
import { parseTranscript, searchTranscript, TranscriptLine } from '@/lib/domain/class-session';

describe('Transcript Parsing & Search', () => {
  describe('parseTranscript', () => {
    it('should parse speaker:text format correctly', () => {
      const result = parseTranscript('Prof: hola\nAna: chau');
      expect(result).toEqual([
        { speaker: 'Prof', text: 'hola' },
        { speaker: 'Ana', text: 'chau' },
      ]);
    });

    it('should handle lines with no speaker', () => {
      const result = parseTranscript('solo texto');
      expect(result).toEqual([
        { speaker: null, text: 'solo texto' },
      ]);
    });

    it('should not parse timestamps as speakers (start with digit, not letter)', () => {
      const result = parseTranscript('00:12 arranca');
      expect(result).toEqual([
        { speaker: null, text: '00:12 arranca' },
      ]);
    });

    it('should return empty array for empty string', () => {
      const result = parseTranscript('');
      expect(result).toEqual([]);
    });

    it('should return empty array for null', () => {
      const result = parseTranscript(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      const result = parseTranscript(undefined);
      expect(result).toEqual([]);
    });

    it('should skip blank lines', () => {
      const result = parseTranscript('Prof: uno\n\n   \nAna: dos');
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { speaker: 'Prof', text: 'uno' },
        { speaker: 'Ana', text: 'dos' },
      ]);
    });

    it('should trim whitespace from lines', () => {
      const result = parseTranscript('  Prof  :  hello  ');
      expect(result).toEqual([
        { speaker: 'Prof', text: 'hello' },
      ]);
    });

    it('should handle speaker with up to 40 characters (letters & non-colon)', () => {
      const longSpeaker = 'Dr. José María del Carmen';
      const result = parseTranscript(`${longSpeaker}: content`);
      expect(result[0].speaker).toBe(longSpeaker);
      expect(result[0].text).toBe('content');
    });

    it('should not parse as speaker if starting with non-letter character', () => {
      const result = parseTranscript('_speaker: text');
      expect(result).toEqual([
        { speaker: null, text: '_speaker: text' },
      ]);
    });
  });

  describe('searchTranscript', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'Prof', text: 'hola estudiantes' },
      { speaker: 'Ana', text: 'tengo una pregunta' },
      { speaker: 'Prof', text: 'adelante' },
    ];

    it('should return all lines when query is empty', () => {
      const result = searchTranscript(lines, '');
      expect(result).toEqual(lines);
    });

    it('should return all lines when query is only whitespace', () => {
      const result = searchTranscript(lines, '   ');
      expect(result).toEqual(lines);
    });

    it('should find text case-insensitively', () => {
      const result = searchTranscript(lines, 'HOLA');
      expect(result).toEqual([
        { speaker: 'Prof', text: 'hola estudiantes' },
      ]);
    });

    it('should find partial matches', () => {
      const result = searchTranscript(lines, 'stud');
      expect(result).toEqual([
        { speaker: 'Prof', text: 'hola estudiantes' },
      ]);
    });

    it('should return empty array when query matches nothing', () => {
      const result = searchTranscript(lines, 'zzz');
      expect(result).toEqual([]);
    });

    it('should return multiple matching lines', () => {
      const result = searchTranscript(lines, 'a');
      expect(result).toHaveLength(3); // all lines contain 'a'
    });

    it('should return lines in original order', () => {
      const result = searchTranscript(lines, 'a');
      expect(result[0].speaker).toBe('Prof');
      expect(result[1].speaker).toBe('Ana');
      expect(result[2].speaker).toBe('Prof');
    });
  });
});
