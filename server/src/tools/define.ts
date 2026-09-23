import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ADR-002 in one place: every tool goes through defineTool, so the output shape
// and error handling cannot drift from tool to tool.

/** Every tool's output carries a human/model-readable `summary` string. */
type WithSummary = z.ZodObject<{ summary: z.ZodString } & z.ZodRawShape>;

export interface ToolContext {
  version: string;
  startedAt: Date;
}

export interface Tool<I extends z.ZodObject = z.ZodObject, O extends WithSummary = WithSummary> {
  /** `verb_noun`; the verb is one of get, list, search, summarize. */
  name: string;
  /** One or two sentences for a model deciding whether to call the tool. */
  description: string;
  /** Strict zod object: unknown fields are rejected. Describe every field. */
  input: I;
  /** Typed detail fields plus `summary`. Advertised as the tool's outputSchema. */
  output: O;
  handler: (args: z.infer<I>, ctx: ToolContext) => Promise<z.infer<O>> | z.infer<O>;
}

export function defineTool<I extends z.ZodObject, O extends WithSummary>(tool: Tool<I, O>): Tool<I, O> {
  return tool;
}

/** A plain-language error result. Never a stack trace (ADR-002). */
export function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function registerTool(server: McpServer, tool: Tool, ctx: ToolContext): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.input,
      outputSchema: tool.output,
      // Frank observes; he does not act (ADR-002).
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    // The SDK has already validated `args` against `tool.input` by the time this
    // runs; a validation failure never reaches here and comes back from the SDK
    // as an `isError` result (pinned by test/mcp-http.test.ts).
    async (args: unknown): Promise<CallToolResult> => {
      try {
        const result = await tool.handler(args as z.infer<typeof tool.input>, ctx);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[frank] ${tool.name} failed: ${reason}`);
        return toolError(`${tool.name} could not complete: ${reason}`);
      }
    },
  );
}
