// Tạo lại bộ icon PWA từ public/favicon.svg
// Chạy: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../public', import.meta.url))
const svg = await readFile(join(root, 'favicon.svg'))

// Bản maskable: nền tràn viền, hoạ tiết thu nhỏ vào vùng an toàn (80% giữa)
const maskableSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g fill="#fff">
    <rect x="148" y="148" width="96" height="96" rx="21"/>
    <rect x="268" y="148" width="96" height="96" rx="21" opacity="0.55"/>
    <rect x="148" y="268" width="96" height="96" rx="21" opacity="0.55"/>
    <rect x="268" y="268" width="96" height="96" rx="48"/>
  </g>
</svg>`)

const jobs = [
  { src: svg, size: 192, out: 'pwa-192x192.png' },
  { src: svg, size: 512, out: 'pwa-512x512.png' },
  { src: maskableSvg, size: 512, out: 'maskable-icon-512x512.png' },
  { src: svg, size: 180, out: 'apple-touch-icon.png' },
]

for (const { src, size, out } of jobs) {
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(join(root, out))
  console.log('wrote', out)
}

// favicon.ico: container ICO chứa một PNG 48x48 (mọi trình duyệt hiện đại đều hỗ trợ)
const png48 = await sharp(svg, { density: 300 }).resize(48, 48).png().toBuffer()
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // count
const entry = Buffer.alloc(16)
entry.writeUInt8(48, 0) // width
entry.writeUInt8(48, 1) // height
entry.writeUInt8(0, 2) // palette
entry.writeUInt8(0, 3) // reserved
entry.writeUInt16LE(1, 4) // planes
entry.writeUInt16LE(32, 6) // bpp
entry.writeUInt32LE(png48.length, 8) // data size
entry.writeUInt32LE(22, 12) // data offset
await writeFile(join(root, 'favicon.ico'), Buffer.concat([header, entry, png48]))
console.log('wrote favicon.ico')
