import type { EasyOps } from "#/easyOp.ts";

export interface OpTaskOptions {
  args?: string[];
  cwd?: string;
  env?: { [key: string]: string };
}
export abstract class OpGroup<T extends OpTask> {
  abstract groupName: string;
  abstract description: string;
  abstract tasks: Record<T["command"], T>;

  bindOp(op: EasyOps) {
    for (const task in this.tasks) {
      this.tasks[task as keyof typeof this.tasks].bindOp(op);
    }
  }

  getTask(taskName: keyof typeof this.tasks): OpTask {
    return this.tasks[taskName];
  }
}

export interface ValidationResult {
  stdout: string[];
  stderr: string[];
  message: string;
  status: "success" | "failure" | "pending" | "error" | "noChanges";
}
export interface TaskResult extends ValidationResult {
  taskName: string;

  timeStarted: Date;
  timeEnded: Date;

  duration: number | string;
}

export abstract class OpTask {
  abstract taskName: string;
  abstract command: string;
  abstract description: string;
  op!: EasyOps;

  bindOp(op: EasyOps) {
    this.op = op;
  }
  add(options?: OpTaskOptions) {
    const task = async () => {
      return await this.run(options);
    };
    this.op.addTask(task);
  }
  abstract run(options?: OpTaskOptions): Promise<TaskResult>;
  options?: OpTaskOptions;
}
