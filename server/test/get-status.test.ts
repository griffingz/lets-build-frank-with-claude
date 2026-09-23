import { describe, expect, it } from "vitest";
import { getStatus } from "../src/tools/get-status.js";

const ctx = { version: "1.2.3", startedAt: new Date(Date.now() - 42_000) };

describe("get_status", () => {
  it("returns a summary plus typed version, uptime and greeting", async () => {
    const result = await getStatus.handler({}, ctx);
    expect(getStatus.output.parse(result)).toEqual(result);
    expect(result.version).toBe("1.2.3");
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(42);
    expect(result.summary).toContain("1.2.3");
    expect(result.greeting.length).toBeGreaterThan(0);
  });

  it("rejects unknown input fields", () => {
    expect(getStatus.input.safeParse({ resourceGroup: "someone-else" }).success).toBe(false);
    expect(getStatus.input.safeParse({}).success).toBe(true);
  });
});
