import { CommandSession } from "../src/commandSession.ts";
import { GitOp } from "../src/git/gitOp.ts";
import { OpGroup, TaskResult } from "../src/opTask.ts";

export class EasyOps {
  session: CommandSession;
  git: GitOp;

  tasks: Array<() => Promise<TaskResult>> = [];
  constructor() {
    this.session = new CommandSession();
    this.git = new GitOp();
    this.git.bindOp(this);
  }
  async init() {
    await this.session.start();
  }

  async run() {
    for (const task of this.tasks) {
      await this.runTask(task);
    }
  }

  private async runTask(task: () => Promise<TaskResult>) {
    const result = await task();
    console.log(result);
  }

  addTask(task: () => Promise<TaskResult>) {
    this.tasks.push(task);
  }
}

const easyOps = new EasyOps();

easyOps.init();

easyOps.git.tasks.pull.add();

easyOps.run();

// session.close();
