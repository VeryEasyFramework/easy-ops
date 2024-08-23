import { prettyDuration } from "@vef/string-utils";
import type { CommandOutput } from "#/commandSession.ts";
import {
  OpGroup,
  OpTask,
  type OpTaskOptions,
  type TaskResult,
  type ValidationResult,
} from "#/opTask.ts";
import { EasyOps } from "#/easyOp.ts";

type GitCommand = "clone" | "pull" | "fetch" | "push" | "commit" | "checkout";

interface GitTaskOptions extends OpTaskOptions {
  repoPath?: string;
  remote?: string;
  branch?: string;
}
// class GitTask extends OpTask {
//   taskName: string;
//   command: GitCommand;
//   description: string;
//   declare options: GitTaskOptions;
//   validateStatus: (result: CommandOutput) => ValidationResult;
//   constructor(config: {
//     taskName: string;
//     command: GitCommand;
//     validateStatus: (result: CommandOutput) => ValidationResult;
//     description: string;
//   }) {
//     super();
//     this.taskName = config.taskName;
//     this.command = config.command;
//     this.description = config.description;
//     this.validateStatus = config.validateStatus;
//   }

//   async run(options: GitTaskOptions): Promise<TaskResult> {
//     this.options = options;
//     const command = `git ${this.command}`;
//     const startTime = new Date();
//     const results = await this.op.session.runCommand(command);

//     const validationResult = this.validateStatus(results);
//     const taskResult: TaskResult = {
//       ...validationResult,
//       timeStarted: startTime,
//       timeEnded: new Date(),
//       taskName: this.taskName,
//       duration: "",
//     };
//     const duration = taskResult.timeEnded.getTime() -
//       taskResult.timeStarted.getTime();
//     taskResult.duration = prettyDuration(duration);
//     console.log(taskResult);
//     return taskResult;
//   }
// }

export interface GitOpMap {
  pull: GitTaskOptions;
  clone: GitTaskOptions;
  checkout: GitTaskOptions;
  fetch: GitTaskOptions;
  push: GitTaskOptions;
  commit: GitTaskOptions;
}

type GitTask = (options: GitTaskOptions) => Promise<TaskResult>;
export type GitOp =
  & {
    [K in keyof GitOpMap]: GitTask;
  }
  & ThisType<EasyOps>;

const result: TaskResult = {
  taskName: "Git Pull",
  timeStarted: new Date(),
  timeEnded: new Date(),
  duration: 0,
  message: "",
  status: "success",
  stderr: [],
  stdout: [],
};
export const gitOp: GitOp = {
  async checkout(options: GitTaskOptions) {
    return result;
  },
  async clone(options: GitTaskOptions) {
    return result;
  },
  async commit(options: GitTaskOptions) {
    return result;
  },
  async fetch(options: GitTaskOptions) {
    return result;
  },
  async pull(options: GitTaskOptions) {
    return result;
  },
  async push(options: GitTaskOptions) {
    return result;
  },
};
// export class GitOps extends OpGroup<GitTask> {
//   readonly groupName = "Git";
//   readonly description = "Git operations";

//   tasks: Record<GitCommand, GitTask> = {
//     pull: new GitTask({
//       taskName: "Git Pull",
//       command: "pull",
//       description: "Pull changes from the remote repository",
//       validateStatus: (result) => {
//         const output: ValidationResult = {
//           stderr: result.stderr,
//           stdout: result.stdout,
//           status: "pending",
//           message: "",
//         };
//         if (result.stderr.length) {
//           // houston we have a problem
//           output.message = "Houston we have a problem";
//           output.status = "error";
//           return output;
//         }
//         // get the first line of stdout
//         const line = result.stdout[0];
//         if (line.includes("Already up to date")) {
//           output.message = "No changes to pull";
//           output.status = "noChanges";
//           return output;
//         }
//         output.message = "Success";
//         output.status = "success";
//         return output;
//       },
//     }),
//     clone: new GitTask(
//       {
//         taskName: "Git Clone",
//         command: "clone",
//         description: "Clone a remote repository",
//         validateStatus: (result) => {
//           return {
//             message: "Success",
//             status: "success",
//             stderr: result.stderr,
//             stdout: result.stdout,
//           };
//         },
//       },
//     ),
//     checkout: new GitTask(
//       {
//         taskName: "Git Checkout",
//         command: "checkout",
//         description: "Checkout a branch",
//         validateStatus: (result) => {
//           return {
//             message: "Success",
//             status: "success",
//             stderr: result.stderr,
//             stdout: result.stdout,
//           };
//         },
//       },
//     ),
//     fetch: new GitTask(
//       {
//         taskName: "Git Fetch",
//         command: "fetch",
//         description: "Fetch changes from the remote repository",
//         validateStatus: (result) => {
//           return {
//             message: "Success",
//             status: "success",
//             stderr: result.stderr,
//             stdout: result.stdout,
//           };
//         },
//       },
//     ),
//     push: new GitTask(
//       {
//         taskName: "Git Push",
//         command: "push",
//         description: "Push changes to the remote repository",
//         validateStatus: (result) => {
//           return {
//             message: "Success",
//             status: "success",
//             stderr: result.stderr,
//             stdout: result.stdout,
//           };
//         },
//       },
//     ),
//     commit: new GitTask(
//       {
//         command: "commit",
//         description: "Commit changes to the local repository",
//         taskName: "Git Commit",
//         validateStatus: (result) => {
//           return {
//             message: "Success",
//             status: "success",
//             stderr: result.stderr,
//             stdout: result.stdout,
//           };
//         },
//       },
//     ),
//   };
// }
