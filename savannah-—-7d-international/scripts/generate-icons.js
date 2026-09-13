import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);
  drawFn(buffer, width, height);

  // Build raw uncompressed scanlines with filter byte 0
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (rowSize + 1)] = 0; // Filter byte 0 (None)
    buffer.copy(rawData, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression method
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // Interlace method

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (c ^ buf[n]) >>> 0;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? ((0xedb88320 ^ (c >>> 1)) >>> 0) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcTarget = chunk.subarray(4, 8 + len);
  const crcVal = crc32(crcTarget);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

// Drawing logic: 7D International logo on #050608 night ground with gold ember & brass accents
function draw7DIcon(buf, w, h, isMaskable = false) {
  const bgR = 5, bgG = 6, bgB = 8;
  const goldR = 224, goldG = 169, goldB = 74; // #E0A94A
  const whiteR = 244, whiteG = 241, whiteB = 234; // #F4F1EA

  // Fill background
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    buf[idx] = bgR;
    buf[idx + 1] = bgG;
    buf[idx + 2] = bgB;
    buf[idx + 3] = 255;
  }

  const cx = w / 2;
  const cy = h / 2;
  const radius = (Math.min(w, h) / 2) * (isMaskable ? 0.72 : 0.85);

  // Draw subtle gold ring
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ringDist = Math.abs(dist - radius);
      if (ringDist < 2.5) {
        const alpha = Math.max(0, 1 - ringDist / 2.5) * 0.75;
        const idx = (y * w + x) * 4;
        buf[idx] = Math.round(buf[idx] * (1 - alpha) + goldR * alpha);
        buf[idx + 1] = Math.round(buf[idx + 1] * (1 - alpha) + goldG * alpha);
        buf[idx + 2] = Math.round(buf[idx + 2] * (1 - alpha) + goldB * alpha);
      }

      // Draw subtle glowing center ember
      if (dist < radius * 0.7) {
        const emberAlpha = Math.pow(1 - dist / (radius * 0.7), 2) * 0.18;
        const idx = (y * w + x) * 4;
        buf[idx] = Math.round(buf[idx] * (1 - emberAlpha) + goldR * emberAlpha);
        buf[idx + 1] = Math.round(buf[idx + 1] * (1 - emberAlpha) + goldG * emberAlpha);
        buf[idx + 2] = Math.round(buf[idx + 2] * (1 - emberAlpha) + goldB * emberAlpha);
      }
    }
  }

  // Draw stylized "7D" emblem in the center
  const scale = w / 192;
  // 7 glyph coordinates roughly centered
  const xOffset = cx - 40 * scale;
  const yOffset = cy - 25 * scale;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const relX = (x - xOffset) / scale;
      const relY = (y - yOffset) / scale;

      let inGlyph = false;

      // Glyph '7': top bar (x: 10..38, y: 10..16) and diagonal stem (x approx from 38 down to 18 as y goes 10..45)
      if (relY >= 8 && relY <= 15 && relX >= 10 && relX <= 38) {
        inGlyph = true;
      }
      // Diagonal stem of 7
      const diagX = 38 - (relY - 8) * 0.58;
      if (relY >= 14 && relY <= 45 && Math.abs(relX - diagX) <= 3.8) {
        inGlyph = true;
      }

      // Glyph 'D': vertical bar (x: 46..54, y: 8..45) and curve
      if (relX >= 46 && relX <= 53 && relY >= 8 && relY <= 45) {
        inGlyph = true;
      }
      // Top and bottom bars of D
      if ((relY >= 8 && relY <= 14 || relY >= 39 && relY <= 45) && relX >= 53 && relX <= 67) {
        inGlyph = true;
      }
      // Outer arc of D
      const dArcX = 66;
      const dArcY = 26.5;
      const dDx = relX - dArcX;
      const dDy = relY - dArcY;
      const dDist = Math.sqrt(dDx * dDx * 0.9 + dDy * dDy * 0.5);
      if (relX >= 64 && relX <= 76 && dDist >= 8.5 && dDist <= 14.5) {
        inGlyph = true;
      }

      if (inGlyph) {
        const idx = (y * w + x) * 4;
        buf[idx] = whiteR;
        buf[idx + 1] = whiteG;
        buf[idx + 2] = whiteB;
        buf[idx + 3] = 255;
      }
    }
  }
}

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate pwa-192x192.png
const png192 = createPng(192, 192, (buf, w, h) => draw7DIcon(buf, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

// 2. Generate pwa-512x512.png
const png512 = createPng(512, 512, (buf, w, h) => draw7DIcon(buf, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

// 3. Generate apple-touch-icon.png (180x180)
const appleIcon = createPng(180, 180, (buf, w, h) => draw7DIcon(buf, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

// 4. Generate pwa-maskable-512x512.png
const maskable512 = createPng(512, 512, (buf, w, h) => draw7DIcon(buf, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), maskable512);

console.log('✅ Generated high-resolution PWA icons in /public:');
console.log(' - pwa-192x192.png');
console.log(' - pwa-512x512.png');
console.log(' - apple-touch-icon.png');
console.log(' - pwa-maskable-512x512.png');
