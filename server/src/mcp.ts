import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./tools/define.js";
import { registerTools } from "./tools/index.js";

/** A fresh MCP server with every tool registered. One per request (stateless). */
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer(
    { name: "frank", version: ctx.version },
    {
      instructions:
        "Frank is a read-only MCP server. His tools observe the environment he runs in; none of them change anything.",
    },
  );
  registerTools(server, ctx);
  return server;
}
