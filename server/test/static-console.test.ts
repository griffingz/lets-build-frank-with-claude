import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectClient, startFrank, type RunningFrank } from "./helpers.js";

describe("with a built console (ADR-006)", () => {
  let dir: string;
  let frank: RunningFrank;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "frank-console-"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>Frank console</title>");
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "app.js"), "console.log(1);");
    frank = await startFrank(dir);
  });

  afterAll(async () => {
    await frank.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("serves index.html at /", async () => {
    const res = await fetch(`${frank.url}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Frank console");
  });

  it("serves static assets", async () => {
    const res = await fetch(`${frank.url}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("falls back to index.html for client-side routes", async () => {
    const res = await fetch(`${frank.url}/tools`);
    expect(await res.text()).toContain("Frank console");
  });

  it("never lets the console fallback answer GET /mcp", async () => {
    const res = await fetch(`${frank.url}/mcp`);
    expect(res.status).toBe(405);
    expect(await res.text()).not.toContain("Frank console");
  });

  it("still answers POST /mcp over the real MCP client", async () => {
    const client = await connectClient(frank.url);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("get_status");
    await client.close();
  });
});

describe("without a console (ADR-003: optional)", () => {
  let frank: RunningFrank;

  beforeAll(async () => {
    frank = await startFrank();
  });

  afterAll(async () => {
    await frank.close();
  });

  it("says plainly at / that the console is not built yet", async () => {
    const res = await fetch(`${frank.url}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/console has not been built yet/);
  });

  it("still answers POST /mcp", async () => {
    const client = await connectClient(frank.url);
    const result = await client.callTool({ name: "get_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    await client.close();
  });
});
