class NeedRekeyException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeedRekeyException";
  }
}

class Mutex {
  private mutex = Promise.resolve();

  lock(): Promise<() => void> {
    let begin: (unlock: () => void) => void = (unlock) => {};

    this.mutex = this.mutex.then(() => {
      return new Promise(begin);
    });

    return new Promise((res) => {
      begin = res;
    });
  }
}
class HMAC {
  private key!: CryptoKey;
  private algorithm: string;
  private data: Uint8Array[];

  private _ready: Promise<void>;

  get ready(): Promise<boolean> {
    return this._ready.then(() => true);
  }

  constructor(algorithm: string, key: Uint8Array) {
    this.algorithm = algorithm;
    this.data = [];
    this._ready = this.setKey(algorithm, key);
  }

  async setKey(algorithm: string, key: Uint8Array): Promise<void> {
    this.key = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: { name: algorithm } },
      false,
      ["sign"],
    );
  }
  update(data: Uint8Array): void {
    this.data.push(data);
  }

  async digest(): Promise<Uint8Array> {
    const concatenatedData = new Uint8Array(
      this.data.reduce((acc, val) => acc + val.length, 0),
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      this.key,
      concatenatedData,
    );
    return new Uint8Array(signature);
  }
}
export class Packetizer {
  private socket: Deno.Conn;
  private logger: any;
  private _closed: boolean;
  private dumpPackets: boolean;
  private _needRekey: boolean;
  private initCount: number;
  private remainder: Uint8Array;
  private initialKexDone: boolean;
  private sentBytes: number;
  private sentPackets: number;
  private receivedBytes: number;
  private receivedPackets: number;
  private receivedBytesOverflow: number;
  private receivedPacketsOverflow: number;
  private blockSizeOut: number;
  private blockSizeIn: number;
  private macSizeOut: number;
  private macSizeIn: number;
  private blockEngineOut: any;
  private blockEngineIn: any;
  private sdctrOut: boolean;
  private macEngineOut: any;
  private macEngineIn: any;
  private macKeyOut: Uint8Array;
  private macKeyIn: Uint8Array;
  private compressEngineOut: any;
  private compressEngineIn: any;
  private sequenceNumberOut: number;
  private sequenceNumberIn: number;
  private etmOut: boolean;
  private etmIn: boolean;
  private writeLock: any;
  private keepaliveInterval: number;
  private keepaliveLast: number;
  private keepaliveCallback: any;
  private timer: any;
  private handshakeComplete: boolean;
  private timerExpired: boolean;

  static REKEY_PACKETS = 2 ** 29;
  static REKEY_BYTES = 2 ** 29;
  static REKEY_PACKETS_OVERFLOW_MAX = 2 ** 29;
  static REKEY_BYTES_OVERFLOW_MAX = 2 ** 29;

  constructor(socket: Deno.Conn) {
    this.socket = socket;
    this.logger = null;
    this._closed = false;
    this.dumpPackets = false;
    this._needRekey = false;
    this.initCount = 0;
    this.remainder = new Uint8Array();
    this.initialKexDone = false;
    this.sentBytes = 0;
    this.sentPackets = 0;
    this.receivedBytes = 0;
    this.receivedPackets = 0;
    this.receivedBytesOverflow = 0;
    this.receivedPacketsOverflow = 0;
    this.blockSizeOut = 8;
    this.blockSizeIn = 8;
    this.macSizeOut = 0;
    this.macSizeIn = 0;
    this.blockEngineOut = null;
    this.blockEngineIn = null;
    this.sdctrOut = false;
    this.macEngineOut = null;
    this.macEngineIn = null;
    this.macKeyOut = new Uint8Array();
    this.macKeyIn = new Uint8Array();
    this.compressEngineOut = null;
    this.compressEngineIn = null;
    this.sequenceNumberOut = 0;
    this.sequenceNumberIn = 0;
    this.etmOut = false;
    this.etmIn = false;
    this.writeLock = new Mutex();
    this.keepaliveInterval = 0;
    this.keepaliveLast = Date.now();
    this.keepaliveCallback = null;
    this.timer = null;
    this.handshakeComplete = false;
    this.timerExpired = false;
  }

