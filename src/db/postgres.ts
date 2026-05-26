import pg from "pg";
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

const { Pool } = pg;

type SessionRow = {
  code: string;
  created_at: Date | string;
  current_round: number;
  revealed: boolean;
};

type ParticipantRow = {
  id: string;
  session_code: string;
  display_name: string;
  is_host: boolean;
  last_seen_at: Date | string;
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
  created_at: Date | string;
};

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

const toSession = (row: SessionRow): Session => ({
  code: row.code,
  createdAt: toDate(row.created_at),
  currentRound: row.current_round,
  revealed: row.revealed,
});

const toParticipant = (row: ParticipantRow): Participant => ({
  displayName: row.display_name,
  id: row.id,
  isHost: row.is_host,
  lastSeenAt: toDate(row.last_seen_at),
  sessionCode: row.session_code,
});

const toVote = (row: VoteRow): Vote => ({
  card: row.card === "unknown" ? "unknown" : (Number(row.card) as VoteCard),
  participantId: row.participant_id,
  round: row.round,
  sessionCode: row.session_code,
});

const toRound = (row: RoundRow): Round => ({
  createdAt: toDate(row.created_at),
  round: row.round,
  sessionCode: row.session_code,
  ticketLabel: row.ticket_label,
});

export class PostgresPlanningPokerRepository implements PlanningPokerRepository {
  readonly #pool: pg.Pool;

  constructor(connectionString: string) {
    this.#pool = new Pool({ connectionString });
  }

  async close() {
    await this.#pool.end();
  }

  async migrate() {
    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        code TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL,
        current_round INTEGER NOT NULL,
        revealed BOOLEAN NOT NULL
      );

      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        session_code TEXT NOT NULL REFERENCES sessions(code) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        is_host BOOLEAN NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL
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
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (session_code, round)
      );

      INSERT INTO rounds (session_code, round, ticket_label, created_at)
      SELECT code, current_round, NULL, created_at FROM sessions
      ON CONFLICT (session_code, round) DO NOTHING;
    `);
  }

  async createSession(input: {
    code: string;
    hostDisplayName: string;
    hostId: string;
    ticketLabel?: string | null;
  }) {
    const client = await this.#pool.connect();
    try {
      const now = new Date();
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO sessions (code, created_at, current_round, revealed) VALUES ($1, $2, 1, false)",
        [input.code, now],
      );
      await client.query(
        `INSERT INTO participants (id, session_code, display_name, is_host, last_seen_at)
         VALUES ($1, $2, $3, true, $4)`,
        [input.hostId, input.code, input.hostDisplayName, now],
      );
      await client.query(
        `INSERT INTO rounds (session_code, round, ticket_label, created_at)
         VALUES ($1, 1, $2, $3)`,
        [input.code, input.ticketLabel ?? null, now],
      );
      await client.query("COMMIT");
      return {
        host: {
          displayName: input.hostDisplayName,
          id: input.hostId,
          isHost: true,
          lastSeenAt: now,
          sessionCode: input.code,
        },
        session: {
          code: input.code,
          createdAt: now,
          currentRound: 1,
          revealed: false,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findParticipant(sessionCode: string, participantId: string) {
    const result = await this.#pool.query<ParticipantRow>(
      "SELECT * FROM participants WHERE session_code = $1 AND id = $2",
      [sessionCode, participantId],
    );
    return result.rows[0] ? toParticipant(result.rows[0]) : null;
  }

  async getState(sessionCode: string): Promise<SessionState | null> {
    const sessionResult = await this.#pool.query<SessionRow>(
      "SELECT * FROM sessions WHERE code = $1",
      [sessionCode],
    );
    const sessionRow = sessionResult.rows[0];
    if (!sessionRow) return null;

    const session = toSession(sessionRow);
    const currentRoundResult = await this.#pool.query<RoundRow>(
      "SELECT * FROM rounds WHERE session_code = $1 AND round = $2",
      [sessionCode, session.currentRound],
    );
    const currentRound = toRound(
      currentRoundResult.rows[0] ?? {
        created_at: sessionRow.created_at,
        round: session.currentRound,
        session_code: session.code,
        ticket_label: null,
      },
    );
    const participantsResult = await this.#pool.query<ParticipantRow>(
      "SELECT * FROM participants WHERE session_code = $1 ORDER BY is_host DESC, display_name ASC",
      [sessionCode],
    );
    const votesResult = await this.#pool.query<VoteRow>(
      "SELECT * FROM votes WHERE session_code = $1 AND round = $2",
      [sessionCode, session.currentRound],
    );
    const votes = votesResult.rows.map(toVote);
    const history = await this.#history(sessionCode, session.currentRound);

    return {
      currentRound,
      history,
      participants: participantsResult.rows.map((row) => {
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

    const now = new Date();
    await this.#pool.query(
      `INSERT INTO participants (id, session_code, display_name, is_host, last_seen_at)
       VALUES ($1, $2, $3, false, $4)`,
      [input.participantId, input.sessionCode, input.displayName, now],
    );

    return {
      displayName: input.displayName,
      id: input.participantId,
      isHost: false,
      lastSeenAt: now,
      sessionCode: input.sessionCode,
    };
  }

  async recordVote(input: { card: VoteCard; participantId: string; sessionCode: string }) {
    const state = await this.getState(input.sessionCode);
    const participant = state?.participants.find(
      ({ participant }) => participant.id === input.participantId,
    );
    if (!state || !participant || state.session.revealed) return false;

    await this.#pool.query(
      `INSERT INTO votes (session_code, round, participant_id, card)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(session_code, round, participant_id)
       DO UPDATE SET card = excluded.card`,
      [input.sessionCode, state.session.currentRound, input.participantId, String(input.card)],
    );
    return true;
  }

  async reveal(sessionCode: string, participantId: string) {
    const participant = await this.findParticipant(sessionCode, participantId);
    if (!participant?.isHost) return false;

    await this.#pool.query("UPDATE sessions SET revealed = true WHERE code = $1", [sessionCode]);
    return true;
  }

  async resetRound(input: { sessionCode: string; ticketLabel?: string | null }) {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<SessionRow>(
        `UPDATE sessions
         SET current_round = current_round + 1, revealed = false
         WHERE code = $1
         RETURNING *`,
        [input.sessionCode],
      );
      const session = result.rows[0];
      if (!session) {
        await client.query("ROLLBACK");
        return false;
      }

      await client.query(
        `INSERT INTO rounds (session_code, round, ticket_label, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_code, round)
         DO UPDATE SET ticket_label = excluded.ticket_label`,
        [input.sessionCode, session.current_round, input.ticketLabel ?? null, new Date()],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async #history(sessionCode: string, currentRound: number): Promise<RoundHistoryItem[]> {
    const roundsResult = await this.#pool.query<RoundRow>(
      `SELECT * FROM rounds
       WHERE session_code = $1 AND round < $2
       ORDER BY round DESC`,
      [sessionCode, currentRound],
    );

    const history: RoundHistoryItem[] = [];
    for (const round of roundsResult.rows.map(toRound)) {
      const votesResult = await this.#pool.query<VoteRow>(
        "SELECT * FROM votes WHERE session_code = $1 AND round = $2",
        [sessionCode, round.round],
      );
      const votes = votesResult.rows.map(toVote);
      history.push({
        round,
        stats: calculateVoteStats(votes.map((vote) => vote.card)),
      });
    }

    return history;
  }
}
