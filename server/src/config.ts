import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// All configuration comes from environment variables (ADR-001). Nothing with a
// value in it lives in a file.

/** The package root: `server/` in development, `/app` in the container. */
export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const EnvSchema = z.object({
  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3000),
});

export interface Config {
  port: number;
  /** Built Cloudscape console. The Dockerfile copies ui/dist here (ADR-006). */
  publicDir: string;
  version: string;
}

function readVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
    version?: string;
  };
  return pkg.version ?? "0.0.0";
}

/**
 * Parse the environment once at boot. An invalid value fails here, with a
 * message a person can act on, rather than at the first request.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Frank cannot start: invalid environment (${problems})`);
  }
  return {
    port: parsed.data.PORT,
    publicDir: resolve(packageRoot, "public"),
    version: readVersion(),
  };
}
