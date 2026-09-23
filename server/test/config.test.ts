import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, packageRoot } from "../src/config.js";

describe("loadConfig", () => {
  it("defaults PORT to 3000, matching the Dockerfile and deploy.yml", () => {
    expect(loadConfig({}).port).toBe(3000);
  });

  it("reads PORT from the environment", () => {
    expect(loadConfig({ PORT: "8080" }).port).toBe(8080);
  });

  it.each(["abc", "0", "70000", "3.5"])("refuses PORT=%s with a plain-language error", (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Frank cannot start: invalid environment \(PORT/);
  });

  it("resolves the console as <package root>/public, where the Dockerfile puts it", () => {
    expect(loadConfig({}).publicDir).toBe(join(packageRoot, "public"));
    expect(existsSync(join(packageRoot, "package.json"))).toBe(true);
  });

  it("takes its version from package.json", () => {
    expect(loadConfig({}).version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
