import { FormValues, fragmentOrPage } from "@macavitymadcap/hyper-dank-transport";
import type { Context } from "hono";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { renderToString } from "hono/jsx/dom/server";
import { HomePage } from "../components/HomePage";
import { JoinPage } from "../components/JoinPage";
import { Layout } from "../components/Layout";
import { RoomDocument, RoomFragment } from "../components/Room";
import type { PlanningPokerRepository } from "../db";
import { createParticipantId, createSessionCode } from "../db/repository";
import { parseVoteCard } from "../domain/cards";
import type { Participant, SessionState } from "../domain/session";
import { SessionEventBroker } from "./sse";

const participantCookie = (code: string) => `pp_${code}_participant`;
const clientEntry = "src/client/main.ts";

type ViteManifestEntry = {
  css?: string[];
  file: string;
};

export interface AppDependencies {
  baseUrl?: string;
  broker?: SessionEventBroker;
  repository: PlanningPokerRepository;
}

const cleanDisplayName = (value: FormDataEntryValue | null) => {
  const displayName = String(value ?? "").trim();
  if (displayName.length === 0) return null;
  return displayName.slice(0, 40);
};

const cleanTicketLabel = (value: FormDataEntryValue | null) => {
  const ticketLabel = String(value ?? "").trim();
  if (ticketLabel.length === 0) return null;
  return ticketLabel.slice(0, 32);
};

export const createApp = ({
  baseUrl,
  broker = new SessionEventBroker(),
  repository,
}: AppDependencies) => {
  const app = new Hono();

  app.get("/healthz", (context) => context.text("ok"));

  app.get("/assets/main.css", async () => {
    const entry = await clientManifestEntry();
    const cssFile = entry?.css?.[0];
    if (cssFile) {
      return new Response(Bun.file(`dist/client/${cssFile}`), {
        headers: { "content-type": "text/css; charset=utf-8" },
      });
    }

    return new Response("Build client assets with `bun run build`.", { status: 503 });
  });

  app.get("/assets/main.js", async () => {
    const entry = await clientManifestEntry();
    if (entry) {
      return new Response(Bun.file(`dist/client/${entry.file}`), {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      });
    }

    return new Response("Build client assets with `bun run build`.", { status: 503 });
  });

  app.get(
    "/assets/htmx.js",
    () =>
      new Response(Bun.file("node_modules/htmx.org/dist/htmx.min.js"), {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      }),
  );

  app.get(
    "/assets/htmx-sse.js",
    () =>
      new Response(Bun.file("node_modules/htmx-ext-sse/dist/sse.min.js"), {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      }),
  );

  app.get("/", (context) => context.html(renderPage(<HomePage />)));

  app.post("/sessions", async (context) => {
    const values = await FormValues.from(context);
    const displayName = cleanDisplayName(values.string("displayName"));
    const ticketLabel = cleanTicketLabel(values.string("ticketLabel"));
    if (!displayName) return context.html(renderPage(<HomePage />), 422);

    let created = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createSessionCode();
      try {
        created = await repository.createSession({
          code,
          hostDisplayName: displayName,
          hostId: createParticipantId(),
          ticketLabel,
        });
        break;
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }
    if (!created) return context.text("Could not create a session.", 500);

    setCookie(context, participantCookie(created.session.code), created.host.id, cookieOptions());
    return context.redirect(`/sessions/${created.session.code}`);
  });

  app.get("/sessions/:code", async (context) => {
    const code = context.req.param("code").toUpperCase();
    const state = await repository.getState(code);
    if (!state) return context.notFound();

    const currentParticipant = await currentParticipantFromCookie(context, repository, code);
    if (!currentParticipant) return context.html(renderPage(<JoinPage code={code} />));

    return context.html(
      renderPage(<RoomDocument {...roomProps(context, state, currentParticipant, baseUrl)} />),
    );
  });

  app.post("/sessions/:code/join", async (context) => {
    const code = context.req.param("code").toUpperCase();
    const values = await FormValues.from(context);
    const displayName = cleanDisplayName(values.string("displayName"));
    if (!displayName) return context.html(renderPage(<JoinPage code={code} />), 422);

    const participant = await repository.joinSession({
      displayName,
      participantId: createParticipantId(),
      sessionCode: code,
    });
    if (!participant) return context.notFound();

    setCookie(context, participantCookie(code), participant.id, cookieOptions());
    await publishRoom(context, repository, broker, code, baseUrl);
    return context.redirect(`/sessions/${code}`);
  });

  app.post("/sessions/:code/votes", async (context) => {
    const code = context.req.param("code").toUpperCase();
    const participant = await currentParticipantFromCookie(context, repository, code);
    if (!participant) return context.redirect(`/sessions/${code}`);

    const values = await FormValues.from(context);
    const card = parseVoteCard(values.string("card"));
    if (card === null) return context.text("Invalid card.", 422);

    await repository.recordVote({ card, participantId: participant.id, sessionCode: code });
    await publishRoom(context, repository, broker, code, baseUrl);
    return renderRoomResponse(context, repository, code, participant, baseUrl);
  });

  app.post("/sessions/:code/reveal", async (context) => {
    const code = context.req.param("code").toUpperCase();
    const participant = await currentParticipantFromCookie(context, repository, code);
    if (!participant) return context.redirect(`/sessions/${code}`);

    await repository.reveal(code, participant.id);
    await publishRoom(context, repository, broker, code, baseUrl);
    return renderRoomResponse(context, repository, code, participant, baseUrl);
  });

  app.post("/sessions/:code/reset", async (context) => {
    const code = context.req.param("code").toUpperCase();
    const participant = await currentParticipantFromCookie(context, repository, code);
    if (!participant?.isHost) return context.redirect(`/sessions/${code}`);

    const values = await FormValues.from(context);
    const ticketLabel = cleanTicketLabel(values.string("ticketLabel"));

    await repository.resetRound({ sessionCode: code, ticketLabel });
    await publishRoom(context, repository, broker, code, baseUrl);
    return renderRoomResponse(context, repository, code, participant, baseUrl);
  });

  app.get("/sessions/:code/events", async (context) => {
    const code = context.req.param("code").toUpperCase();
    const participantId = getCookie(context, participantCookie(code));
    if (!participantId) return context.text("Join the session before opening events.", 401);

    const state = await repository.getState(code);
    const participant = state?.participants.find(
      ({ participant }) => participant.id === participantId,
    )?.participant;
    if (!state || !participant) return context.text("Join the session before opening events.", 401);

    const initialHtml = renderToString(
      <RoomFragment {...roomProps(context, state, participant, baseUrl)} />,
    );

    return new Response(broker.stream(code, participantId, initialHtml), {
      headers: {
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
      },
    });
  });

  return app;
};

