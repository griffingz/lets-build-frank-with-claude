import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/** The subset of JSON Schema that tools/list returns for a tool's input. */
export interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  items?: JsonSchema;
  default?: unknown;
  additionalProperties?: boolean | JsonSchema;
}

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface ToolCallOutcome {
  /** True when Frank answered but the tool reported a failure (ADR-002). */
  isError: boolean;
  /** The tool's text content, joined. */
  text: string;
  /** The tool's structured output, when it has one: `summary` plus typed fields. */
  structured?: Record<string, unknown>;
}

/** Everything the console needs from Frank. Pages take this, not the SDK, so tests can fake it. */
export interface FrankClient {
  listTools(): Promise<ToolInfo[]>;
  callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallOutcome>;
}

/**
 * A client for the Frank that served this page. The endpoint is relative: the
 * console and MCP share an origin (ADR-006), so there is no URL to configure
 * and nothing secret in the bundle.
 */
export function createFrankClient(options: { endpoint?: string } = {}): FrankClient {
  const endpoint = options.endpoint ?? "/mcp";
  let connection: Promise<Client> | null = null;

  const connect = (): Promise<Client> => {
    if (!connection) {
      const client = new Client({ name: "frank-console", version: "0.1.0" });
      const transport = new StreamableHTTPClientTransport(new URL(endpoint, window.location.origin));
      connection = client.connect(transport).then(() => client);
      // Forget a failed connection so the next call retries instead of
      // replaying the same rejection forever.
      connection.catch(() => {
        connection = null;
      });
    }
    return connection;
  };

  return {
    async listTools() {
      const client = await connect();
      const { tools } = await client.listTools();
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as JsonSchema,
      }));
    },
    async callTool(name, args = {}) {
      const client = await connect();
      const result = await client.callTool({ name, arguments: args });
      const content = Array.isArray(result.content) ? result.content : [];
      const text = content
        .filter((c): c is { type: "text"; text: string } => c?.type === "text")
        .map((c) => c.text)
        .join("\n");
      return {
        isError: result.isError === true,
        text,
        structured: result.structuredContent as Record<string, unknown> | undefined,
      };
    },
  };
}
