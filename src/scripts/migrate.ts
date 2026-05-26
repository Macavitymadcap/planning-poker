import { createRepository } from "../db";

const repository = await createRepository({
  databaseUrl: process.env.DATABASE_URL,
  dbPath: process.env.DB_PATH,
});

await repository.migrate();
await repository.close();
console.log("Planning Poker database is migrated.");
