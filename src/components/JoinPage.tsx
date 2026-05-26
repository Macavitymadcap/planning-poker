import { Button, Card, HxForm } from "@macavitymadcap/hyper-dank-ui";

export interface JoinPageProps {
  code: string;
}

export const JoinPage = ({ code }: JoinPageProps) => (
  <main className="room-shell">
    <Card as="section" className="join-panel">
      <p className="eyebrow">Room {code}</p>
      <h1>Join the vote</h1>
      <HxForm action={`/sessions/${code}/join`} method="post" className="stacked-form">
        <label>
          Your name
          <input name="displayName" required maxLength={40} placeholder="Grace" />
        </label>
        <Button type="submit">Join session</Button>
      </HxForm>
    </Card>
  </main>
);
