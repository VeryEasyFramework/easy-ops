import { printUtils } from "@vef/easy-cli";

import { BytesMessage, BytesMessageReader } from "@vef/string-utils";

export interface CommandOutput {
  stdout: string[];
  stderr: string[];
  cwd: string;
}
export class CommandSession {
  sessionType: "ssh" | "local" = "local";
  private stdReader!: BytesMessageReader;
  private errReader!: BytesMessageReader;
  private stdin!: WritableStream;
  private writer!: WritableStreamDefaultWriter<Uint8Array>;
  private decoder = new TextDecoder();
  private session: Deno.Command;
  private process!: Deno.ChildProcess;
  private _ready = false;
  private cwd = "";
  os = Deno.build.os;
  private sendLocked = false;

  private output: CommandOutput;
  private stdResult: Uint8Array = new Uint8Array();
  private errResult: Uint8Array = new Uint8Array();
  private abort = new AbortController();
  constructor(sessionType?: "ssh" | "local", options?: {
    host: string;
    username: string;
    cwd?: string;
    port?: number;
    password?: string;
    privateKey?: string;
  }) {
    this.sessionType = sessionType || "local";
    this.output = {
      stdout: [],
      stderr: [],
      cwd: "",
    };
    const startCommand = {
      command: "",
      args: [],
    } as { command: string; args: string[] };
    if (this.sessionType === "local") {
      // get the os type
      switch (this.os) {
        case "windows":
          // use powershell
          startCommand.command = "powershell";
          startCommand.args = ["-NoExit"];
          break;
        case "linux":
          // use bash
          startCommand.command = "bash";
          // startCommand.args = ["-i"];
          break;
        case "darwin":
          // use bash
          startCommand.command = "bash";
          // startCommand.args = ["-i"];
          break;
        default:
          throw new Error(`Unsupported OS: ${this.os}`);
      }
    }
    if (this.sessionType === "ssh") {
      if (!options) {
        throw new Error("Options are required for SSH session");
      }

      const host = options.host;
      const username = options.username;
      const port = options.port || 22;
      switch (this.os) {
        case "windows":
          throw new Error("SSH is not supported on Windows");
        case "linux" || "darwin":
          startCommand.command = "ssh";
          startCommand.args = [
            `${username}@${host}`,
            "-p",
            port.toString(),
          ];
          break;
        default:
          throw new Error(`Unsupported OS: ${this.os}`);
      }
    }

    this.abort.signal.onabort = () => {
      printUtils.println("Command aborted", "red");
      Deno.exit(1);
    };

    this.session = new Deno.Command(startCommand.command, {
      args: startCommand.args,
      stderr: "piped",
      stdout: "piped",
      stdin: "piped",
      signal: this.abort.signal,
    });
  }
  async ready(): Promise<void> {
    while (!this._ready) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  async sendingAvailable() {
    while (this.sendLocked) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.sendLocked = true;
  }
  private decode(data: Uint8Array) {
    return this.decoder.decode(data);
  }
  get done(): Promise<Deno.CommandStatus> {
    return this.process.status;
  }
  private async sendCommand(command: string, noOutput?: boolean) {
    await this.sendingAvailable();
    if (!noOutput) {
      await this.ready();
    }

    this.sendLocked = true;
    this._ready = false;
    this.stdResult = new Uint8Array();
    this.errResult = new Uint8Array();
    const message = new BytesMessage();
    message.addString(command);
    message.addControlChar("LF");
    this.writer.write(message.content);
    if (!noOutput) {
      await this.ready();
    }
    this.sendLocked = false;
    if (noOutput) {
      this._ready = true;
    }
  }

  private setOutput() {
    this.output.cwd = "";
    const stdout = this.decode(this.stdResult);
    const stderr = this.decode(this.errResult);
    stdout.split("\n").forEach((line) => {
      if (line != "") {
        this.output.stdout.push(line);
      }
    });

    stderr.split("\n").forEach((line) => {
      if (line != "") {
        this.output.stderr.push(line);
      }
    });
    return this.output;
  }

  async runCommand(command: string, noOutput?: boolean) {
    await this.sendCommand(command, noOutput);
    const result = this.setOutput();
    const cwd = await this.getCWD();
    result.cwd = cwd;
    return result;
  }
  close() {
    this.writer.releaseLock();
    this.stdin.close();
  }
  async start() {
    this.process = this.session.spawn();
    this.stdReader = new BytesMessageReader(this.process.stdout);
    this.errReader = new BytesMessageReader(this.process.stderr);
    this.stdin = this.process.stdin;
    this.writer = this.stdin.getWriter();

    this.stdReader.onOutput((data) => {
      this.stdResult = new Uint8Array([...this.stdResult, ...data]);
      if (!this._ready) {
        this._ready = true;
      }
    });
    this.errReader.onOutput((data) => {
      this.errResult = new Uint8Array([...this.errResult, ...data]);
    });
    if (this.sessionType === "local") {
      this._ready = true;
    }
    await this.ready();
  }

  async getCWD() {
    this.cwd = "";
    await this.sendCommand("pwd");
    const result = this.stdResult;
    this.cwd = this.decode(result).trim();
    return this.cwd;
  }
}
