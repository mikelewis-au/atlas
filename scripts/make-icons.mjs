import { mkdirSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

const BG = [0x1e, 0x29, 0x3b]
const FG = [0xcb, 0xd5, 0xe1]

// Kept inside the central 60% so a maskable crop never clips a star.
const STARS = [
  { x: 0.27, y: 0.67, r: 0.045 },
  { x: 0.41, y: 0.4, r: 0.045 },
  { x: 0.57, y: 0.56, r: 0.06 },
  { x: 0.74, y: 0.3, r: 0.045 },
  { x: 0.7, y: 0.74, r: 0.045 },
]
const LINES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [2, 4],
]
const LINE_HALF_WIDTH = 0.01
const SAMPLES = 4

function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

function inShape(u, v) {
  return (
    STARS.some((star) => Math.hypot(u - star.x, v - star.y) < star.r) ||
    LINES.some(([a, b]) => distanceToSegment(u, v, STARS[a], STARS[b]) < LINE_HALF_WIDTH)
  )
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function icon(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1)
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          if (inShape((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size)) hits++
        }
      }
      const cover = hits / SAMPLES ** 2
      raw.set(
        BG.map((bg, i) => Math.round(bg + (FG[i] - bg) * cover)),
        row + 1 + x * 3,
      )
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', icon(192))
writeFileSync('public/icon-512.png', icon(512))
writeFileSync('public/apple-touch-icon.png', icon(180))
