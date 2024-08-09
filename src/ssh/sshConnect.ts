import { BytesMessage, generateRandomString } from "@vef/string-utils";
import { ConnectionReader } from "./connectionReader.ts";
import { PacketSender } from "./packetSender.ts";
import { Packetizer } from "./packetizer.ts";

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
  packetSender!: PacketSender;

  transportLayer!: TransportLayer;

  hostAlgorithms: Algorithms = {
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

  clientAlgorithms: Algorithms = {
    cookie: new TextEncoder().encode(generateRandomString(16)),
    kexAlgorithms: [""],
    serverHostKeyAlgorithms: [
      "curve25519-sha256",
      "curve25519-sha256@libssh.org",
      "ecdh-sha2-nistp256",
      "ecdh-sha2-nistp384",
      "ecdh-sha2-nistp521",
      "sntrup761x25519-sha512@openssh.com",
      "diffie-hellman-group-exchange-sha256",
      "diffie-hellman-group16-sha512",
      "diffie-hellman-group18-sha512",
      "diffie-hellman-group14-sha256",
      "kex-strict-s-v00@openssh.com",
    ],
    clientToServer: {
      encryptionAlgorithms: [
        "rsa-sha2-512",
        "rsa-sha2-256",
        "ecdsa-sha2-nistp256",
        "ssh-ed25519",
      ],
      macAlgorithms: [
        "chacha20-poly1305@openssh.com",
        "aes128-ctr",
        "aes192-ctr",
        "aes256-ctr",
        "aes128-gcm@openssh.com",
        "aes256-gcm@openssh.com",
      ],
      compressionAlgorithms: [
        "umac-64-etm@openssh.com",
        "umac-128-etm@openssh.com",
        "hmac-sha2-256-etm@openssh.com",
        "hmac-sha2-512-etm@openssh.com",
        "hmac-sha1-etm@openssh.com",
        "umac-64@openssh.com",
        "umac-128@openssh.com",
        "hmac-sha2-256",
        "hmac-sha2-512",
        "hmac-sha1",
      ],
      languages: ["none"],
    },
    serverToClient: {
      encryptionAlgorithms: [
        "chacha20-poly1305@openssh.com",
        "aes128-ctr",
        "aes192-ctr",
        "aes256-ctr",
        "aes128-gcm@openssh.com",
        "aes256-gcm@openssh.com",
      ],
      macAlgorithms: [
        "umac-64-etm@openssh.com",
        "umac-128-etm@openssh.com",
        "hmac-sha2-256-etm@openssh.com",
        "hmac-sha2-512-etm@openssh.com",
        "hmac-sha1-etm@openssh.com",
        "umac-64@openssh.com",
        "umac-128@openssh.com",
        "hmac-sha2-256",
        "hmac-sha2-512",
        "hmac-sha1",
      ],
      compressionAlgorithms: ["none"],
      languages: [""],
    },
  };

  message = [
    "",
  ];

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
    const rest = this.reader.data.slice(this.reader.offset);
    console.log("Rest", rest);
  }

  async sendInitialMessage() {
    const message = `SSH-2.0-Deno\r\n`;
    const data = new TextEncoder().encode(message);
    await this.conn.write(data);
  }

  async sendKexInit() {
    console.log("Sending KEXINIT");
    const message = [
      this.clientAlgorithms.kexAlgorithms.join(","),
      this.clientAlgorithms.serverHostKeyAlgorithms.join(","),
      this.clientAlgorithms.clientToServer.encryptionAlgorithms.join(","),
      this.clientAlgorithms.serverToClient.encryptionAlgorithms.join(","),
      this.clientAlgorithms.clientToServer.macAlgorithms.join(","),
      this.clientAlgorithms.serverToClient.macAlgorithms.join(","),
      this.clientAlgorithms.clientToServer.compressionAlgorithms.join(","),
      this.clientAlgorithms.serverToClient.compressionAlgorithms.join(","),
      this.clientAlgorithms.clientToServer.languages.join(","),
      this.clientAlgorithms.serverToClient.languages.join(","),
    ];

    const data: number[] = [];
    message.forEach((m) => {
      data.push(...new TextEncoder().encode(m));
      data.push(0x00);
      data.push(0x00);
      data.push(0x00);
    });

    const cookie = this.clientAlgorithms.cookie;

    const sendMessage = new Uint8Array([
      SSH_MSG.KEXINIT,
      ...cookie,
      ...data,
    ]);
    console.log("Message", sendMessage);
    console.log("Message length", SSHSession.decode(sendMessage));
    await this.packetSender.sendPacket(sendMessage);
  }
  parseAlgorithmList() {
    this.hostAlgorithms.cookie = this.reader.readBytes(16);
    this.hostAlgorithms.kexAlgorithms = this.reader.readUntilNull().split(",");
    this.hostAlgorithms.serverHostKeyAlgorithms = this.reader.readUntilNull()
      .split(
        ",",
      );
    this.hostAlgorithms.clientToServer.encryptionAlgorithms = this.reader
      .readUntilNull()
      .split(
        ",",
      );

    this.hostAlgorithms.serverToClient.encryptionAlgorithms = this.reader
      .readUntilNull()
      .split(",");
    this.hostAlgorithms.clientToServer.macAlgorithms = this.reader
      .readUntilNull()
      .split(
        ",",
      );
    this.hostAlgorithms.serverToClient.macAlgorithms = this.reader
      .readUntilNull()
      .split(
        ",",
      );
    this.hostAlgorithms.clientToServer.compressionAlgorithms = this.reader
      .readUntilNull()
      .split(
        ",",
      );
    this.hostAlgorithms.serverToClient.compressionAlgorithms = this.reader
      .readUntilNull()
      .split(
        ",",
      );
    this.hostAlgorithms.clientToServer.languages = this.reader.readUntilNull()
      .split(
        ",",
      );
    this.hostAlgorithms.serverToClient.languages = this.reader.readUntilNull()
      .split(
        ",",
      );
    this.hostAlgorithms.fistKexFollows = this.reader.readByte();
    this.hostAlgorithms.RESERVED = this.reader.readByte();
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

    this.transportLayer = new TransportLayer(this.conn);
    this.reader = new ConnectionReader(this.conn);
    this.packetSender = new PacketSender(this.conn);
    this.connection = true;
    await this.reader.loadContent();

    this.parseInitialMessage();
    await this.sendInitialMessage();
    this.transportLayer.sendKexInit();

    const packet = await this.reader.readPacket();

    const msgType = this.reader.readByte();
    console.log("Message type", msgType);
    switch (msgType) {
      case SSH_MSG.KEXINIT: {
        this.parseAlgorithmList();
        console.log(this.hostAlgorithms);
        // await this.sendKexInit();
        // this.packetSender.sendPacket(packet.payload);
        // this.transportLayer.sendKexInit();
        await this.reader.loadContent();
        console.log(this.reader.data);
        // // const packet = await this.reader.readPacket();
        // const msgType = this.reader.readByte();
        // console.log("Message type", msgType);
        // console.log("Packet", packet);
        break;
      }
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
  fistKexFollows?: number;
  RESERVED?: number;
}

export class TransportLayer {
  packetizer: Packetizer;
  conn: Deno.Conn;
  constructor(conn: Deno.Conn) {
    this.conn = conn;
    this.packetizer = new Packetizer(conn);
  }

  _preferred_ciphers = [
    "aes128-ctr",
    "aes192-ctr",
    "aes256-ctr",
    "aes128-cbc",
    "aes192-cbc",
    "aes256-cbc",
    "3des-cbc",
  ];
  _preferred_macs = [
    "hmac-sha2-256",
    "hmac-sha2-512",
    "hmac-sha2-256-etm@openssh.com",
    "hmac-sha2-512-etm@openssh.com",
    "hmac-sha1",
    "hmac-md5",
    "hmac-sha1-96",
    "hmac-md5-96",
  ];
  // ~= HostKeyAlgorithms in OpenSSH land
  _preferred_keys = [
    // "ssh-ed25519",
    // "ecdsa-sha2-nistp256",
    // "ecdsa-sha2-nistp384",
    // "ecdsa-sha2-nistp521",
    "rsa-sha2-512",
    "rsa-sha2-256",
    "ssh-rsa",
    "ssh-dss",
  ];
  // ~= PubKeyAcceptedAlgorithms
  _preferred_pubkeys = [
    "ssh-ed25519",
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
    "rsa-sha2-512",
    "rsa-sha2-256",
    "ssh-rsa",
    "ssh-dss",
  ];
  _preferred_kex = [
    "ecdh-sha2-nistp256",
    "ecdh-sha2-nistp384",
    "ecdh-sha2-nistp521",
    "diffie-hellman-group16-sha512",
    "diffie-hellman-group-exchange-sha256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha1",
    "diffie-hellman-group14-sha1",
    "diffie-hellman-group1-sha1",
  ];
  _preferred_gsskex = [
    "gss-gex-sha1-toWM5Slw5Ew8Mqkay+al2g==",
    "gss-group14-sha1-toWM5Slw5Ew8Mqkay+al2g==",
    "gss-group1-sha1-toWM5Slw5Ew8Mqkay+al2g==",
  ];
  _preferred_compression = ["none"];
  localKexInit!: Uint8Array;
  async sendMessage(message: Uint8Array) {
    await this.conn.write(message);
  }

  private generateCookie() {
    const cookie = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      cookie[i] = Math.floor(Math.random() * 255);
    }
    return cookie;
  }
  async sendKexInit() {
    const msg = new BytesMessage();
    const kexAlgorithms = this._preferred_kex;
    kexAlgorithms.push("ext-info-c");
    msg.addByte(SSH_MSG.KEXINIT);
    msg.addBytes(this.generateCookie());
    msg.addString(kexAlgorithms.join(","));
    msg.addString(this._preferred_keys.join(","));
    msg.addString(this._preferred_ciphers.join(","));
    msg.addString(this._preferred_ciphers.join(","));
    msg.addString(this._preferred_macs.join(","));
    msg.addString(this._preferred_macs.join(","));
    msg.addString(this._preferred_compression.join(","));
    msg.addString(this._preferred_compression.join(","));
    msg.addNUL();
    msg.addNUL();
    msg.addBoolean(false);
    msg.addInt(0);
    const message = msg.content;
    this.localKexInit = message;

    await this.sendMessage(message);
  }
}
