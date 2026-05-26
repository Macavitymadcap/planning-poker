import { createProviderRegistry } from "@macavitymadcap/hyper-dank-data";
import { PostgresPlanningPokerRepository } from "./postgres";
import type { PlanningPokerRepository } from "./repository";
import { SqlitePlanningPokerRepository } from "./sqlite";

export interface DatabaseEnvironment {
  databaseUrl?: string;
  dbPath?: string;
}

export const providerRegistry = createProviderRegistry({
  postgres: async (environment: DatabaseEnvironment) => {
    if (!environment.databaseUrl) throw new Error("DATABASE_URL is required for Postgres.");
    const repository = new PostgresPlanningPokerRepository(environment.databaseUrl);
    await repository.migrate();
    return repository;
  },
  sqlite: async (environment: DatabaseEnvironment) => {
    const repository = new SqlitePlanningPokerRepository(
      environment.dbPath ?? "planning-poker.sqlite3",
    );
    await repository.migrate();
    return repository;
  },
});

export const createRepository = async (
  environment: DatabaseEnvironment,
): Promise<PlanningPokerRepository> => {
  if (environment.databaseUrl) return providerRegistry.create("postgres", environment);
  return providerRegistry.create("sqlite", environment);
};

export type { PlanningPokerRepository };
