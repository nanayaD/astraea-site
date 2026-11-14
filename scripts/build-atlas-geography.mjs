import fs from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'art/natural-earth-10m-land/ne_10m_land.shp');
const tiles = path.join(root, 'art/terrain-tiles');
const output = path.join(root, 'assets');
const bounds = { left: 70, right: 930, top: 70, bottom: 550 };
const zoom = 7;

function islandRing() {
  const buffer = fs.readFileSync(source);
  let offset = 100;
  while (offset < buffer.length) {
    const record = buffer.readInt32BE(offset);
    const length = buffer.readInt32BE(offset + 4) * 2;
    const start = offset + 8;
    if (record === 1) {
      const part = 26; // Natural Earth 10m land: Iceland's principal island.
      const partCount = buffer.readInt32LE(start + 36);
      const pointCount = buffer.readInt32LE(start + 40);
      const first = buffer.readInt32LE(start + 44 + 4 * part);
      const last = part + 1 < partCount ? buffer.readInt32LE(start + 44 + 4 * (part + 1)) : pointCount;
      const pointStart = start + 44 + 4 * partCount;
      return Array.from({ length: last - first }, (_, i) => [
        buffer.readDoubleLE(pointStart + 16 * (first + i)),
        buffer.readDoubleLE(pointStart + 16 * (first + i) + 8)
      ]);
    }
    offset = start + length;
  }
  throw new Error('Natural Earth island ring not found');
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0], [bx, by] = points.at(-1);
  const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy;
  let farthest = 0, split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const t = lengthSq ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq)) : 0;
    const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (distance > farthest) { farthest = distance; split = i; }
  }
  if (farthest <= tolerance) return [points[0], points.at(-1)];
  return simplify(points.slice(0, split + 1), tolerance)
    .concat(simplify(points.slice(split), tolerance).slice(1));
}

function readPng(filename) {
  const buffer = fs.readFileSync(filename);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG ${filename}`);
  let offset = 8, width = 0, height = 0, channels = 0;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      if (buffer[offset + 16] !== 8 || ![2, 6].includes(buffer[offset + 17])) throw new Error('Unsupported PNG format');
      channels = buffer[offset + 17] === 2 ? 3 : 4;
    }
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= channels ? pixels[index - channels] : 0;
      const up = y ? pixels[index - stride] : 0;
      const upperLeft = y && x >= channels ? pixels[index - stride - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upperLeft;
        const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - upperLeft);
        predictor = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      } else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[index] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}

const ring = islandRing();
ring.pop(); // The shapefile closes its polygon by repeating the first point.
const lonMin = Math.min(...ring.map(p => p[0]));
const lonMax = Math.max(...ring.map(p => p[0]));
const latMin = Math.min(...ring.map(p => p[1]));
const latMax = Math.max(...ring.map(p => p[1]));
const mapPoint = ([lon, lat]) => [
  bounds.left + (lon - lonMin) / (lonMax - lonMin) * (bounds.right - bounds.left),
  bounds.bottom - (lat - latMin) / (latMax - latMin) * (bounds.bottom - bounds.top)
];
const mapped = ring.map(mapPoint);
const split = Math.floor(mapped.length / 2);
const coast = simplify(mapped.slice(0, split + 1), .9)
  .concat(simplify(mapped.slice(split).concat([mapped[0]]), .9).slice(1, -1));
const coastPath = coast.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + 'Z';
fs.writeFileSync(path.join(output, 'atlas-coast.js'), `// Adapted from Natural Earth 1:10m land (public domain).\nwindow.astraeaCoastPath = ${JSON.stringify(coastPath)};\n`);

const tileCache = new Map();
for (let x = 55; x <= 59; x++) for (let y = 31; y <= 34; y++) {
  tileCache.set(`${x}/${y}`, readPng(path.join(tiles, `${zoom}-${x}-${y}.png`)));
}
function elevationPixel(globalX, globalY) {
  const x = Math.max(55 * 256, Math.min(60 * 256 - 1, globalX));
  const y = Math.max(31 * 256, Math.min(35 * 256 - 1, globalY));
  const tileX = Math.floor(x / 256), tileY = Math.floor(y / 256);
  const tile = tileCache.get(`${tileX}/${tileY}`);
  const px = x - tileX * 256, py = y - tileY * 256;
  const offset = (py * tile.width + px) * tile.channels;
  return tile.pixels[offset] * 256 + tile.pixels[offset + 1] + tile.pixels[offset + 2] / 256 - 32768;
}
function elevationAt(lon, lat) {
  const globalX = (lon + 180) / 360 * (2 ** zoom) * 256;
  const latitude = lat * Math.PI / 180;
  const globalY = (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * (2 ** zoom) * 256;
  const x0 = Math.floor(globalX), y0 = Math.floor(globalY);
  const fx = globalX - x0, fy = globalY - y0;
  const a = elevationPixel(x0, y0) * (1 - fx) + elevationPixel(x0 + 1, y0) * fx;
  const b = elevationPixel(x0, y0 + 1) * (1 - fx) + elevationPixel(x0 + 1, y0 + 1) * fx;
  return Math.max(0, a * (1 - fy) + b * fy);
}
const gridWidth = 512, gridHeight = 288;
const grid = Buffer.alloc(gridWidth * gridHeight * 2);
for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) {
  const mapX = x / (gridWidth - 1) * 1000;
  const mapY = y / (gridHeight - 1) * 620;
  const lon = lonMin + (Math.max(bounds.left, Math.min(bounds.right, mapX)) - bounds.left) / (bounds.right - bounds.left) * (lonMax - lonMin);
  const lat = latMax - (Math.max(bounds.top, Math.min(bounds.bottom, mapY)) - bounds.top) / (bounds.bottom - bounds.top) * (latMax - latMin);
  grid.writeUInt16LE(Math.min(65535, Math.round(elevationAt(lon, lat))), (y * gridWidth + x) * 2);
}
fs.writeFileSync(path.join(output, 'atlas-elevation.bin'), grid);
console.log(`Coast vertices: ${coast.length}; elevation grid: ${gridWidth}x${gridHeight}`);