const renderPage = (children: unknown) =>
  `<!doctype html>${renderToString(<Layout>{children}</Layout>)}`;

const clientManifestEntry = async () => {
  const manifestFile = Bun.file("dist/client/.vite/manifest.json");
  if (!(await manifestFile.exists())) return null;

  const manifest = (await manifestFile.json()) as Record<string, ViteManifestEntry>;
  return manifest[clientEntry] ?? null;
};

const cookieOptions = () => ({
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 14,
  path: "/",
  sameSite: "Lax" as const,
  secure: process.env.NODE_ENV === "production",
});

const currentParticipantFromCookie = async (
  context: Context,
  repository: PlanningPokerRepository,
  code: string,
) => {
  const participantId = getCookie(context, participantCookie(code));
  if (!participantId) return null;
  return repository.findParticipant(code, participantId);
};

const roomProps = (
  context: Context,
  state: SessionState,
  currentParticipant: Participant,
  configuredBaseUrl?: string,
) => ({
  baseUrl: configuredBaseUrl ?? originFromRequest(context),
  currentParticipant,
  state,
});

const originFromRequest = (context: Context) => {
  const host = context.req.header("host") ?? "localhost:3000";
  const protocol = context.req.header("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
};

const publishRoom = async (
  context: Context,
  repository: PlanningPokerRepository,
  broker: SessionEventBroker,
  code: string,
  baseUrl?: string,
) => {
  const state = await repository.getState(code);
  if (!state) return;

  for (const { participant } of state.participants) {
    broker.publish({
      clientId: participant.id,
      html: renderToString(<RoomFragment {...roomProps(context, state, participant, baseUrl)} />),
      sessionCode: code,
    });
  }
};

const renderRoomResponse = async (
  context: Context,
  repository: PlanningPokerRepository,
  code: string,
  participant: Participant,
  baseUrl?: string,
) => {
  const state = await repository.getState(code);
  if (!state) return context.html("Session not found.", 404);

  const fragment = renderToString(
    <RoomFragment {...roomProps(context, state, participant, baseUrl)} />,
  );
  return fragmentOrPage(context, {
    fragment,
    page: renderPage(<RoomDocument {...roomProps(context, state, participant, baseUrl)} />),
  });
};
