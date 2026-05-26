import { Button, Card, HxForm } from "@macavitymadcap/hyper-dank-ui";

export const HomePage = () => (
  <main className="home-shell">
    <section className="home-hero">
      <p className="eyebrow">Planning Poker</p>
      <h1>Start a round, share the room, reveal the estimate.</h1>
      <p>
        Lightweight team estimation with hidden Fibonacci votes, a question-mark card for unknowns,
        and a confetti moment when the table reaches consensus.
      </p>
    </section>

    <Card as="section" className="start-panel">
      <h2>Start a session</h2>
      <HxForm action="/sessions" method="post" className="stacked-form">
        <label>
          Your name
          <input name="displayName" required maxLength={40} placeholder="Ada" />
        </label>
        <Button type="submit">Create session</Button>
      </HxForm>
    </Card>
  </main>
);
