import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const buildDir = resolve(root, 'build')
const svgPath = resolve(buildDir, 'icon.svg')

// Sizes embedded into the .ico (Windows uses these from the file).
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

async function main() {
  const svg = readFileSync(svgPath)

  // Render every size from the SVG separately so each one is sharp,
  // not a downscaled blur of a single 256.
  const pngBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(svg, { density: Math.max(72, size * 4) })
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toBuffer()
    )
  )

  const ico = await toIco(pngBuffers)
  writeFileSync(resolve(buildDir, 'icon.ico'), ico)
  console.log(`✓ wrote build/icon.ico (${ICO_SIZES.join(', ')} px)`)

  // Also generate a 512x512 PNG for macOS / Linux builds.
  const png512 = await sharp(svg, { density: 1024 })
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toBuffer()
  writeFileSync(resolve(buildDir, 'icon.png'), png512)
  console.log('✓ wrote build/icon.png (512 px)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
