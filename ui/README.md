# Frank's console

React 18, Vite and Cloudscape ([ADR-003](../docs/adr/ADR-003-cloudscape-ui.md)),
served by Frank himself at `/`
([ADR-006](../docs/adr/ADR-006-classroom-credentials.md)). The console calls
`/mcp` relatively. There is no Frank URL to configure, no CORS, and nothing
secret in the bundle.

## Run it

```bash
npm ci
npm run dev     # Vite on :5173, proxying /mcp and /healthz to a Frank on :3000
npm test        # vitest + jsdom; one file: npx vitest run test/schema-form.test.tsx
npm run build   # -> dist/, which the Dockerfile copies to Frank's public/
```

Start Frank first (`cd ../server && npm run dev`), or the console will say
"Frank did not answer".

### Don't set `changeOrigin` on the dev proxy

Frank refuses any `/mcp` request whose `Origin` doesn't match its `Host`. That
check is the MCP spec's DNS-rebinding protection. Vite's proxy keeps the
browser's `Host: localhost:5173` by default, which matches
`Origin: http://localhost:5173`, so requests get through.
`changeOrigin: true` rewrites `Host` to `localhost:3000`, and every console
request then gets a `403`.

## How it fits together

```
src/
  main.tsx               mounts App with the real MCP client
  App.tsx                AppLayout + SideNavigation; page state, no router
  frank/client.ts        FrankClient: the SDK client over relative /mcp
  pages/Overview.tsx     get_status output and connection health
  pages/Tools.tsx        tools/list in a Table; the selected tool's form and result
  components/SchemaForm  builds a form from a tool's JSON input schema
  components/ResultView  summary + JSON (Box variant="pre")
```

`App` takes a `FrankClient` as a prop, and the tests render it with a fake one
(`test/fake-client.ts`), so UI tests never touch the network.

A new tool on Frank shows up on the Tools page with no UI work. `SchemaForm`
handles `string`, `number`, `integer`, `boolean` and `enum` fields, and falls
back to a JSON text area for anything else.

Only `@cloudscape-design/components` and `@cloudscape-design/global-styles` are
allowed (ADR-003). That rules out `@cloudscape-design/code-view` and any second
component library.
