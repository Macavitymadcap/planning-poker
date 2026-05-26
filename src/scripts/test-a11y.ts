import pa11y from "pa11y";
import { createApp } from "../app";
import { SqlitePlanningPokerRepository } from "../db/sqlite";

const port = Number(process.env.A11Y_PORT ?? 3200);
const repository = new SqlitePlanningPokerRepository(":memory:");
await repository.migrate();
const app = createApp({ baseUrl: `http://127.0.0.1:${port}`, repository });
const server = Bun.serve({ fetch: app.fetch, hostname: "127.0.0.1", port });

try {
  const result = await pa11y(`http://127.0.0.1:${port}/`);
  if (result.issues.length > 0) {
    console.error(result.issues);
    process.exitCode = 1;
  } else {
    console.log("Accessibility checks passed.");
  }
} finally {
  server.stop(true);
  await repository.close();
}
