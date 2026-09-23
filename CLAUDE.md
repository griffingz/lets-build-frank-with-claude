# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The classroom repo for a one-day course. It builds **Frank**: a read-only MCP server plus a Cloudscape web console, shipped as **one container** to Azure Container Apps. `server/` and `ui/` are built from the ADRs in `docs/adr/`, so read the relevant ADR before changing code, and refer to decisions by number ("implement ADR-003").

## Commands

`server/` and `ui/` are separate npm packages (ADR-001, ADR-003) with the same script names. Dependencies are pinned exactly (`.npmrc` sets `save-exact=true`), and the lockfiles are committed.

```bash
cd server   # or: cd ui
npm ci
npm run dev      # server: tsx watch on :3000   ui: Vite on :5173, proxying /mcp and /healthz to :3000
npm test         # vitest; one file: npx vitest run test/mcp-http.test.ts
npm run build    # server -> dist/   ui -> dist/ (tsc -b && vite build)
```

The ui suite is slow (over a minute) because vitest transforms Cloudscape on every run.

Full image build, the same one the pipeline runs (repo root is the build context):

```bash
docker build -t frank . && docker run -p 3000:3000 frank
# MCP: POST http://localhost:3000/mcp   health: GET /healthz   console: /
```

Connect a client to a deployed Frank: `claude mcp add --transport http frank https://<fqdn>/mcp`. Then restart `claude`, because MCP servers load at session start.

## Architecture: how the pieces fit

- **Server (ADR-001):** TypeScript on Node 22+, with Express and v1.x of the official `@modelcontextprotocol/sdk`. Don't move to the newer split `@modelcontextprotocol/server` / `client` packages without an ADR. All config comes from env vars, parsed once in `src/config.ts` (`PORT` defaults to 3000). The console is resolved as `<package root>/public`, which is where the Dockerfile copies `ui/dist`.
- **Routes (`server/src/app.ts`), in an order that matters:** `GET /healthz`, then `POST /mcp`, then `GET` and `DELETE /mcp` returning 405, then the static console with its fallback to `index.html`. If a route is added after the fallback, the fallback will answer for it instead.
- **MCP is stateless Streamable HTTP.** Every `POST /mcp` gets a fresh `McpServer` and transport, which are closed on `res.on("close")`. There are no sessions, which suits scale-to-zero.
- **`/mcp` checks the `Origin` header** (the MCP spec's DNS-rebinding protection) even though there's no CORS. A request with no `Origin` is allowed. An `Origin` whose host doesn't match the `Host` header, or one that's malformed, gets a 403. That's why the Vite dev proxy must **not** set `changeOrigin: true`.
- **Console (ADR-003, amended by ADR-006):** React 18, Vite and Cloudscape only (`components` and `global-styles`, so no `code-view`). It has two pages: Overview, which shows `get_status`, and Tools, where `SchemaForm` builds a form from each tool's input schema. Page state lives in `App`, with no router. `App` takes a `FrankClient` prop (`ui/src/frank/client.ts`), and the tests pass a fake one. Frank serves the console from the same origin, so it calls **`/mcp` relatively**. There is **no `VITE_FRANK_URL` and no CORS**, and the UI holds no secrets. The console is **optional**: Frank has to deploy and serve MCP even when `ui/` is empty.
- **Tools (ADR-002, and the `frank-tools` skill):** one module per tool in `server/src/tools/`, built with `defineTool` (`define.ts`) and added to the `tools` array in `index.ts`. `defineTool` supplies the output shape, `outputSchema`, read-only annotations and error wrapping. SDK 1.30.1 validates arguments before the handler runs and returns a failure as an `isError` result; `test/mcp-http.test.ts` pins that behaviour. `test/conventions.test.ts` enforces naming and schema rules for every registered tool. Names are `verb_noun`, and the verb must be one of **`get`, `list`, `search`, `summarize`**. Inputs use zod schemas that reject unknown fields. Output is JSON with a top-level `summary` string plus typed fields. Errors come back as `isError: true` with a plain-language message and never a stack trace. **Read-only:** no tool mutates Azure, GitHub, or the filesystem beyond temp space. Needing a write tool means writing a new ADR, not adding the tool. The first tool is `get_status`.
- **Azure reads (ADR-009, written in class; ADR-010):** Frank uses the deploy credential at runtime. `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` and `AZURE_RESOURCE_GROUP` are injected into the container, and `DefaultAzureCredential` reads them. The resource group comes **only from the environment**. There is deliberately no tool parameter for it, so a caller can't redirect Frank.
- **`/mcp` is unauthenticated**, and that's deliberate. ADR-007 is **Rejected**. Read it for the reasoning; don't implement it.

## Build and deploy pipeline

- `Dockerfile` (repo root, ADR-006) is multi-stage: ui-build, then server-build, then runtime. **The Docker build is the test gate on `main`**: both stages run `npm test`, so a failing suite fails the image and nothing deploys. The ui stage skips itself if `ui/package.json` is absent. The server stage needs `server/package.json` and `server/package-lock.json`. The image runs as `node` on port 3000, which must match `--target-port` in `deploy.yml` and the `PORT` default in `config.ts`.
- `.github/workflows/deploy.yml`: PRs run `build-server` and `build-ui` (`npm ci && npm test && npm run build`). Each job is a no-op until that package's `package-lock.json` is committed. Pushes to `main` skip those jobs and run `deploy`, which has no `needs:` on purpose. `deploy` fetches the classroom credential from `CREDENTIAL_URL` (ADR-010), runs `az acr build`, then `az containerapp create` or `update`. **Don't switch it to `az containerapp up --source`**, which crashes on some azure-cli builds. The app is named `frank-<github owner>`. A fork-level `AZURE_CREDENTIALS` secret overrides the fetch.
- The resource group, registry and environment are committed or discovered. They aren't secrets, and students set up nothing.

## ADR workflow (ADR-000)

- New ADRs go through `/adr <title>` (`.claude/commands/adr.md`). Copy `docs/adr/template.md`, take the next number, set Status: Proposed, and keep it to one page. Update the ADR tables in **both** `docs/adr/README.md` and `README.md`. Run the draft past the `adr-reviewer` agent, and leave it uncommitted, because a human decides.
- **Accepted ADRs are immutable.** To change one, write a new ADR that supersedes it (wholly, or clause by clause). The only allowed edit to an old ADR is its Status line, to record the supersession.
- Several ADRs are partly superseded (003, 004 and 005 by 006; 006's credential model by 010). Check each ADR's Status line to see which clauses still apply. For example, ADR-004's managed identity and Static Web Apps are gone, but its scale-to-zero, `/healthz` probe and single region still apply.

## Repo agents in `.claude/`

Every agent is limited to `Read`, `Grep` and `Glob`:

- `adr-reviewer` (opus): reviews ADRs.
- `tool-conventions` (haiku): audits `server/src/tools/` against ADR-002. Run it after tool changes.
- `secret-scanner` (haiku): run it before commits and PRs.

## Guardrails

- Never commit credentials, and never put them in `CLAUDE.md`, ADRs, skills or test fixtures. This includes the classroom credential, whose channel is the URL and never a file. `.env*` files are gitignored, except `.env.example`.
- Pushing to `main` deploys to Azure. Work on branches and open PRs.
