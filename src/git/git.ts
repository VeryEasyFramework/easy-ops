import { runCommand } from "@vef/easy-command";

type GitCommand = "add" | "commit" | "push" | "pull" | "status";

type GitCliCommand = "clone" | "init" | "config" | "remote" | "branch";

function git(
  command: "clone",
  repository: string,
  path: string,
): Promise<boolean>;
function git(command: "init"): Promise<boolean>;
function git(command: "config", key: string, value: string): Promise<boolean>;

async function git(command: string, ...args: string[]): Promise<boolean> {
  const result = await runCommand("git", {
    onStdout: (data) => {
      console.log(data);
    },
    hideOutput: true,
    args: [command, ...args],
  });

  return result.success;
}
