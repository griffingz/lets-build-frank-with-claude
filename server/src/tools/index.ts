import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTool, type Tool, type ToolContext } from "./define.js";
import { getStatus } from "./get-status.js";

// Every tool Frank exposes. Add new tools here (ADR-002).
export const tools: Tool[] = [getStatus as unknown as Tool];

export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const tool of tools) {
    registerTool(server, tool, ctx);
  }
}
