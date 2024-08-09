import { colorMe } from "https://jsr.io/@vef/color-me/1.0.3/src/colorMe.ts";
import { printUtils } from "@vef/easy-cli";

const controlChars = {
  NUL: 0x00,
  SOH: 0x01,
  STX: 0x02,
  ETX: 0x03,
  EOT: 0x04,
  ENQ: 0x05,
  ACK: 0x06,
  BEL: 0x07,
  BS: 0x08,
  HT: 0x09,
  LF: 0x0a,
  VT: 0x0b,
  FF: 0x0c,
  CR: 0x0d,
  SO: 0x0e,
  SI: 0x0f,
  DLE: 0x10,
  DC1: 0x11,
  DC2: 0x12,
  DC3: 0x13,
  DC4: 0x14,
  NAK: 0x15,
  SYN: 0x16,
  ETB: 0x17,
  CAN: 0x18,
  EM: 0x19,
  SUB: 0x1a,
  ESC: 0x1b,
  FS: 0x1c,
  GS: 0x1d,
  RS: 0x1e,
  US: 0x1f,
  SP: 0x20,
  DEL: 0x7f,

  // C0 control characters
  PAD: 0x80,
  HOP: 0x81,
  BPH: 0x82,
  NBH: 0x83,
  IND: 0x84,
  NEL: 0x85,
  SSA: 0x86,
  ESA: 0x87,
  HTS: 0x88,
  HTJ: 0x89,
  VTS: 0x8a,
  PLD: 0x8b,
  PLU: 0x8c,
  RI: 0x8d,
  SS2: 0x8e,
  SS3: 0x8f,
  DCS: 0x90,
  PU1: 0x91,
  PU2: 0x92,
  STS: 0x93,
  CCH: 0x94,
  MW: 0x95,
  SPA: 0x96,

  // C1 control characters
  EPA: 0x97,
  SOS: 0x98,
  SGCI: 0x99,
  SCI: 0x9a,
  CSI: 0x9b,
  ST: 0x9c,
  OSC: 0x9d,
  PM: 0x9e,
  APC: 0x9f,

  // 8-bit control characters
  NBSP: 0xa0,
};

type ControlChar = keyof typeof controlChars;

export function getControlChar(byte: number) {
  for (const key in controlChars) {
    if (controlChars[key as ControlChar] === byte) {
      return key;
    }
  }
  return null;
}

export class ConnectionReader {
  offset: number;
  size: number;
  buffer: Uint8Array;

  data: Uint8Array = new Uint8Array();

  conn: Deno.TlsConn;

  decoder = new TextDecoder();

  constructor(conn: Deno.TlsConn) {
    this.offset = 0;
    this.size = 1024;

    this.conn = conn;
    this.buffer = new Uint8Array(this.size);
  }

  async nextMessage() {
    const count = await this.conn.read(this.buffer);
    console.log("Count", count);
    if (!count) {
      return null;
    }
    const slice = this.buffer.slice(0, count);
    this.data = new Uint8Array([...this.data, ...slice]);

    if (count && count < this.size) {
      console.log("Connection closed");
      return null;
    }
    return count;
  }

  async loadContent() {
    this.data = new Uint8Array();
    this.offset = 0;
    while (true) {
      const message = await this.nextMessage();
      if (message === null) {
        break;
      }
    }
  }

  readUntil(controlChar: ControlChar) {
    const index = this.data.indexOf(controlChars[controlChar], this.offset);
    const result = this.data.slice(this.offset, index);
    this.offset = index + 1;
    return this.decode(result);
  }
  readAll() {
    const result = this.data.slice(this.offset);
    this.offset = this.data.length;
    return this.decode(result);
  }

  readByte() {
    const byte = this.data[this.offset];
    this.offset++;
    return byte;
  }
  readBytes(count: number) {
    const slice = this.data.slice(this.offset, this.offset + count);
    this.offset += count;
    return slice;
  }
  readUntilNewLine() {
    const data: number[] = [];
    while (true) {
      // check for \r\n
      let byte = this.data[this.offset];
      this.offset++;
      if (this.offset < this.data.length) {
        let nextByte = this.data[this.offset];
        if (byte === controlChars.CR && nextByte === controlChars.LF) {
          this.offset++;
          return this.decode(new Uint8Array(data));
        }
      }
      data.push(byte);
      if (this.offset === this.data.length) {
        return this.decode(new Uint8Array(data));
      }
    }
  }

  readUntilChar(char: string): string | null {
    const index = this.data.indexOf(char.charCodeAt(0), this.offset);
    if (index === -1) {
      return null;
    }
    const result = this.data.slice(this.offset, index);
    this.offset = index + 1;
    return this.decode(result);
  }
  isAsciiPrintable(byte: number) {
    return byte >= 32 && byte <= 126;
  }
  readChars(count: number, replaceControlChars?: boolean) {
    const slice = this.data.slice(this.offset, this.offset + count);
    let result = "";
    for (let i = 0; i < slice.length; i++) {
      const byte = slice[i];
      if (replaceControlChars) {
        const char = getControlChar(byte);
        if (char) {
          if (char === "NUL") {
            result += `[${char}]`;
            continue;
          }
          result += colorMe.brightRed(`[${char}]`);
          continue;
        }
      }
      const char = getControlChar(byte);
      if (!char && !this.isAsciiPrintable(byte)) {
        const hex = this.convertToHex(new Uint8Array([byte]));
        result += colorMe.brightCyan(hex);
        continue;
      }

      result += String.fromCharCode(byte);
    }
    this.offset += count;
    return result;
  }

