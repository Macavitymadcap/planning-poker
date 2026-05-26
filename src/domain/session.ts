import { type FibonacciCard, fibonacciCards, isFibonacciCard, type VoteCard } from "./cards";

export interface Session {
  code: string;
  createdAt: Date;
  currentRound: number;
  revealed: boolean;
}

export interface Round {
  sessionCode: string;
  round: number;
  ticketLabel: string | null;
  createdAt: Date;
}

export interface Participant {
  id: string;
  sessionCode: string;
  displayName: string;
  isHost: boolean;
  lastSeenAt: Date;
}

export interface Vote {
  sessionCode: string;
  round: number;
  participantId: string;
  card: VoteCard;
}

export interface ParticipantVote {
  participant: Participant;
  vote: Vote | null;
}

export interface SessionState {
  currentRound: Round;
  history: RoundHistoryItem[];
  session: Session;
  participants: ParticipantVote[];
}

export interface RoundHistoryItem {
  round: Round;
  stats: VoteStats | null;
}

export interface VoteStats {
  average: number;
  median: number;
  nearest: FibonacciCard[];
  numericVotes: FibonacciCard[];
}

export const participantHasVoted = ({ vote }: ParticipantVote) => vote !== null;

export const hasConsensus = (state: SessionState) => {
  if (!state.session.revealed || state.participants.length === 0) return false;
  if (!state.participants.every(participantHasVoted)) return false;

  const cards = state.participants.map(({ vote }) => vote?.card);
  if (!cards.every(isFibonacciCard)) return false;

  const [firstCard] = cards;
  return cards.every((card) => card === firstCard);
};

export const getConsensusCard = (state: SessionState) => {
  if (!hasConsensus(state)) return null;
  return state.participants[0]?.vote?.card ?? null;
};

export const calculateVoteStats = (cards: VoteCard[]) => {
  const numericVotes = cards.filter(isFibonacciCard).sort((left, right) => left - right);
  if (numericVotes.length === 0) return null;

  const average =
    numericVotes.reduce<number>((total, card) => total + card, 0) / numericVotes.length;
  const median = medianOfSortedVotes(numericVotes);

  return {
    average,
    median,
    nearest: nearestFibonacciCards(average),
    numericVotes,
  };
};

const nearestFibonacciCards = (value: number): FibonacciCard[] => {
  let lower: FibonacciCard = 0;
  let upper: FibonacciCard = 21;

  for (const card of fibonacciCards) {
    if (card <= value) lower = card;
    if (card >= value) {
      upper = card;
      break;
    }
  }

  if (lower === upper) return [lower];

  const midpoint = (lower + upper) / 2;
  const midpointTolerance = (upper - lower) * 0.1;
  if (Math.abs(value - midpoint) <= midpointTolerance) return [lower, upper];

  return value < midpoint ? [lower] : [upper];
};

const medianOfSortedVotes = (numericVotes: FibonacciCard[]) => {
  const middle = Math.floor(numericVotes.length / 2);
  const right = numericVotes[middle] ?? 0;
  if (numericVotes.length % 2 === 1) return right;

  const left = numericVotes[middle - 1] ?? right;
  return (left + right) / 2;
};
