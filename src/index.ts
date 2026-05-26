import { createApp } from "./app";
import { createRepository } from "./db";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";
const repository = await createRepository({
  databaseUrl: process.env.DATABASE_URL,
  dbPath: process.env.DB_PATH,
});
const app = createApp({
  baseUrl: process.env.BASE_URL,
  repository,
});

Bun.serve({
  fetch: app.fetch,
  hostname,
  port,
});

console.log(`Planning Poker running at http://${hostname}:${port}`);
