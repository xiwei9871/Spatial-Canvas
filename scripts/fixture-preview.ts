import { deflateSync } from 'node:zlib';

/** Reproducible top-down footprint preview, entirely from the original fixture source. */
export function createPreview(objects: { position: number[]; size: number[]; color: number[] }[]) {
  const width = 480;
  const height = 320;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      const grid = x % 40 === 0 || y % 40 === 0;
      pixels.set(grid ? [204, 217, 211] : [235, 241, 238], offset);
    }
  }
  for (const object of objects) {
    const left = Math.round(width / 2 + (object.position[0]! - object.size[0]! / 2) * 70);
    const right = Math.round(width / 2 + (object.position[0]! + object.size[0]! / 2) * 70);
    const top = Math.round(height / 2 + (object.position[2]! - object.size[2]! / 2) * 70);
    const bottom = Math.round(height / 2 + (object.position[2]! + object.size[2]! / 2) * 70);
    for (let y = Math.max(top, 0); y < Math.min(bottom, height); y++) {
      for (let x = Math.max(left, 0); x < Math.min(right, width); x++) {
        const edge = x === left || x === right - 1 || y === top || y === bottom - 1;
        pixels.set(object.color.map((color) => Math.round(color * 255 * (edge ? 0.7 : 1))), y * (width * 3 + 1) + 1 + x * 3);
      }
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const payload = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of payload) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0); payload.copy(result, 4); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
