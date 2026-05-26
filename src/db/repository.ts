import type { Participant, Session, SessionState, Vote } from "../domain/session";

export interface PlanningPokerRepository {
  close(): Promise<void>;
  createSession(input: {
    code: string;
    hostDisplayName: string;
    hostId: string;
    ticketLabel?: string | null;
  }): Promise<{ host: Participant; session: Session }>;
  findParticipant(sessionCode: string, participantId: string): Promise<Participant | null>;
  getState(sessionCode: string): Promise<SessionState | null>;
  joinSession(input: {
    displayName: string;
    participantId: string;
    sessionCode: string;
  }): Promise<Participant | null>;
  migrate(): Promise<void>;
  recordVote(input: {
    card: Vote["card"];
    participantId: string;
    sessionCode: string;
  }): Promise<boolean>;
  resetRound(input: { sessionCode: string; ticketLabel?: string | null }): Promise<boolean>;
  reveal(sessionCode: string, participantId: string): Promise<boolean>;
}

export const createSessionCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((value) => value.toString(36).padStart(2, "0"))
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();

export const createParticipantId = () => crypto.randomUUID();
