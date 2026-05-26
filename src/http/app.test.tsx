import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { SqlitePlanningPokerRepository } from "../db/sqlite";

const createHarness = async () => {
  const repository = new SqlitePlanningPokerRepository(":memory:");
  await repository.migrate();
  const app = createApp({ baseUrl: "http://example.test", repository });
  return { app, repository };
};

const postForm = (url: string, body: Record<string, string>, cookie?: string) =>
  new Request(url, {
    body: new URLSearchParams(body),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    method: "POST",
    redirect: "manual",
  });

const cookieHeader = (response: Response) =>
  response.headers.get("set-cookie")?.split(";")[0] ?? "";

describe("planning poker routes", () => {
  test("creates a session and stores a host cookie", async () => {
    const { app } = await createHarness();
    const response = await app.fetch(
      postForm("http://example.test/sessions", { displayName: "Ada" }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/^\/sessions\/[A-Z0-9]+$/);
    expect(response.headers.get("set-cookie")).toContain("pp_");
  });

  test("joins a session by display name", async () => {
    const { app } = await createHarness();
    const created = await app.fetch(
      postForm("http://example.test/sessions", { displayName: "Ada" }),
    );
    const location = created.headers.get("location") ?? "";

    const joined = await app.fetch(
      postForm(`http://example.test${location}/join`, { displayName: "Grace" }),
    );

    expect(joined.status).toBe(302);
    expect(joined.headers.get("location")).toBe(location);
    expect(joined.headers.get("set-cookie")).toContain("pp_");
  });

  test("hides votes before reveal and shows them after reveal", async () => {
    const { app } = await createHarness();
    const created = await app.fetch(
      postForm("http://example.test/sessions", { displayName: "Ada" }),
    );
    const location = created.headers.get("location") ?? "";
    const hostCookie = cookieHeader(created);
    const joined = await app.fetch(
      postForm(`http://example.test${location}/join`, { displayName: "Grace" }),
    );
    const guestCookie = cookieHeader(joined);

    await app.fetch(postForm(`http://example.test${location}/votes`, { card: "5" }, hostCookie));
    await app.fetch(postForm(`http://example.test${location}/votes`, { card: "5" }, guestCookie));

    const hidden = await app.fetch(
      new Request(`http://example.test${location}`, { headers: { cookie: hostCookie } }),
    );
    expect(await hidden.text()).toContain("Voted");

    await app.fetch(postForm(`http://example.test${location}/reveal`, {}, hostCookie));
    const revealed = await app.fetch(
      new Request(`http://example.test${location}`, { headers: { cookie: hostCookie } }),
    );
    const html = await revealed.text();

    expect(html).toContain("Consensus: 5");
    expect(html).toContain('data-consensus="true"');
  });

  test("resets the room for a next round", async () => {
    const { app } = await createHarness();
    const created = await app.fetch(
      postForm("http://example.test/sessions", { displayName: "Ada" }),
    );
    const location = created.headers.get("location") ?? "";
    const hostCookie = cookieHeader(created);

    await app.fetch(postForm(`http://example.test${location}/votes`, { card: "3" }, hostCookie));
    await app.fetch(postForm(`http://example.test${location}/reveal`, {}, hostCookie));
    const reset = await app.fetch(postForm(`http://example.test${location}/reset`, {}, hostCookie));
    const html = await reset.text();

    expect(html).toContain("Round 2");
    expect(html).toContain("Voting");
  });

  test("opens an SSE stream", async () => {
    const { app } = await createHarness();
    const created = await app.fetch(
      postForm("http://example.test/sessions", { displayName: "Ada" }),
    );
    const code = created.headers.get("location")?.split("/").pop() ?? "";

    const response = await app.fetch(new Request(`http://example.test/sessions/${code}/events`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await response.body?.cancel();
  });
});
