import { defineConfig } from "vite";

const isKnownHtmxEvalWarning = (log: { code?: string; id?: string }) =>
  log.code === "EVAL" && log.id?.includes("htmx.org/dist/htmx.esm.js");

export default defineConfig({
  build: {
    manifest: true,
    outDir: "dist/client",
    rollupOptions: {
      input: "src/client/main.ts",
      onLog(level, log, defaultHandler) {
        if (level === "warn" && isKnownHtmxEvalWarning(log)) return;
        defaultHandler(level, log);
      },
    },
  },
  publicDir: "public",
  server: {
    host: "127.0.0.1",
    port: Number(process.env.VITE_PORT ?? 5173),
    strictPort: true,
  },
});
