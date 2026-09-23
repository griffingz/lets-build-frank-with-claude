import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request, type IncomingHttpHeaders, type Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/app.js";

export interface RunningFrank {
  url: string;
  host: string;
  publicDir: string;
  close: () => Promise<void>;
}

/** Boot Frank on an ephemeral port. `publicDir` defaults to an empty temp dir (no console). */
export async function startFrank(publicDir?: string): Promise<RunningFrank> {
  const dir = publicDir ?? mkdtempSync(join(tmpdir(), "frank-public-"));
  const app = createApp({ publicDir: dir, version: "9.9.9-test" });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    host: `127.0.0.1:${port}`,
    publicDir: dir,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (!publicDir) rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function connectClient(url: string): Promise<Client> {
  const client = new Client({ name: "frank-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`)));
  return client;
}

export const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

export const toolsListBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });

export interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

/**
 * A raw HTTP request with full control over Host and Origin, which fetch()
 * does not let a caller set.
 */
export function rawRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<RawResponse> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: target.hostname,
        port: target.port,
        path: target.pathname,
        method: options.method ?? "GET",
        headers: options.headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}
