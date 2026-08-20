import { FlashcardEntity } from '@/lib/db/dexie-schema';
import { fsrs, createEmptyCard, State } from 'ts-fsrs';
import type { Card, Grade } from 'ts-fsrs';

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

function mapRating(rating: FlashcardRating): Grade {
  const gradeMap: Record<FlashcardRating, number> = {
    'again': 1,
    'hard': 2,
    'good': 3,
    'easy': 4
  };
  return gradeMap[rating] as unknown as Grade;
}

function stateToNumber(state: State): number {
  switch (state) {
    case State.New:
      return 0;
    case State.Learning:
      return 1;
    case State.Review:
      return 2;
    case State.Relearning:
      return 3;
    default:
      return 0;
  }
}

function dateToISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function createFlashcard(
  subjectId: string,
  topicId: string,
  question: string,
  answer: string,
  questionType: 'open' | 'mcq' | 'cloze' | 'true_false',
  options?: string[],
  source: 'ai_generated' | 'manual' | 'from_transcript' = 'manual'
): FlashcardEntity {
  const card = createEmptyCard();
  const now = new Date();

  return {
    subject_id: subjectId,
    topic_id: topicId,
    question,
    answer,
    question_type: questionType,
    options,
    due: dateToISO(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: stateToNumber(card.state),
    source,
    created_at: now.toISOString()
  };
}

export function reviewFlashcard(
  card: FlashcardEntity,
  rating: FlashcardRating
): FlashcardEntity {
  const fsrsCard: Partial<Card> = {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: stateFromNumber(card.state),
    last_review: card.last_review ? new Date(card.last_review) : new Date()
  };

  const scheduler = fsrs();
  const result = scheduler.next(fsrsCard as Card, new Date(), mapRating(rating));

  // Extract the updated card from the result (first element or direct object)
  const updatedCard = Array.isArray(result) ? result[0] : result;

  return {
    ...card,
    due: dateToISO(updatedCard.due),
    stability: updatedCard.stability,
    difficulty: updatedCard.difficulty,
    elapsed_days: updatedCard.elapsed_days,
    scheduled_days: updatedCard.scheduled_days,
    reps: updatedCard.reps,
    lapses: updatedCard.lapses,
    state: stateToNumber(updatedCard.state),
    last_review: new Date().toISOString()
  };
}

function stateFromNumber(state: number): State {
  switch (state) {
    case 0:
      return State.New;
    case 1:
      return State.Learning;
    case 2:
      return State.Review;
    case 3:
      return State.Relearning;
    default:
      return State.New;
  }
}

export function getDueFlashcards(
  cards: FlashcardEntity[],
  date: Date = new Date()
): FlashcardEntity[] {
  const dateStr = dateToISO(date);
  return cards.filter(card => card.due <= dateStr);
}

export function getFlashcardsForSubject(
  cards: FlashcardEntity[],
  subjectId: string
): FlashcardEntity[] {
  return cards.filter(card => card.subject_id === subjectId);
}

export function getFlashcardsForTopic(
  cards: FlashcardEntity[],
  topicId: string
): FlashcardEntity[] {
  return cards.filter(card => card.topic_id === topicId);
}

export function getDailyFlashcardStatistics(
  cards: FlashcardEntity[],
  date: Date = new Date()
): {
  due: number;
  new: number;
  learning: number;
  review: number;
  relearning: number;
} {
  const dateStr = dateToISO(date);
  const dueCards = cards.filter(card => card.due <= dateStr);

  return {
    due: dueCards.length,
    new: dueCards.filter(card => card.state === 0).length,
    learning: dueCards.filter(card => card.state === 1).length,
    review: dueCards.filter(card => card.state === 2).length,
    relearning: dueCards.filter(card => card.state === 3).length
  };
}

export function getEstimatedDailyLoad(
  cards: FlashcardEntity[],
  estimatedMinutesPerCard: number = 2,
  date: Date = new Date()
): number {
  const dueCards = getDueFlashcards(cards, date);
  return dueCards.length * estimatedMinutesPerCard;
}
