/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Frank serves this console from the same origin, so it calls /mcp relatively
// (ADR-006). In development the Vite server stands in for that origin and
// proxies to a local Frank.
//
// Do NOT set `changeOrigin: true` on these proxies. Frank refuses any /mcp
// request whose Origin does not match its Host (DNS-rebinding protection).
// Left off, the proxy forwards `Host: localhost:5173`, which matches the
// browser's `Origin: http://localhost:5173`. Turned on, it rewrites Host to
// localhost:3000 and every console request gets a 403.
const frank = { target: "http://localhost:3000" };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/mcp": frank,
      "/healthz": frank,
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    css: false,
  },
});
