import { z } from "zod";
import { defineTool } from "./define.js";

export const getStatus = defineTool({
  name: "get_status",
  description:
    "Returns Frank's version, how long he has been running, and a greeting. " +
    "Use it to check that Frank is reachable and which build is deployed; it says nothing about Azure.",
  input: z.strictObject({}),
  output: z.object({
    summary: z.string().describe("One-sentence status a person can read."),
    version: z.string().describe("Frank's package version."),
    uptimeSeconds: z.number().int().nonnegative().describe("Seconds since this Frank process started."),
    greeting: z.string().describe("A hello from Frank."),
  }),
  handler: (_args, { version, startedAt }) => {
    const uptimeSeconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
    return {
      summary: `Frank ${version} is up and has been running for ${uptimeSeconds}s.`,
      version,
      uptimeSeconds,
      greeting: "Hi, I'm Frank. I can tell you about my own world, but I never change it.",
    };
  },
});
