/**
 * A minimal PNG reader for the visual comparison: enough of the format to decode what Chromium
 * writes (8-bit, non-interlaced, greyscale/RGB with or without alpha) into RGBA and count the
 * pixels that differ between two images. Anything else is reported as undecodable and the caller
 * falls back to a byte comparison, so no image library enters the workspace.
 */
import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Channels per pixel by PNG colour type; palette images (type 3) are not decoded. */
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 };

export class PngFormatError extends Error {
  override readonly name = 'PngFormatError';
}

export interface Png {
  readonly width: number;
  readonly height: number;
  /** Row-major RGBA, 4 bytes per pixel, `width * height * 4` long. */
  readonly rgba: Uint8Array;
}

interface Header {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly interlace: number;
}

function asBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Decodes a PNG into RGBA; throws {@link PngFormatError} for formats this reader does not cover. */
export function decodePng(bytes: Uint8Array): Png {
  const buf = asBuffer(bytes);
  if (buf.length < SIGNATURE.length || !buf.subarray(0, SIGNATURE.length).equals(SIGNATURE)) {
    throw new PngFormatError('not a PNG file');
  }
  let header: Header | undefined;
  const idat: Buffer[] = [];
  let offset = SIGNATURE.length;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (data.length !== length) throw new PngFormatError(`truncated ${type} chunk`);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data.readUInt8(8),
        colorType: data.readUInt8(9),
        interlace: data.readUInt8(12),
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (!header) throw new PngFormatError('no IHDR chunk');
  if (header.bitDepth !== 8) throw new PngFormatError(`unsupported bit depth ${header.bitDepth}`);
  if (header.interlace !== 0) throw new PngFormatError('interlaced images are not supported');
  const channels = CHANNELS[header.colorType];
  if (channels === undefined) {
    throw new PngFormatError(`unsupported colour type ${header.colorType}`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  if (raw.length !== (stride + 1) * header.height) {
    throw new PngFormatError(
      `image data is ${raw.length} bytes, expected ${(stride + 1) * header.height}`,
    );
  }
  const pixels = unfilter(raw, stride, header.height, channels);
  return { width: header.width, height: header.height, rgba: toRgba(pixels, channels) };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Reverses the per-scanline filters (PNG §9): None, Sub, Up, Average, Paeth. */
function unfilter(raw: Buffer, stride: number, height: number, bpp: number): Uint8Array {
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw.readUInt8(y * (stride + 1));
    const inOffset = y * (stride + 1) + 1;
    const outOffset = y * stride;
    const prevOffset = outOffset - stride;
    for (let x = 0; x < stride; x++) {
      const cur = raw.readUInt8(inOffset + x);
      const a = x >= bpp ? (out[outOffset + x - bpp] ?? 0) : 0;
      const b = y > 0 ? (out[prevOffset + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (out[prevOffset + x - bpp] ?? 0) : 0;
      let value: number;
      switch (filter) {
        case 0:
          value = cur;
          break;
        case 1:
          value = cur + a;
          break;
        case 2:
          value = cur + b;
          break;
        case 3:
          value = cur + ((a + b) >> 1);
          break;
        case 4:
          value = cur + paeth(a, b, c);
          break;
        default:
          throw new PngFormatError(`unknown scanline filter ${filter} on row ${y}`);
      }
      out[outOffset + x] = value & 0xff;
    }
  }
  return out;
}

function toRgba(pixels: Uint8Array, channels: number): Uint8Array {
  if (channels === 4) return pixels;
  const count = pixels.length / channels;
  const rgba = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const from = i * channels;
    const to = i * 4;
    if (channels === 3) {
      rgba[to] = pixels[from] ?? 0;
      rgba[to + 1] = pixels[from + 1] ?? 0;
      rgba[to + 2] = pixels[from + 2] ?? 0;
      rgba[to + 3] = 255;
    } else {
      const grey = pixels[from] ?? 0;
      rgba[to] = grey;
      rgba[to + 1] = grey;
      rgba[to + 2] = grey;
      rgba[to + 3] = channels === 2 ? (pixels[from + 1] ?? 0) : 255;
    }
  }
  return rgba;
}

export type PngComparison =
  | { readonly kind: 'identical' }
  | {
      readonly kind: 'pixels';
      readonly differing: number;
      readonly total: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: 'size';
      readonly expected: readonly [width: number, height: number];
      readonly actual: readonly [width: number, height: number];
    }
  | { readonly kind: 'bytes'; readonly reason: string };

/**
 * Compares two PNG files pixel by pixel. Byte-identical files are identical; files that decode to
 * the same pixels are identical too (the encoder may pick different filters). Files this reader
 * cannot decode are compared as bytes and reported as `bytes` when they differ.
 */
export function comparePng(expected: Uint8Array, actual: Uint8Array): PngComparison {
  if (asBuffer(expected).equals(asBuffer(actual))) return { kind: 'identical' };
  let a: Png;
  let b: Png;
  try {
    a = decodePng(expected);
    b = decodePng(actual);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: 'bytes', reason };
  }
  if (a.width !== b.width || a.height !== b.height) {
    return { kind: 'size', expected: [a.width, a.height], actual: [b.width, b.height] };
  }
  const total = a.width * a.height;
  let differing = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    if (
      a.rgba[o] !== b.rgba[o] ||
      a.rgba[o + 1] !== b.rgba[o + 1] ||
      a.rgba[o + 2] !== b.rgba[o + 2] ||
      a.rgba[o + 3] !== b.rgba[o + 3]
    ) {
      differing++;
    }
  }
  return differing === 0
    ? { kind: 'identical' }
    : { kind: 'pixels', differing, total, width: a.width, height: a.height };
}
