import { isFibonacciCard, type VoteCard } from "./cards";

export interface Session {
  code: string;
  createdAt: Date;
  currentRound: number;
  revealed: boolean;
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
  session: Session;
  participants: ParticipantVote[];
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
