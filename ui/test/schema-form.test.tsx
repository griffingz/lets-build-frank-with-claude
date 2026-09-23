import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SchemaForm, { buildArgs, fieldKind } from "../src/components/SchemaForm";
import type { JsonSchema } from "../src/frank/client";

const schema: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "A name." },
    count: { type: "integer" },
    ratio: { type: "number" },
    verbose: { type: "boolean" },
    colour: { type: "string", enum: ["red", "green"] },
    filter: { type: "object" },
  },
  required: ["name"],
};

describe("fieldKind", () => {
  it.each([
    [{ type: "string" }, "string"],
    [{ type: "integer" }, "integer"],
    [{ type: "number" }, "number"],
    [{ type: "boolean" }, "boolean"],
    [{ type: "string", enum: ["a"] }, "enum"],
    [{ type: ["string", "null"] }, "string"],
    [{ type: "object" }, "json"],
    [{}, "json"],
  ] as [JsonSchema, string][])("%j -> %s", (field, kind) => {
    expect(fieldKind(field)).toBe(kind);
  });
});

describe("buildArgs", () => {
  it("converts each field to its schema type and omits empty optional fields", () => {
    const { args, errors } = buildArgs(schema, {
      name: " frank ",
      count: "3",
      ratio: "",
      verbose: true,
      colour: "green",
      filter: '{"a":1}',
    });
    expect(errors).toEqual({});
    expect(args).toEqual({ name: "frank", count: 3, verbose: true, colour: "green", filter: { a: 1 } });
  });

  it("reports a missing required field, a non-integer and bad JSON", () => {
    const { errors } = buildArgs(schema, { name: "", count: "1.5", verbose: false, filter: "{nope" });
    expect(errors).toEqual({ name: "Required.", count: "Enter a whole number.", filter: "Enter valid JSON." });
  });
});

describe("SchemaForm", () => {
  it("renders one field per property, marking optional ones", () => {
    render(<SchemaForm schema={schema} onSubmit={() => {}} />);
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("count (optional)")).toBeInTheDocument();
    expect(screen.getByText("A name.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("renders just a Run button for a zero-argument tool, and submits {}", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SchemaForm schema={{ type: "object", properties: {} }} onSubmit={onSubmit} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(onSubmit).toHaveBeenCalledWith({});
  });

  it("does not submit while a required field is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SchemaForm schema={schema} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Required.")).toBeInTheDocument();
  });
});
