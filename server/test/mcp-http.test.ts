import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { originAllowed } from "../src/app.js";
import { connectClient, MCP_HEADERS, rawRequest, startFrank, toolsListBody, type RunningFrank } from "./helpers.js";

let frank: RunningFrank;

beforeAll(async () => {
  frank = await startFrank();
});

afterAll(async () => {
  await frank.close();
});

describe("MCP over Streamable HTTP (ADR-001)", () => {
  it("completes the handshake and lists get_status with a strict input schema", async () => {
    const client = await connectClient(frank.url);
    const { tools } = await client.listTools();
    const status = tools.find((t) => t.name === "get_status");
    expect(status).toBeDefined();
    expect(status?.inputSchema.additionalProperties).toBe(false);
    expect(status?.outputSchema?.properties).toHaveProperty("summary");
    expect(status?.annotations?.readOnlyHint).toBe(true);
    await client.close();
  });

  it("calls get_status and returns summary plus typed fields", async () => {
    const client = await connectClient(frank.url);
    const result = await client.callTool({ name: "get_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.version).toBe("9.9.9-test");
    expect(typeof structured.summary).toBe("string");
    expect(typeof structured.uptimeSeconds).toBe("number");
    await client.close();
  });

  it("serves concurrent clients from a stateless endpoint", async () => {
    const clients = await Promise.all([1, 2, 3].map(() => connectClient(frank.url)));
    const results = await Promise.all(clients.map((c) => c.callTool({ name: "get_status", arguments: {} })));
    expect(results.every((r) => !r.isError)).toBe(true);
    await Promise.all(clients.map((c) => c.close()));
  });
});

describe("ADR-002 error shape for bad input", () => {
  // The SDK validates arguments before the handler runs. SDK 1.30.1 returns a
  // failure as an isError tool result; these tests pin that behaviour.
  it("rejects unknown fields with isError and a plain message, no stack trace", async () => {
    const client = await connectClient(frank.url);
    const result = await client.callTool({ name: "get_status", arguments: { resourceGroup: "elsewhere" } });
    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toMatch(/Invalid arguments for tool get_status/);
    expect(text).not.toMatch(/\n\s+at /);
    await client.close();
  });

  it("answers an unknown tool with isError, not a crash", async () => {
    const client = await connectClient(frank.url);
    const result = await client.callTool({ name: "delete_everything", arguments: {} });
    expect(result.isError).toBe(true);
    await client.close();
  });
});

describe("routes", () => {
  it("GET /healthz answers 200 with version and uptime", async () => {
    const res = await fetch(`${frank.url}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: "9.9.9-test" });
  });

  it.each(["GET", "DELETE"])("%s /mcp answers 405", async (method) => {
    const res = await fetch(`${frank.url}/mcp`, { method });
    expect(res.status).toBe(405);
    expect((await res.json()).error.message).toMatch(/not allowed/i);
  });

  it("answers malformed JSON with a JSON-RPC parse error, no stack trace", async () => {
    const res = await rawRequest(`${frank.url}/mcp`, { method: "POST", headers: MCP_HEADERS, body: "{not json" });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe(-32700);
    expect(res.body).not.toMatch(/\n\s+at /);
  });
});

describe("Origin check (DNS-rebinding protection)", () => {
  const post = (headers: Record<string, string>) =>
    rawRequest(`${frank.url}/mcp`, { method: "POST", headers: { ...MCP_HEADERS, ...headers }, body: toolsListBody });

  it("allows a request with no Origin (Claude Code, curl)", async () => {
    expect((await post({})).status).toBe(200);
  });

  it("allows an Origin matching the request host", async () => {
    expect((await post({ origin: `http://${frank.host}` })).status).toBe(200);
  });

  it("allows the same host in a different case", async () => {
    const res = await post({ host: "FRANK.example.com", origin: "https://frank.EXAMPLE.com" });
    expect(res.status).toBe(200);
  });

  it("refuses a foreign Origin with 403", async () => {
    const res = await post({ origin: "https://evil.example.com" });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body).error.message).toMatch(/Origin/);
  });

  it("refuses the same host on a different port", async () => {
    expect((await post({ host: "localhost:3000", origin: "http://localhost:5173" })).status).toBe(403);
  });

  it.each(["not a url", "null"])("refuses a malformed Origin (%s) with 403, not 500", async (origin) => {
    expect((await post({ origin })).status).toBe(403);
  });
});

describe("originAllowed", () => {
  it.each([
    [undefined, "a.example", true],
    ["https://a.example", "a.example", true],
    ["https://A.Example", "a.example", true],
    ["https://a.example:8443", "a.example:8443", true],
    ["https://a.example", "b.example", false],
    ["http://localhost:5173", "localhost:3000", false],
    ["https://a.example", undefined, false],
    ["null", "a.example", false],
  ])("origin %s, host %s -> %s", (origin, host, expected) => {
    expect(originAllowed(origin, host)).toBe(expected);
  });
});