  convertToHex(data: Uint8Array) {
    let result = "";
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      const hex = byte.toString(16).padStart(2, "0");
      result += `0x${hex} `;
      // result += byte.toString(16).padStart(2, "0");
    }
    return result;
  }

  readInt32() {
    const num = new DataView(this.data.buffer).getInt32(
      this.offset,
      false,
    );
    this.offset += 4;
    return num;
  }
  decode(data: Uint8Array) {
    return this.decoder.decode(data);
  }

  readUntilNull() {
    let byte = this.data[this.offset];
    const data: number[] = [];
    while (true) {
      if (byte === controlChars.NUL) {
        const nextNulls = this.readBytes(2);
        if (nextNulls[0] === controlChars.NUL) {
          this.offset += 2;
          return this.decode(new Uint8Array(data));
        }
      }
      data.push(byte);
      this.offset++;
      byte = this.data[this.offset];
    }
    this.offset++;
    return this.decode(new Uint8Array(data));
  }
  async readPacket() {
    await this.loadContent();
    const length = this.readInt32();
    const padding = this.readByte();
    const payload = this.readBytes(length - padding - 1);
    const randomPadding = this.readChars(padding);
    const mac = this.readBytes(16);
    this.data = payload;
    this.offset = 0;
    return { length, padding, payload, randomPadding, mac };
  }
}

/**
 * 6.  Binary Packet Protocol

   Each packet is in the following format:

      uint32    packet_length
      byte      padding_length
      byte[n1]  payload; n1 = packet_length - padding_length - 1
      byte[n2]  random padding; n2 = padding_length
      byte[m]   mac (Message Authentication Code - MAC); m = mac_length

      packet_length
         The length of the packet in bytes, not including 'mac' or the
         'packet_length' field itself.

      padding_length
         Length of 'random padding' (bytes).

      payload
         The useful contents of the packet.  If compression has been
         negotiated, this field is compressed.  Initially, compression
         MUST be "none".

      random padding
         Arbitrary-length padding, such that the total length of
         (packet_length || padding_length || payload || random padding)
         is a multiple of the cipher block size or 8, whichever is





Ylonen &  Lonvick           Standards Track                     [Page 7]

RFC 4253              SSH Transport Layer Protocol          January 2006


         larger.  There MUST be at least four bytes of padding.  The
         padding SHOULD consist of random bytes.  The maximum amount of
         padding is 255 bytes.

      mac
         Message Authentication Code.  If message authentication has
         been negotiated, this field contains the MAC bytes.  Initially,
         the MAC algorithm MUST be "none".

   Note that the length of the concatenation of 'packet_length',
   'padding_length', 'payload', and 'random padding' MUST be a multiple
   of the cipher block size or 8, whichever is larger.  This constraint
   MUST be enforced, even when using stream ciphers.  Note that the
   'packet_length' field is also encrypted, and processing it requires
   special care when sending or receiving packets.  Also note that the
   insertion of variable amounts of 'random padding' may help thwart
   traffic analysis.

   The minimum size of a packet is 16 (or the cipher block size,
   whichever is larger) bytes (plus 'mac').  Implementations SHOULD
   decrypt the length after receiving the first 8 (or cipher block size,
   whichever is larger) bytes of a packet.


      SSH_DISCONNECT_HOST_NOT_ALLOWED_TO_CONNECT             1
      SSH_DISCONNECT_PROTOCOL_ERROR                          2
      SSH_DISCONNECT_KEY_EXCHANGE_FAILED                     3
      SSH_DISCONNECT_RESERVED                                4
      SSH_DISCONNECT_MAC_ERROR                               5
      SSH_DISCONNECT_COMPRESSION_ERROR                       6
      SSH_DISCONNECT_SERVICE_NOT_AVAILABLE                   7
      SSH_DISCONNECT_PROTOCOL_VERSION_NOT_SUPPORTED          8
      SSH_DISCONNECT_HOST_KEY_NOT_VERIFIABLE                 9
      SSH_DISCONNECT_CONNECTION_LOST                        10
      SSH_DISCONNECT_BY_APPLICATION                         11
      SSH_DISCONNECT_TOO_MANY_CONNECTIONS                   12
      SSH_DISCONNECT_AUTH_CANCELLED_BY_USER                 13
      SSH_DISCONNECT_NO_MORE_AUTH_METHODS_AVAILABLE         14
      SSH_DISCONNECT_ILLEGAL_USER_NAME                      15

   */
