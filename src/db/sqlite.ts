import { Database } from "bun:sqlite";
import type { VoteCard } from "../domain/cards";
import {
  calculateVoteStats,
  type Participant,
  type Round,
  type RoundHistoryItem,
  type Session,
  type SessionState,
  type Vote,
} from "../domain/session";
import type { PlanningPokerRepository } from "./repository";

type SessionRow = {
  code: string;
  created_at: string;
  current_round: number;
  revealed: number;
};

type ParticipantRow = {
  id: string;
  session_code: string;
  display_name: string;
  is_host: number;
  last_seen_at: string;
};

type VoteRow = {
  session_code: string;
  round: number;
  participant_id: string;
  card: string;
};

type RoundRow = {
  session_code: string;
  round: number;
  ticket_label: string | null;
  created_at: string;
};

const toSession = (row: SessionRow): Session => ({
  code: row.code,
  createdAt: new Date(row.created_at),
  currentRound: row.current_round,
  revealed: row.revealed === 1,
});

const toParticipant = (row: ParticipantRow): Participant => ({
  displayName: row.display_name,
  id: row.id,
  isHost: row.is_host === 1,
  lastSeenAt: new Date(row.last_seen_at),
  sessionCode: row.session_code,
});

const toVote = (row: VoteRow): Vote => ({
  card: row.card === "unknown" ? "unknown" : (Number(row.card) as VoteCard),
  participantId: row.participant_id,
  round: row.round,
  sessionCode: row.session_code,
});

const toRound = (row: RoundRow): Round => ({
  createdAt: new Date(row.created_at),
  round: row.round,
  sessionCode: row.session_code,
  ticketLabel: row.ticket_label,
});

export class SqlitePlanningPokerRepository implements PlanningPokerRepository {
  readonly #database: Database;

  constructor(filename: string) {
    this.#database = new Database(filename);
    this.#database.exec("PRAGMA foreign_keys = ON");
  }

  async close() {
    this.#database.close();
  }

