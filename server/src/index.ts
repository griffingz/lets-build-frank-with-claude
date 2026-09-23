import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const app = createApp(config);
const server = app.listen(config.port, () => {
  console.log(`[frank] ${config.version} listening on :${config.port} (MCP at POST /mcp)`);
});

// Container Apps sends SIGTERM when scaling to zero; finish in-flight requests.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
