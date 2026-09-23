import { existsSync } from "node:fs";
import { join } from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Config } from "./config.js";
import { createMcpServer } from "./mcp.js";

export type AppOptions = Pick<Config, "publicDir" | "version"> & { startedAt?: Date };

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

/**
 * DNS-rebinding protection, which the MCP spec requires of Streamable HTTP
 * servers. There is no CORS (ADR-006): the console is same-origin. A request
 * with no Origin is a non-browser client (Claude Code, curl) and is allowed. A
 * browser Origin must name the host the request was sent to. There is no fixed
 * allowlist because each Frank's FQDN is only known at deploy time.
 */
export function originAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (origin === undefined) return true;
  if (!host) return false;
  try {
    // URL.host lowercases the hostname and keeps any non-default port.
    return new URL(origin).host === host.toLowerCase();
  } catch {
    // Malformed, or the literal "null" an opaque origin sends.
    return false;
  }
}

function checkOrigin(req: Request, res: Response, next: NextFunction): void {
  if (originAllowed(req.headers.origin, req.headers.host)) {
    next();
    return;
  }
  console.warn("[frank] refused a /mcp request from a foreign Origin");
  jsonRpcError(res, 403, -32000, "Forbidden: this Origin may not call Frank's MCP endpoint.");
}

export function createApp({ publicDir, version, startedAt = new Date() }: AppOptions): express.Express {
  const app = express();
  app.disable("x-powered-by");

  // Route order matters: health and MCP first, so the console's fallback can
  // never answer for them.

  // 1. Health (ADR-001, ADR-004).
  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      version,
      uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    });
  });

  // 2. MCP over stateless Streamable HTTP: a fresh server and transport per
  //    request, torn down only once the response (JSON or SSE) has finished.
  app.post("/mcp", checkOrigin, express.json({ limit: "1mb" }), async (req, res) => {
    const server = createMcpServer({ version, startedAt });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[frank] /mcp request failed:", error instanceof Error ? error.message : error);
      if (!res.headersSent) jsonRpcError(res, 500, -32603, "Internal server error");
    }
  });

  // 3. Stateless: no SSE stream to open and no session to delete. The SDK
  //    client treats a 405 on GET as "this server sends no notifications".
  const methodNotAllowed = (_req: Request, res: Response) => {
    jsonRpcError(res, 405, -32000, "Method not allowed.");
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  // 4. The console (ADR-003, served here per ADR-006). It is optional: Frank
  //    deploys and serves MCP before ui/ has been built.
  const indexHtml = join(publicDir, "index.html");
  app.use(express.static(publicDir, { index: "index.html" }));
  app.get(/^(?!\/mcp(?:\/|$)).*/, (_req, res) => {
    if (existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res
        .type("text/plain")
        .send("Frank is running. His console has not been built yet (ADR-003); MCP is at POST /mcp.\n");
    }
  });

  // Plain-language errors, never a stack trace. Covers malformed JSON bodies.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (error as { status?: number }).status ?? 500;
    if (status >= 500) console.error("[frank] unhandled error:", error instanceof Error ? error.message : error);
    if (res.headersSent) return;
    if (status === 400) {
      jsonRpcError(res, 400, -32700, "Parse error: the request body is not valid JSON.");
    } else if (status === 413) {
      jsonRpcError(res, 413, -32600, "Request body too large.");
    } else {
      jsonRpcError(res, status, -32603, "Internal server error");
    }
  });

  return app;
}
