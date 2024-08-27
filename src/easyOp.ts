import { CommandSession } from "#/commandSession.ts";
import type { TaskResult } from "#/opTask.ts";
import { type GitOp, gitOp, type GitOpMap } from "#/git/gitOp.ts";
import { type DenoOp, type DenoOpMap, getDenoOp } from "#/deno/denoOp.ts";

type MapKeys<T> = T extends Record<infer K, any> ? K : never;
export interface OpsMap {
  git: GitOpMap;
  deno: DenoOpMap;
}

interface Ops {
  git: Record<keyof GitOpMap, GitOp[keyof GitOpMap]>;
  deno: Record<keyof DenoOpMap, DenoOp[keyof DenoOpMap]>;
}

export class EasyOps {
  session: CommandSession;
  ops: Ops;
  tasks: Array<() => Promise<TaskResult>> = [];
  constructor(options?: {
    sessionType?: "ssh" | "local";
    cwd?: string;
  }) {
    this.session = new CommandSession(options?.sessionType || "local", {
      cwd: options?.cwd,
    });
    this.ops = {
      git: gitOp,
      deno: getDenoOp(),
    };
    // this.ops.deno.compile.bind(this);
    // this.ops.deno.run.bind(this);
    this.ops.git.pull.bind(this);
    this.ops.git.fetch.bind(this);
    this.ops.git.push.bind(this);
    this.ops.git.commit.bind(this);
    this.ops.git.checkout.bind(this);
  }
  async init() {
    await this.session.start();
  }

  queue<
    G extends keyof Ops,
    C extends keyof Ops[G],
    O extends MapKeys<OpsMap[G]>,
  >(
    group: G,
    command: C,
    options: O extends keyof OpsMap[G] ? OpsMap[G][O] : never,
  ) {
    const action = this.ops[group][command] as (
      session: CommandSession,
      options: O,
    ) => Promise<TaskResult>;
    const task = async (): Promise<TaskResult> => {
      return await action(this.session, options as O);
    };

    this.addTask(task);
  }
  async run(): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    for (const task of this.tasks) {
      const result = await task();
      results.push(result);
    }
    return results;
  }

  async runTask<
    G extends keyof Ops,
    C extends keyof Ops[G],
    O extends MapKeys<OpsMap[G]>,
  >(
    group: G,
    command: C,
    options: O extends keyof OpsMap[G] ? OpsMap[G][O] : never,
  ): Promise<TaskResult> {
    const action = this.ops[group][command] as (
      session: CommandSession,
      options: O,
    ) => Promise<TaskResult>;
    return await action(this.session, options as O);
  }

  addTask(task: () => Promise<TaskResult>) {
    this.tasks.push(task);
  }
}
