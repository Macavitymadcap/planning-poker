import { describe, expect, test } from "bun:test";
import { parseVoteCard } from "./cards";
import { hasConsensus, type Participant, type SessionState } from "./session";

const participant = (id: string): Participant => ({
  displayName: `Person ${id}`,
  id,
  isHost: id === "a",
  lastSeenAt: new Date("2026-05-26T10:00:00Z"),
  sessionCode: "ABC123",
});

const state = (cards: Array<0 | 1 | 2 | 3 | 5 | 8 | 13 | 21 | "unknown" | null>): SessionState => ({
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
