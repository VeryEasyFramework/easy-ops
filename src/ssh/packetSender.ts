export class PacketSender {
  conn: Deno.Conn;

  packetLength: number;
  paddingLength: number;
  payload: Uint8Array;
  randomPadding: Uint8Array;
  mac: Uint8Array;
  constructor(conn: Deno.Conn) {
    this.conn = conn;
    this.packetLength = 0;
    this.paddingLength = 0;
    this.payload = new Uint8Array();
    this.randomPadding = new Uint8Array();
    this.mac = new Uint8Array();
  }
  async sendPacket(payload: Uint8Array): Promise<void> {
    this.payload = payload;
    this.packetLength = payload.length + 5;
    this.paddingLength = 16 - (this.packetLength % 16);
    this.randomPadding = new Uint8Array(this.paddingLength);
    this.mac = new Uint8Array();
    const packet = new Uint8Array([
      this.packetLength >> 24,
      this.packetLength >> 16,
      this.packetLength >> 8,
      this.packetLength,
      this.paddingLength,
      ...this.randomPadding,
      ...this.payload,
      ...this.mac,
    ]);
    await this.conn.write(packet);
  }
}
