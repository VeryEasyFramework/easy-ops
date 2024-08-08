import { ConnectionReader } from "./connectionReader.ts";

interface Credentials {
  user: string;
  host: string;
  port?: number;
}

const SSH_MSG = {
  DISCONNECT: 1,
  IGNORE: 2,
  UNIMPLEMENTED: 3,
  DEBUG: 4,
  SERVICE_REQUEST: 5,
  SERVICE_ACCEPT: 6,
  KEXINIT: 20,
  NEWKEYS: 21,
};
export class SSHSession {
  credentials: Credentials;
  connection: boolean = false;
  reader!: ConnectionReader;

  algorithms: Algorithms = {
    cookie: new Uint8Array(),
    kexAlgorithms: [],
    serverHostKeyAlgorithms: [],
    clientToServer: {
      encryptionAlgorithms: [],
      macAlgorithms: [],
      compressionAlgorithms: [],
      languages: [],
    },
    serverToClient: {
      encryptionAlgorithms: [],
      macAlgorithms: [],
      compressionAlgorithms: [],
      languages: [],
    },
  };

  info: {
    protocol: string;
    version: string;
    software: string;
    comment: string;
  };
  static decoder = new TextDecoder();

  static decode(data: Uint8Array) {
    return this.decoder.decode(data);
  }
  conn!: Deno.TcpConn;
  constructor(config: Credentials) {
    this.credentials = config;
    this.info = {
      protocol: "",
      version: "",
      software: "",
      comment: "",
    };
  }

  parseInitialMessage() {
    const protocol = this.reader.readUntilChar("-");
    if (!protocol) {
      throw new Error(`Invalid protocol`);
    }
    this.info.protocol = protocol;
    const version = this.reader.readUntilChar("-");
    if (!version) {
      throw new Error(`Invalid version`);
    }
    this.info.version = version;
    const software = this.reader.readUntil("SP");
    if (!software) {
      throw new Error(`Invalid software`);
    }
    this.info.software = software;

    this.info.comment = this.reader.readUntilNewLine();

    console.log(this.info);
  }

  async sendInitialMessage() {
    const message = `SSH-2.0-Deno\r\n`;
    const data = new TextEncoder().encode(message);
    await this.conn.write(data);
  }
  parseAlgorithmList() {
    this.algorithms.cookie = this.reader.readBytes(16);
    this.algorithms.kexAlgorithms = this.reader.readUntilNull().split(",");
    this.algorithms.serverHostKeyAlgorithms = this.reader.readUntilNull().split(
      ",",
    );
    this.algorithms.clientToServer.encryptionAlgorithms = this.reader
      .readUntilNull()
      .split(
        ",",
      );

    this.algorithms.serverToClient.encryptionAlgorithms = this.reader
      .readUntilNull()
      .split(",");
    this.algorithms.clientToServer.macAlgorithms = this.reader.readUntilNull()
      .split(
        ",",
      );
    this.algorithms.serverToClient.macAlgorithms = this.reader.readUntilNull()
      .split(
        ",",
      );
    this.algorithms.clientToServer.compressionAlgorithms = this.reader
      .readUntilNull()
      .split(
        ",",
      );
    this.algorithms.serverToClient.compressionAlgorithms = this.reader
      .readUntilNull()
      .split(
        ",",
      );
    this.algorithms.clientToServer.languages = this.reader.readUntilNull()
      .split(
        ",",
      );
    this.algorithms.serverToClient.languages = this.reader.readUntilNull()
      .split(
        ",",
      );
  }
  async connect() {
    if (this.connection) {
      return;
    }
    this.conn = await Deno.connect({
      hostname: this.credentials.host,
      port: this.credentials.port || 22,
    });
    this.conn.setKeepAlive(true);
    this.reader = new ConnectionReader(this.conn);
    this.connection = true;
    await this.reader.loadContent();

    this.parseInitialMessage();
    await this.sendInitialMessage();
    await this.reader.loadContent();
    const packet = this.reader.readPacket();

    const msgType = this.reader.readByte();
    console.log("Message type", msgType);
    switch (msgType) {
      case SSH_MSG.KEXINIT:
        this.parseAlgorithmList();
        break;
      default:
        console.log("Unknown message type", msgType);
    }
  }
}

interface Algorithms {
  cookie: Uint8Array;
  kexAlgorithms: string[];
  serverHostKeyAlgorithms: string[];
  clientToServer: {
    encryptionAlgorithms: string[];
    macAlgorithms: string[];
    compressionAlgorithms: string[];
    languages: string[];
  };
  serverToClient: {
    encryptionAlgorithms: string[];
    macAlgorithms: string[];
    compressionAlgorithms: string[];
    languages: string[];
  };
}
