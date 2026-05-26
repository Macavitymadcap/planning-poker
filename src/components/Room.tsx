import { Badge, Button, Card, HxForm } from "@macavitymadcap/hyper-dank-ui";
import { cardLabel, fibonacciCards, unknownCard, type VoteCard } from "../domain/cards";
import {
  getConsensusCard,
  hasConsensus,
  type Participant,
  type SessionState,
} from "../domain/session";

export interface RoomProps {
  baseUrl: string;
  currentParticipant: Participant;
  state: SessionState;
}

const votedLabel = (hasVoted: boolean) => (hasVoted ? "Voted" : "Waiting");

const ResultCard = ({ card }: { card: VoteCard | null }) => {
  if (card === null) return <span className="mini-card muted">-</span>;
  if (card === unknownCard) {
    return (
      <span className="mini-card unknown" role="img" aria-label="I don't know">
        ?
      </span>
    );
  }
  return <span className="mini-card">{card}</span>;
};

export const RoomDocument = (props: RoomProps) => (
  <main className="room-shell" data-session-code={props.state.session.code}>
    <RoomFragment {...props} />
  </main>
);

export const RoomFragment = ({ baseUrl, currentParticipant, state }: RoomProps) => {
  const shareUrl = `${baseUrl}/sessions/${state.session.code}`;
  const consensus = hasConsensus(state);
  const consensusCard = getConsensusCard(state);

  return (
    <section
      id="session-room"
      className="room-grid"
      data-consensus={consensus ? "true" : "false"}
      data-round={state.session.currentRound}
      data-session-code={state.session.code}
    >
      <Card as="section" className="room-main">
        <div className="room-header">
          <div>
            <p className="eyebrow">Room {state.session.code}</p>
            <h1>Round {state.session.currentRound}</h1>
          </div>
          <Badge tone={state.session.revealed ? "accent" : "neutral"}>
            {state.session.revealed ? "Revealed" : "Voting"}
          </Badge>
        </div>

        <div className="share-row">
          <label>
            Share link
            <input id="share-link" value={shareUrl} readOnly />
          </label>
          <span className="share-copy-action" data-copy-target="share-link">
            <Button
              ariaLabel="Copy share link"
              className="share-copy-button"
              type="button"
              variant="outline"
            >
              Copy
            </Button>
          </span>
        </div>

        {!state.session.revealed ? (
          <div className="vote-panel">
            <h2>Choose your card</h2>
            <fieldset className="card-grid" aria-label="Planning poker cards">
              {fibonacciCards.map((card) => (
                <HxForm
                  action={`/sessions/${state.session.code}/votes`}
                  method="post"
                  className="card-form"
                  {...{
                    "hx-post": `/sessions/${state.session.code}/votes`,
                    "hx-swap": "outerHTML",
                    "hx-target": "#session-room",
                  }}
                  key={card}
                >
                  <Button
                    className="poker-card"
                    name="card"
                    type="submit"
                    value={String(card)}
                    variant={
                      currentParticipantVote(state, currentParticipant.id) === card
                        ? "primary"
                        : "outline"
                    }
                  >
                    {card}
                  </Button>
                </HxForm>
              ))}
              <HxForm
                action={`/sessions/${state.session.code}/votes`}
                method="post"
                className="card-form"
                {...{
                  "hx-post": `/sessions/${state.session.code}/votes`,
                  "hx-swap": "outerHTML",
                  "hx-target": "#session-room",
                }}
              >
                <Button
                  ariaLabel="I don't know"
                  className="poker-card unknown-card"
                  name="card"
                  type="submit"
                  value={unknownCard}
                  variant={
                    currentParticipantVote(state, currentParticipant.id) === unknownCard
                      ? "primary"
                      : "outline"
                  }
                >
                  ?
                </Button>
              </HxForm>
            </fieldset>
          </div>
        ) : (
          <div className="results-panel">
            <h2>{consensus ? `Consensus: ${consensusCard}` : "Revealed votes"}</h2>
            <div className="results-grid">
              {state.participants.map(({ participant, vote }) => (
                <article className="result-row" key={participant.id}>
                  <span>{participant.displayName}</span>
                  <ResultCard card={vote?.card ?? null} />
                </article>
              ))}
            </div>
          </div>
        )}

        {currentParticipant.isHost ? (
          <div className="host-controls">
            {!state.session.revealed ? (
              <HxForm
                action={`/sessions/${state.session.code}/reveal`}
                method="post"
                {...{
                  "hx-post": `/sessions/${state.session.code}/reveal`,
                  "hx-swap": "outerHTML",
                  "hx-target": "#session-room",
                }}
              >
                <Button type="submit">Reveal votes</Button>
              </HxForm>
            ) : (
              <HxForm
                action={`/sessions/${state.session.code}/reset`}
                method="post"
                {...{
                  "hx-post": `/sessions/${state.session.code}/reset`,
                  "hx-swap": "outerHTML",
                  "hx-target": "#session-room",
                }}
              >
                <Button type="submit">Next round</Button>
              </HxForm>
            )}
          </div>
        ) : null}
      </Card>

      <Card as="section" className="participants-panel">
        <h2>Team</h2>
        <ul className="participant-list">
          {state.participants.map(({ participant, vote }) => (
            <li key={participant.id}>
              <span>
                {participant.displayName}
                {participant.isHost ? <small>Host</small> : null}
              </span>
              <Badge tone={vote ? "accent" : "neutral"}>
                {state.session.revealed
                  ? cardLabel(vote?.card ?? "unknown")
                  : votedLabel(Boolean(vote))}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
};

const currentParticipantVote = (state: SessionState, participantId: string) =>
  state.participants.find(({ participant }) => participant.id === participantId)?.vote?.card ??
  null;