  get closed(): boolean {
    return this._closed;
  }

  resetSeqnoOut(): void {
    this.sequenceNumberOut = 0;
  }

  resetSeqnoIn(): void {
    this.sequenceNumberIn = 0;
  }

  setLog(log: any): void {
    this.logger = log;
  }

  setOutboundCipher(
    blockEngine: any,
    blockSize: number,
    macEngine: any,
    macSize: number,
    macKey: Uint8Array,
    sdctr: boolean = false,
    etm: boolean = false,
  ): void {
    this.blockEngineOut = blockEngine;
    this.sdctrOut = sdctr;
    this.blockSizeOut = blockSize;
    this.macEngineOut = macEngine;
    this.macSizeOut = macSize;
    this.macKeyOut = macKey;
    this.sentBytes = 0;
    this.sentPackets = 0;
    this.etmOut = etm;
    this.initCount |= 1;
    if (this.initCount === 3) {
      this._needRekey = false;
    }
  }

  setInboundCipher(
    blockEngine: any,
    blockSize: number,
    macEngine: any,
    macSize: number,
    macKey: Uint8Array,
    etm: boolean = false,
  ): void {
    this.blockEngineIn = blockEngine;
    this.blockSizeIn = blockSize;
    this.macEngineIn = macEngine;
    this.macSizeIn = macSize;
    this.macKeyIn = macKey;
    this.receivedBytes = 0;
    this.receivedPackets = 0;
    this.receivedBytesOverflow = 0;
    this.receivedPacketsOverflow = 0;
    this.etmIn = etm;
    this.initCount |= 2;
    if (this.initCount === 3) {
      this._needRekey = false;
    }
  }

  setOutboundCompressor(compressor: any): void {
    this.compressEngineOut = compressor;
  }

  setInboundCompressor(compressor: any): void {
    this.compressEngineIn = compressor;
  }

  close(): void {
    this._closed = true;
    this.socket.close();
  }

  setHexdump(hexdump: boolean): void {
    this.dumpPackets = hexdump;
  }

  getHexdump(): boolean {
    return this.dumpPackets;
  }

  getMacSizeIn(): number {
    return this.macSizeIn;
  }

  getMacSizeOut(): number {
    return this.macSizeOut;
  }

  get needRekey(): boolean {
    return this._needRekey;
  }

  setKeepalive(interval: number, callback: any): void {
    this.keepaliveInterval = interval;
    this.keepaliveCallback = callback;
    this.keepaliveLast = Date.now();
  }

  readTimer(): void {
    this.timerExpired = true;
  }

