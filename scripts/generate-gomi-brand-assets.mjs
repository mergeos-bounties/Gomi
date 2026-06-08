import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputRoot = path.join(root, 'resources', 'gomi-branding');

const COLORS = {
  ink: [17, 24, 39, 255],
  panel: [31, 41, 55, 255],
  teal: [45, 212, 191, 255],
  white: [249, 250, 251, 255],
  orange: [249, 115, 22, 255],
  soft: [229, 231, 235, 255]
};

function createCanvas(width, height, color = [0, 0, 0, 0]) {
  const pixels = new Uint8Array(width * height * 4);

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3];
  }

  return { width, height, pixels };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }

  const index = (y * canvas.width + x) * 4;
  canvas.pixels[index] = color[0];
  canvas.pixels[index + 1] = color[1];
  canvas.pixels[index + 2] = color[2];
  canvas.pixels[index + 3] = color[3];
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(canvas.width, Math.ceil(x + width));
  const bottom = Math.min(canvas.height, Math.ceil(y + height));
  const r = Math.max(0, radius);

  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      const dx = Math.max(x + r - cx, 0, cx - (x + width - r));
      const dy = Math.max(y + r - cy, 0, cy - (y + height - r));

      if (dx * dx + dy * dy <= r * r) {
        setPixel(canvas, px, py, color);
      }
    }
  }
}

function fillCircle(canvas, cx, cy, radius, color) {
  const left = Math.max(0, Math.floor(cx - radius));
  const top = Math.max(0, Math.floor(cy - radius));
  const right = Math.min(canvas.width, Math.ceil(cx + radius));
  const bottom = Math.min(canvas.height, Math.ceil(cy + radius));
  const radiusSquared = radius * radius;

  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;

      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(canvas, px, py, color);
      }
    }
  }
}

function drawLine(canvas, x1, y1, x2, y2, thickness, color) {
  const radius = thickness / 2;
  const minX = Math.floor(Math.min(x1, x2) - radius);
  const maxX = Math.ceil(Math.max(x1, x2) + radius);
  const minY = Math.floor(Math.min(y1, y2) - radius);
  const maxY = Math.ceil(Math.max(y1, y2) + radius);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const projection = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((px + 0.5 - x1) * dx + (py + 0.5 - y1) * dy) / lengthSquared));
      const nearestX = x1 + projection * dx;
      const nearestY = y1 + projection * dy;
      const distanceX = px + 0.5 - nearestX;
      const distanceY = py + 0.5 - nearestY;

      if (distanceX * distanceX + distanceY * distanceY <= radius * radius) {
        setPixel(canvas, px, py, color);
      }
    }
  }

  fillCircle(canvas, x1, y1, radius, color);
  fillCircle(canvas, x2, y2, radius, color);
}

function renderIcon(size) {
  const scale = size >= 256 ? 3 : 4;
  const hi = createCanvas(size * scale, size * scale, [0, 0, 0, 0]);
  const s = hi.width / 256;
  const rect = (x, y, w, h, r, color) => fillRoundedRect(hi, x * s, y * s, w * s, h * s, r * s, color);
  const circle = (x, y, r, color) => fillCircle(hi, x * s, y * s, r * s, color);
  const line = (x1, y1, x2, y2, thickness, color) =>
    drawLine(hi, x1 * s, y1 * s, x2 * s, y2 * s, thickness * s, color);

  rect(0, 0, 256, 256, 54, COLORS.ink);
  line(94, 92, 76, 74, 12, COLORS.orange);
  line(162, 92, 180, 74, 12, COLORS.orange);
  rect(78, 64, 108, 136, 54, COLORS.teal);
  rect(103, 106, 58, 68, 16, COLORS.white);
  circle(119, 132, 7, COLORS.ink);
  circle(145, 132, 7, COLORS.ink);
  line(119, 153, 127, 159, 7, COLORS.ink);
  line(127, 159, 137, 159, 7, COLORS.ink);
  line(137, 159, 145, 153, 7, COLORS.ink);

  return downsample(hi, size, size);
}

function renderInstallerBig(width, height) {
  const canvas = createCanvas(width, height, COLORS.ink);
  const accentWidth = Math.round(width * 0.28);

  fillRoundedRect(canvas, -Math.round(width * 0.24), Math.round(height * 0.08), Math.round(width * 0.72), Math.round(height * 0.82), Math.round(width * 0.18), COLORS.panel);
  fillRoundedRect(canvas, Math.round(width * 0.58), Math.round(height * 0.1), Math.round(width * 0.42), Math.round(height * 0.82), Math.round(width * 0.16), [15, 118, 110, 255]);
  fillRoundedRect(canvas, Math.round(width * 0.76), 0, accentWidth, height, Math.round(width * 0.1), COLORS.teal);

  const iconSize = Math.min(Math.round(width * 0.64), Math.round(height * 0.32));
  paste(canvas, renderIcon(iconSize), Math.round(width * 0.18), Math.round(height * 0.32));
  fillRoundedRect(canvas, Math.round(width * 0.17), Math.round(height * 0.73), Math.round(width * 0.68), Math.max(5, Math.round(height * 0.025)), Math.round(width * 0.03), COLORS.orange);
  fillRoundedRect(canvas, Math.round(width * 0.17), Math.round(height * 0.79), Math.round(width * 0.42), Math.max(4, Math.round(height * 0.018)), Math.round(width * 0.02), COLORS.soft);

  return canvas;
}

