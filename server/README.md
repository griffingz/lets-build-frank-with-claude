# Frank's MCP server

TypeScript on Node 22+, built on the official `@modelcontextprotocol/sdk` (v1.x)
and serving stateless Streamable HTTP through Express
([ADR-001](../docs/adr/ADR-001-mcp-server-stack.md)). Every tool follows
[ADR-002](../docs/adr/ADR-002-mcp-tool-conventions.md).

## Run it

```bash
npm ci
npm run dev                  # tsx watch on :3000
npm test                     # vitest; one file: npx vitest run test/mcp-http.test.ts
npm run build && npm start   # compiled, as the container runs it
```

Connect Claude Code to a local Frank. MCP servers load at session start, so
restart `claude` after adding it:

```bash
claude mcp add --transport http frank-local http://localhost:3000/mcp
```

## Routes

Routes are registered in this order, so the console fallback can never answer
for MCP:

| Route | What it does |
|---|---|
| `GET /healthz` | `{ status, version, uptimeSeconds }` |
| `POST /mcp` | MCP. A fresh server and transport per request (stateless) |
| `GET` / `DELETE /mcp` | `405`: no SSE stream, no sessions |
| `GET /*` | The built console from `public/` (ADR-006), or a note that it is not built yet |

`POST /mcp` has no CORS, because the console is same-origin (ADR-006). It does
check `Origin`, which the MCP spec requires to prevent DNS rebinding:

- A request with no `Origin` is allowed. Claude Code and curl send none.
- A request whose `Origin` matches its own `Host` is allowed.
- Any other `Origin`, including a malformed one, gets a `403`.

## Environment

All configuration comes from environment variables. There are no config files.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Listen port. Must match the Dockerfile and `deploy.yml`'s `--target-port` |

`deploy.yml` also passes `AZURE_*` variables into the container. They are for
the Azure-reading tools that ADR-009 will add, and nothing reads them yet.

## Adding a tool

1. Create `src/tools/<verb>-<noun>.ts` with `defineTool({...})`. The name is
   `verb_noun`, and the verb must be one of `get`, `list`, `search`,
   `summarize`. The input is a `z.strictObject` with every field `.describe()`d.
   The output is a zod object with `summary` plus typed fields. Handlers must
   not change anything outside Frank.
2. Add it to the `tools` array in `src/tools/index.ts`.
3. Add `test/<verb>-<noun>.test.ts`. `test/conventions.test.ts` checks naming
   and schemas for every registered tool automatically.

`defineTool` wraps the handler. It returns the result as both text and
`structuredContent`, and turns any thrown error into `isError: true` with a
plain message. The SDK validates arguments before the handler runs, and returns
a failure as an `isError` result too, so a handler never has to validate its
input.