  startHandshake(timeout: number): void {
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timerExpired = true;
      }, timeout * 1000);
    }
  }

  handshakeTimedOut(): boolean {
    if (!this.timer) {
      return false;
    }
    if (this.handshakeComplete) {
      return false;
    }
    return this.timerExpired;
  }

  completeHandshake(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.handshakeComplete = true;
  }

  async readAll(n: number, checkRekey: boolean = false): Promise<Uint8Array> {
    let out = new Uint8Array();
    if (this.remainder.length > 0) {
      out = this.remainder.slice(0, n);
      this.remainder = this.remainder.slice(n);
      n -= out.length;
    }
    while (n > 0) {
      const buf = new Uint8Array(n);
      const bytesRead = await this.socket.read(buf);
      if (bytesRead === null) {
        throw new Error("EOFError");
      }
      out = new Uint8Array([...out, ...buf.slice(0, bytesRead)]);
      n -= bytesRead;
    }
    return out;
  }

  async writeAll(out: Uint8Array): Promise<void> {
    this.keepaliveLast = Date.now();
    while (out.length > 0) {
      const bytesWritten = await this.socket.write(out);
      out = out.slice(bytesWritten);
    }
  }

  async readline(timeout: number): Promise<string> {
    let buf = this.remainder;
    while (!buf.includes(10)) {
      const chunk = new Uint8Array(1024);
      const bytesRead = await this.socket.read(chunk);
      if (bytesRead === null) {
        throw new Error("EOFError");
      }
      buf = new Uint8Array([...buf, ...chunk.slice(0, bytesRead)]);
    }
    const n = buf.indexOf(10);
    this.remainder = buf.slice(n + 1);
    buf = buf.slice(0, n);
    if (buf.length > 0 && buf[buf.length - 1] === 13) {
      buf = buf.slice(0, -1);
    }
    return new TextDecoder().decode(buf);
  }

  async sendMessage(data: Uint8Array): Promise<void> {
    const cmd = data[0];
    const origLen = data.length;
    await this.writeLock.lock();
    try {
      await this.writeAll(data);
    } finally {
      this.writeLock.unlock();
    }
  }

  async readMessage(): Promise<Uint8Array> {
    const header = await this.readAll(this.blockSizeIn, true);
    let packet = header;
    if (this.blockEngineIn) {
      packet = this.blockEngineIn.decrypt(packet);
    }
    const padding = packet[0];
    const payload = packet.slice(1, packet.length - padding);
    if (this.compressEngineIn) {
      // Decompress payload if needed
    }
    const msg = payload.slice(1);
    this.sequenceNumberIn = (this.sequenceNumberIn + 1) & 0xffffffff;
    this.receivedBytes += packet.length + this.macSizeIn + 4;
    this.receivedPackets += 1;
    if (this.needRekey) {
      throw new NeedRekeyException("Rekey needed");
    } else if (
      this.receivedPackets >= Packetizer.REKEY_PACKETS ||
      this.receivedBytes >= Packetizer.REKEY_BYTES
    ) {
      this._needRekey = true;
    }
    return msg;
  }

  private log(level: string, msg: string | string[]): void {
    if (!this.logger) return;
    if (Array.isArray(msg)) {
      msg.forEach((m) => this.logger.log(level, m));
    } else {
      this.logger.log(level, msg);
    }
  }

  private checkKeepalive(): void {
    if (
      !this.keepaliveInterval ||
      !this.blockEngineOut ||
      this.needRekey
    ) {
      return;
    }
    const now = Date.now();
    if (now - this.keepaliveLast > this.keepaliveInterval * 1000) {
      if (this.keepaliveCallback) {
        this.keepaliveCallback();
      }
      this.keepaliveLast = now;
    }
  }

  private readTimeout(timeout: number): void {
    setTimeout(() => {
      this.timerExpired = true;
    }, timeout * 1000);
  }

  private async buildPacket(payload: Uint8Array): Promise<Uint8Array> {
    const blockSize = this.blockSizeOut;
    const macSize = this.macSizeOut;
    const paddingLength = blockSize - ((payload.length + 5) % blockSize);
    const packetLength = payload.length + paddingLength + 1;

    const packet = new Uint8Array(4 + packetLength + macSize);
    const view = new DataView(packet.buffer);

    // Write packet length
    view.setUint32(0, packetLength - 4, false);

    // Write padding length
    packet[4] = paddingLength;

    // Write payload
    packet.set(payload, 5);

    // Write padding
    crypto.getRandomValues(
      packet.subarray(5 + payload.length, 5 + payload.length + paddingLength),
    );

    // Encrypt packet if block engine is set
    if (this.blockEngineOut) {
      const encrypted = this.blockEngineOut.encrypt(
        packet.subarray(0, 4 + packetLength),
      );
      packet.set(encrypted, 0);
    }

    // Compute and append MAC if mac engine is set
    if (this.macEngineOut) {
      const mac = new HMAC(this.macEngineOut, this.macKeyOut);
      await mac.ready;
      mac.update(packet.subarray(0, 4 + packetLength));
      const macResult = await mac.digest();
      packet.set(macResult, 4 + packetLength);
    }

    return packet;
  }

  private triggerRekey(): void {
    this._needRekey = true;
  }
}