  async migrate() {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        code TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        current_round INTEGER NOT NULL,
        revealed INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        session_code TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        is_host INTEGER NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS votes (
        session_code TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
        round INTEGER NOT NULL,
        participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        card TEXT NOT NULL,
        PRIMARY KEY (session_code, round, participant_id)
      );

      CREATE TABLE IF NOT EXISTS rounds (
        session_code TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
        round INTEGER NOT NULL,
        ticket_label TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (session_code, round)
      );

      INSERT OR IGNORE INTO rounds (session_code, round, ticket_label, created_at)
      SELECT code, current_round, NULL, created_at FROM sessions;
    `);
  }

  async createSession(input: {
    code: string;
    hostDisplayName: string;
    hostId: string;
    ticketLabel?: string | null;
  }) {
    const now = new Date().toISOString();
    const transaction = this.#database.transaction(() => {
      this.#database
        .query(
          "INSERT INTO sessions (code, created_at, current_round, revealed) VALUES (?, ?, 1, 0)",
        )
        .run(input.code, now);
      this.#database
        .query(
          `INSERT INTO participants (id, session_code, display_name, is_host, last_seen_at)
           VALUES (?, ?, ?, 1, ?)`,
        )
        .run(input.hostId, input.code, input.hostDisplayName, now);
      this.#database
        .query(
          `INSERT INTO rounds (session_code, round, ticket_label, created_at)
           VALUES (?, 1, ?, ?)`,
        )
        .run(input.code, input.ticketLabel ?? null, now);
    });
    transaction();

    return {
      host: {
        displayName: input.hostDisplayName,
        id: input.hostId,
        isHost: true,
        lastSeenAt: new Date(now),
        sessionCode: input.code,
      },
      session: {
        code: input.code,
        createdAt: new Date(now),
        currentRound: 1,
        revealed: false,
      },
    };
  }

  async findParticipant(sessionCode: string, participantId: string) {
    const row = this.#database
      .query<ParticipantRow, [string, string]>(
        "SELECT * FROM participants WHERE session_code = ? AND id = ?",
      )
      .get(sessionCode, participantId);
    return row ? toParticipant(row) : null;
  }

  async getState(sessionCode: string): Promise<SessionState | null> {
    const sessionRow = this.#database
      .query<SessionRow, [string]>("SELECT * FROM sessions WHERE code = ?")
      .get(sessionCode);
    if (!sessionRow) return null;

    const session = toSession(sessionRow);
    const currentRoundRow = this.#database
      .query<RoundRow, [string, number]>(
        "SELECT * FROM rounds WHERE session_code = ? AND round = ?",
      )
      .get(sessionCode, session.currentRound);
    const currentRound =
      currentRoundRow ??
      ({
        created_at: sessionRow.created_at,
        round: session.currentRound,
        session_code: session.code,
        ticket_label: null,
      } satisfies RoundRow);
    const participants = this.#database
      .query<ParticipantRow, [string]>(
        "SELECT * FROM participants WHERE session_code = ? ORDER BY is_host DESC, display_name ASC",
      )
      .all(sessionCode);
    const votes = this.#database
      .query<VoteRow, [string, number]>("SELECT * FROM votes WHERE session_code = ? AND round = ?")
      .all(sessionCode, session.currentRound)
      .map(toVote);
    const history = this.#history(sessionCode, session.currentRound);

    return {
      currentRound: toRound(currentRound),
      history,
      participants: participants.map((row) => {
        const participant = toParticipant(row);
        return {
          participant,
          vote: votes.find((vote) => vote.participantId === participant.id) ?? null,
        };
      }),
      session,
    };
  }

  async joinSession(input: { displayName: string; participantId: string; sessionCode: string }) {
    const state = await this.getState(input.sessionCode);
    if (!state) return null;

    const now = new Date().toISOString();
    this.#database
      .query(
        `INSERT INTO participants (id, session_code, display_name, is_host, last_seen_at)
         VALUES (?, ?, ?, 0, ?)`,
      )
      .run(input.participantId, input.sessionCode, input.displayName, now);

    return {
      displayName: input.displayName,
      id: input.participantId,
      isHost: false,
      lastSeenAt: new Date(now),
      sessionCode: input.sessionCode,
    };
  }

  async recordVote(input: { card: VoteCard; participantId: string; sessionCode: string }) {
    const state = await this.getState(input.sessionCode);
    const participant = state?.participants.find(
      ({ participant }) => participant.id === input.participantId,
    );
    if (!state || !participant || state.session.revealed) return false;

    this.#database
      .query(
        `INSERT INTO votes (session_code, round, participant_id, card)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(session_code, round, participant_id)
         DO UPDATE SET card = excluded.card`,
      )
      .run(input.sessionCode, state.session.currentRound, input.participantId, String(input.card));
    return true;
  }

  async reveal(sessionCode: string, participantId: string) {
    const participant = await this.findParticipant(sessionCode, participantId);
    if (!participant?.isHost) return false;

    this.#database.query("UPDATE sessions SET revealed = 1 WHERE code = ?").run(sessionCode);
    return true;
  }

  async resetRound(input: { sessionCode: string; ticketLabel?: string | null }) {
    const now = new Date().toISOString();
    const transaction = this.#database.transaction(() => {
      const result = this.#database
        .query("UPDATE sessions SET current_round = current_round + 1, revealed = 0 WHERE code = ?")
        .run(input.sessionCode);
      if (result.changes === 0) return false;

      const session = this.#database
        .query<SessionRow, [string]>("SELECT * FROM sessions WHERE code = ?")
        .get(input.sessionCode);
      if (!session) return false;

      this.#database
        .query(
          `INSERT OR REPLACE INTO rounds (session_code, round, ticket_label, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(input.sessionCode, session.current_round, input.ticketLabel ?? null, now);
      return true;
    });
    return transaction();
  }

  #history(sessionCode: string, currentRound: number): RoundHistoryItem[] {
    return this.#database
      .query<RoundRow, [string, number]>(
        `SELECT * FROM rounds
         WHERE session_code = ? AND round < ?
         ORDER BY round DESC`,
      )
      .all(sessionCode, currentRound)
      .map((roundRow) => {
        const votes = this.#database
          .query<VoteRow, [string, number]>(
            "SELECT * FROM votes WHERE session_code = ? AND round = ?",
          )
          .all(sessionCode, roundRow.round)
          .map(toVote);

        return {
          round: toRound(roundRow),
          stats: calculateVoteStats(votes.map((vote) => vote.card)),
        };
      });
  }
}
