import { tool } from "ai";
import { z } from "zod";
import { Bash, OverlayFs } from "just-bash";
import type { ToolContext } from "./types.js";

export function createBashTool(context: ToolContext) {
  const { projectRoot } = context;
  const fs = projectRoot ? new OverlayFs({ root: projectRoot }) : undefined;
  const bash = new Bash({ fs, cwd: projectRoot ?? "/tmp" });

  return tool({
    description: `Execute bash commands in a sandboxed environment.${projectRoot ? ` The filesystem is rooted at ${projectRoot}.` : ""} Use this to explore files, search content, and analyze codebases. Available commands include: ls, cat, grep, find, head, tail, wc, sort, pwd, cd, echo, and more.`,
    inputSchema: z.object({
      command: z.string().describe("The bash command to execute"),
    }),
    execute: async ({ command }) => {
      const result = await bash.exec(command);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },
  });
}
