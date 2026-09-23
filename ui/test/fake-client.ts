import { vi } from "vitest";
import type { FrankClient, ToolCallOutcome, ToolInfo } from "../src/frank/client";

export const STATUS = {
  summary: "Frank 1.2.3 is up and has been running for 42s.",
  version: "1.2.3",
  uptimeSeconds: 42,
  greeting: "Hi, I'm Frank.",
};

export const TOOLS: ToolInfo[] = [
  {
    name: "get_status",
    description: "Returns Frank's version, uptime and a greeting.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_things",
    description: "Searches things.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "What to look for." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

/** A FrankClient with no network: the seam App and the pages take (ADR-003). */
export function fakeClient(overrides: Partial<FrankClient> = {}) {
  const callTool = vi.fn(async (name: string, args?: Record<string, unknown>): Promise<ToolCallOutcome> => {
    if (name === "get_status") {
      return { isError: false, text: JSON.stringify(STATUS), structured: STATUS };
    }
    return {
      isError: false,
      text: "",
      structured: { summary: `Searched for ${String(args?.query)}.`, matches: 0 },
    };
  });
  const listTools = vi.fn(async () => TOOLS);
  return { listTools, callTool, ...overrides } satisfies FrankClient;
}
