import { describe, expect, it } from "vitest";
import { z } from "zod";
import { tools } from "../src/tools/index.js";

// ADR-002 as a failing test, not just a review comment.
const NAME = /^(get|list|search|summarize)_[a-z0-9]+(?:_[a-z0-9]+)*$/;

describe.each(tools.map((t) => [t.name, t] as const))("tool %s follows ADR-002", (_name, tool) => {
  it("is named verb_noun from the closed verb set", () => {
    expect(tool.name).toMatch(NAME);
  });

  it("has a description written for a model", () => {
    expect(tool.description.trim().length).toBeGreaterThan(20);
  });

  it("has a strict input schema that rejects unknown fields", () => {
    const json = z.toJSONSchema(tool.input) as { additionalProperties?: unknown };
    expect(json.additionalProperties).toBe(false);
  });

  it("describes every input parameter", () => {
    for (const [key, field] of Object.entries(tool.input.shape)) {
      expect((field as z.ZodType).description, `input "${key}" has no .describe()`).toBeTruthy();
    }
  });

  it("returns a summary string plus typed detail fields", () => {
    const shape = tool.output.shape;
    expect(shape.summary).toBeInstanceOf(z.ZodString);
    expect(Object.keys(shape).length).toBeGreaterThan(1);
  });
});

it("has unique tool names", () => {
  const names = tools.map((t) => t.name);
  expect(new Set(names).size).toBe(names.length);
});