function paste(target, source, startX, startY) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;
      const alpha = source.pixels[sourceIndex + 3];

      if (alpha === 0) {
        continue;
      }

      setPixel(target, startX + x, startY + y, [
        source.pixels[sourceIndex],
        source.pixels[sourceIndex + 1],
        source.pixels[sourceIndex + 2],
        source.pixels[sourceIndex + 3]
      ]);
    }
  }
}

function downsample(source, width, height) {
  const target = createCanvas(width, height);
  const xRatio = source.width / width;
  const yRatio = source.height / height;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      const startX = Math.floor(x * xRatio);
      const endX = Math.floor((x + 1) * xRatio);
      const startY = Math.floor(y * yRatio);
      const endY = Math.floor((y + 1) * yRatio);

      for (let sy = startY; sy < Math.max(endY, startY + 1); sy += 1) {
        for (let sx = startX; sx < Math.max(endX, startX + 1); sx += 1) {
          const index = (sy * source.width + sx) * 4;
          r += source.pixels[index];
          g += source.pixels[index + 1];
          b += source.pixels[index + 2];
          a += source.pixels[index + 3];
          count += 1;
        }
      }

      setPixel(target, x, y, [
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count),
        Math.round(a / count)
      ]);
    }
  }

  return target;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(canvas) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = canvas.width * 4;
  const raw = Buffer.alloc((stride + 1) * canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    Buffer.from(canvas.pixels.buffer, canvas.pixels.byteOffset + y * stride, stride).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function writeBmp(canvas) {
  const rowSize = Math.ceil((canvas.width * 3) / 4) * 4;
  const pixelDataSize = rowSize * canvas.height;
  const buffer = Buffer.alloc(14 + 40 + pixelDataSize);

  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(14 + 40, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(canvas.width, 18);
  buffer.writeInt32LE(canvas.height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);

  for (let y = 0; y < canvas.height; y += 1) {
    const targetRow = canvas.height - 1 - y;
    const rowOffset = 14 + 40 + targetRow * rowSize;

    for (let x = 0; x < canvas.width; x += 1) {
      const sourceIndex = (y * canvas.width + x) * 4;
      const targetIndex = rowOffset + x * 3;
      buffer[targetIndex] = canvas.pixels[sourceIndex + 2];
      buffer[targetIndex + 1] = canvas.pixels[sourceIndex + 1];
      buffer[targetIndex + 2] = canvas.pixels[sourceIndex];
    }
  }

  return buffer;
}

function writeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  const images = [];
  let offset = 6 + pngs.length * 16;

  for (const { size, png } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    images.push(png);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images]);
}

function writeIcns(pngs) {
  const types = new Map([
    [16, 'icp4'],
    [32, 'icp5'],
    [64, 'icp6'],
    [128, 'ic07'],
    [256, 'ic08'],
    [512, 'ic09']
  ]);
  const chunks = [];
  let totalSize = 8;

  for (const { size, png } of pngs) {
    const type = types.get(size);

    if (!type) {
      continue;
    }

    const chunk = Buffer.alloc(8 + png.length);
    chunk.write(type, 0, 'ascii');
    chunk.writeUInt32BE(chunk.length, 4);
    png.copy(chunk, 8);
    chunks.push(chunk);
    totalSize += chunk.length;
  }

  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(totalSize, 4);

  return Buffer.concat([header, ...chunks]);
}

function makeCrcTable() {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }

    table[n] = c >>> 0;
  }

  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;

  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }

  return (c ^ 0xffffffff) >>> 0;
}

async function writeAsset(relativePath, buffer) {
  const outputPath = path.join(outputRoot, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  console.log(`Wrote ${path.relative(root, outputPath)}`);
}

async function main() {
  const iconSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = iconSizes.map((size) => ({ size, png: writePng(renderIcon(size)) }));
  const icnsPngs = [16, 32, 64, 128, 256, 512].map((size) => ({ size, png: writePng(renderIcon(size)) }));
  const scaleFactors = [100, 125, 150, 175, 200, 225, 250];

  await writeAsset('win32/gomi.ico', writeIco(pngs));
  await writeAsset('win32/gomi_70x70.png', writePng(renderIcon(70)));
  await writeAsset('win32/gomi_150x150.png', writePng(renderIcon(150)));

  for (const scale of scaleFactors) {
    const bigWidth = Math.round(164 * scale / 100);
    const bigHeight = Math.round(314 * scale / 100);
    const smallSize = Math.round(55 * scale / 100);

    await writeAsset(`win32/inno-big-${scale}.bmp`, writeBmp(renderInstallerBig(bigWidth, bigHeight)));
    await writeAsset(`win32/inno-small-${scale}.bmp`, writeBmp(renderIcon(smallSize)));
  }

  await writeAsset('linux/gomi.png', writePng(renderIcon(512)));
  await writeAsset('darwin/gomi.icns', writeIcns(icnsPngs));
}

await main();
