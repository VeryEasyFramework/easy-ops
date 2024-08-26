import { prettyDuration } from "@vef/string-utils";
import type { CommandOutput, CommandSession } from "#/commandSession.ts";
import {
  OpGroup,
  OpTask,
  type OpTaskOptions,
  type TaskResult,
  type ValidationResult,
} from "#/opTask.ts";
import type { EasyOps } from "#/easyOp.ts";
type DenoCommand =
  | "run"
  | "compile";

interface DenoArgs {
}

type DenoPermission =
  | "read"
  | "write"
  | "net"
  | "env"
  | "run"
  | "plugin"
  | "hrtime"
  | "all";

type DenoUnstableFlag = "net" | "broadcast-channel";

type OutputTarget =
  | "x86_64-unknown-linux-gnu"
  | "aarch64-unknown-linux-gnu"
  | "x86_64-pc-windows-msvc"
  | "x86_64-apple-darwin"
  | "aarch64-apple-darwin";

interface DenoOptions {
  permission?: {
    allow?: DenoPermission[];
    deny?: DenoPermission[];
  };
  unstable?: DenoUnstableFlag[];
}

interface DenoCompileOptions extends DenoOptions {
  output?: string;
  target?: OutputTarget;
  script: string;
}

interface DenoRunOptions extends DenoOptions {
  script: string;
}
type DenoOp = {
  run: (
    session: CommandSession,
    options: DenoRunOptions,
  ) => Promise<TaskResult>;
  compile: (
    session: CommandSession,
    options: DenoCompileOptions,
  ) => Promise<TaskResult>;
} & ThisType<EasyOps>;

export interface DenoOpMap
  extends Record<DenoCommand, DenoRunOptions | DenoCompileOptions> {
  run: DenoRunOptions;
  compile: DenoCompileOptions;
}

export type {
  DenoArgs,
  DenoCommand,
  DenoCompileOptions,
  DenoOp,
  DenoOptions,
  DenoPermission,
  DenoRunOptions,
  DenoUnstableFlag,
  OutputTarget,
};

const permissionMap: Record<DenoPermission, string> = {
  read: "--allow-read",
  write: "--allow-write",
  net: "--allow-net",
  env: "--allow-env",
  run: "--allow-run",
  plugin: "--allow-plugin",
  hrtime: "--allow-hrtime",
  all: "--allow-all",
};

export function getDenoOp(): DenoOp {
  return {
    async compile(session: CommandSession, options: DenoCompileOptions) {
      const args = ["compile"];
      if (options.permission) {
        for (const permission of options.permission.allow ?? []) {
          args.push(permissionMap[permission]);
        }
        for (const permission of options.permission.deny ?? []) {
          args.push(`--deny-${permission}`);
        }
      }
      if (options.unstable) {
        for (const flag of options.unstable ?? []) {
          args.push(`--unstable-${flag}`);
        }
      }
      if (options.target) {
        args.push("--target", options.target);
      }
      if (options.output) {
        args.push("--output", options.output);
      }
      args.push(options.script);
      const command = `deno ${args.join(" ")}`;
      const startTime = new Date();

      const results = await session.runCommand(command, true);
      let status: "success" | "failed" = "success";
      if (results.stderr.length > 0) {
        status = "failed";
      }
      return {
        duration: 0,
        message: "",
        stderr: results.stderr,
        stdout: results.stdout,
        status: "success",
        taskName: "deno compile",
        timeEnded: new Date(),
        timeStarted: startTime,
      };
    },
    async run(session: CommandSession, options: DenoRunOptions) {
      const args = ["run"];
      if (options.permission) {
        for (const permission of options.permission.allow ?? []) {
          args.push(permissionMap[permission]);
        }
      }
      if (options.unstable) {
        for (const flag of options.unstable ?? []) {
          args.push(`--unstable-${flag}`);
        }
      }
      args.push(options.script);
      const command = `deno ${args.join(" ")}`;
      const startTime = new Date();

      const results = await session.runCommand(command, true);

      return {
        duration: 0,
        message: "",
        stderr: results.stderr,
        stdout: results.stdout,
        status: "success",
        taskName: "deno run",
        timeEnded: new Date(),
        timeStarted: startTime,
      };
    },
  };
}
