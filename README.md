# Planning Poker

A Hyper-Dank planning poker app built with Bun, Hono, HTMX, server-rendered JSX, and Postgres-ready persistence.

## Run locally

```bash
bun install
bun run dev
```

The app runs on `http://localhost:3000` by default and stores local data in `planning-poker.sqlite3`.

## Scripts

```bash
bun run dev
bun run db:migrate
bun run test
bun run test:e2e
bun run test:a11y
bun run verify
```

## Railway

Set these variables on the app service:

- `DATABASE_URL`
- `SESSION_SECRET`
- `BASE_URL`
- `PORT`

Use `bun run db:migrate` as the pre-deploy command, `bun run start` as the start command, and `/healthz` as the health check path.

## Git flow

This project uses `pp-*` issue and branch identifiers. The MVP branch is `pp-0001`.

## Releases

Merges to `main` run Release Please. It creates or updates a release PR from conventional commits, and merging that release PR publishes the GitHub release and updates package metadata.
