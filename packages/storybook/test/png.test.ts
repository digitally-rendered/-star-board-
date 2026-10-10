import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { comparePng, decodePng, PngFormatError } from '../scripts/visual/png.ts';

const BASELINES_DIR = resolve(import.meta.dirname, '../visual/baselines');

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** Encodes 8-bit pixels (`channels` per pixel) as a PNG, one scanline filter for every row. */
function encodePng(
  width: number,
  height: number,
  channels: 1 | 2 | 3 | 4,
  pixels: readonly number[],
  filter = 0,
): Buffer {
  const colorType = { 1: 0, 2: 4, 3: 2, 4: 6 }[channels];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(colorType, 9);
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.writeUInt8(filter, y * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const value = pixels[y * stride + x] ?? 0;
      const left = x >= channels ? (pixels[y * stride + x - channels] ?? 0) : 0;
      const up = y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0;
      const filtered = filter === 1 ? value - left : filter === 2 ? value - up : value;
      raw.writeUInt8(filtered & 0xff, y * (stride + 1) + 1 + x);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const rgba = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 10, 20, 30, 40];

describe('decodePng', () => {
  it('decodes 8-bit RGBA, RGB, greyscale and greyscale+alpha into RGBA', () => {
    expect(decodePng(encodePng(2, 2, 4, rgba))).toEqual({
      width: 2,
      height: 2,
      rgba: new Uint8Array(rgba),
    });
    expect([...decodePng(encodePng(2, 1, 3, [1, 2, 3, 4, 5, 6])).rgba]).toEqual([
      1, 2, 3, 255, 4, 5, 6, 255,
    ]);
    expect([...decodePng(encodePng(2, 1, 1, [7, 9])).rgba]).toEqual([7, 7, 7, 255, 9, 9, 9, 255]);
    expect([...decodePng(encodePng(1, 1, 2, [7, 8])).rgba]).toEqual([7, 7, 7, 8]);
  });

  it('reverses the Sub and Up scanline filters', () => {
    for (const filter of [1, 2]) {
      expect([...decodePng(encodePng(2, 2, 4, rgba, filter)).rgba]).toEqual(rgba);
    }
  });

  it('rejects what it does not understand with a PngFormatError', () => {
    expect(() => decodePng(Buffer.from('not a png'))).toThrow(PngFormatError);
    const palette = encodePng(1, 1, 1, [0]);
    palette.writeUInt8(3, 8 + 8 + 9);
    expect(() => decodePng(palette)).toThrow(/colour type 3/);
  });

  it('decodes what Chromium wrote for the committed baselines', () => {
    const files = existsSync(BASELINES_DIR)
      ? readdirSync(BASELINES_DIR)
          .filter((f) => f.endsWith('.png'))
          .slice(0, 3)
      : [];
    for (const file of files) {
      const png = decodePng(readFileSync(join(BASELINES_DIR, file)));
      expect(png.width).toBeGreaterThan(0);
      expect(png.height).toBeGreaterThan(0);
      expect(png.rgba.length).toBe(png.width * png.height * 4);
    }
  });
});

describe('comparePng', () => {
  const a = encodePng(2, 2, 4, rgba);

  it('calls byte-identical and pixel-identical files identical', () => {
    expect(comparePng(a, Buffer.from(a))).toEqual({ kind: 'identical' });
    expect(comparePng(a, encodePng(2, 2, 4, rgba, 1))).toEqual({ kind: 'identical' });
  });

  it('counts differing pixels', () => {
    const changed = [...rgba];
    changed[5] = 0;
    expect(comparePng(a, encodePng(2, 2, 4, changed))).toEqual({
      kind: 'pixels',
      differing: 1,
      total: 4,
      width: 2,
      height: 2,
    });
  });

  it('reports a size change and falls back to bytes for undecodable files', () => {
    expect(comparePng(a, encodePng(1, 1, 4, rgba))).toEqual({
      kind: 'size',
      expected: [2, 2],
      actual: [1, 1],
    });
    expect(comparePng(a, Buffer.from('x'))).toMatchObject({ kind: 'bytes' });
  });
});
