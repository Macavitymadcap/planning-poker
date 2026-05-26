import { describe, expect, test } from "bun:test";
import { parseVoteCard } from "./cards";
import { calculateVoteStats, hasConsensus, type Participant, type SessionState } from "./session";

const participant = (id: string): Participant => ({
  displayName: `Person ${id}`,
  id,
  isHost: id === "a",
  lastSeenAt: new Date("2026-05-26T10:00:00Z"),
  sessionCode: "ABC123",
});

const state = (cards: Array<0 | 1 | 2 | 3 | 5 | 8 | 13 | 21 | "unknown" | null>): SessionState => ({
  currentRound: {
    createdAt: new Date("2026-05-26T10:00:00Z"),
    round: 1,
    sessionCode: "ABC123",
    ticketLabel: "PP-123",
  },
  history: [],
  participants: cards.map((card, index) => {
    const id = String.fromCharCode(97 + index);
    return {
      participant: participant(id),
      vote:
        card === null
          ? null
          : {
              card,
              participantId: id,
              round: 1,
              sessionCode: "ABC123",
            },
    };
  }),
  session: {
    code: "ABC123",
    createdAt: new Date("2026-05-26T10:00:00Z"),
    currentRound: 1,
    revealed: true,
  },
});

describe("planning poker cards", () => {
  test("accepts fibonacci cards up to 21", () => {
    expect(parseVoteCard("21")).toBe(21);
    expect(parseVoteCard("34")).toBeNull();
  });

  test("accepts the unknown card", () => {
    expect(parseVoteCard("unknown")).toBe("unknown");
  });
});

describe("consensus", () => {
  test("matches when all revealed numeric cards are equal", () => {
    expect(hasConsensus(state([5, 5, 5]))).toBe(true);
  });

  test("does not match when a participant has not voted", () => {
    expect(hasConsensus(state([5, null, 5]))).toBe(false);
  });

  test("does not match when unknown is present", () => {
    expect(hasConsensus(state([5, "unknown", 5]))).toBe(false);
  });

  test("does not match before reveal", () => {
    const hiddenState = state([3, 3]);
    hiddenState.session.revealed = false;
    expect(hasConsensus(hiddenState)).toBe(false);
  });
});

describe("vote stats", () => {
  test("calculates average, median, and nearest fibonacci from numeric votes", () => {
    expect(calculateVoteStats([3, 5, 8])).toEqual({
      average: 5.333333333333333,
      median: 5,
      nearest: [5],
      numericVotes: [3, 5, 8],
    });
  });

  test("suggests both fibonacci cards near the midpoint", () => {
    expect(calculateVoteStats([5, 8])?.nearest).toEqual([5, 8]);
  });

  test("ignores unknown cards in numeric stats", () => {
    expect(calculateVoteStats([5, "unknown", 8])?.numericVotes).toEqual([5, 8]);
  });
});
