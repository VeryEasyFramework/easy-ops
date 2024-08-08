import { runCommand } from "@vef/easy-command";
import { SSHSession } from "../src/ssh/sshConnect.ts";
import { ConnectionReader } from "../src/ssh/connectionReader.ts";

export class EasyOp {
  title: string = "EasyOp";

  description: string =
    "EasyOp is a simple and easy to use library for developers.";
  constructor() {
    console.log("EasyOp");
  }
}

const session = new SSHSession({
  host: "checker.veracityads.com",
  user: "ubuntu",
});

await session.connect();

console.log("Connected");
