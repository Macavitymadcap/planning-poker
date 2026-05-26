export const fibonacciCards = [0, 1, 2, 3, 5, 8, 13, 21] as const;
export type FibonacciCard = (typeof fibonacciCards)[number];
export type VoteCard = FibonacciCard | "unknown";

export const unknownCard = "unknown" as const;

export const isFibonacciCard = (value: unknown): value is FibonacciCard =>
  typeof value === "number" && fibonacciCards.includes(value as FibonacciCard);

export const parseVoteCard = (value: FormDataEntryValue | null): VoteCard | null => {
  if (value === null) return null;
  const rawValue = String(value);
  if (rawValue === unknownCard) return unknownCard;

  const numericValue = Number(rawValue);
  return isFibonacciCard(numericValue) ? numericValue : null;
};

export const cardLabel = (card: VoteCard) => (card === unknownCard ? "I don't know" : String(card));
