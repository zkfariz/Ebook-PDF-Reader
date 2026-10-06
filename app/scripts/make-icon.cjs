// Builds the app icon from build/icon-source.png (the user's logo):
//   square crop → everything outside the round badge made transparent → build/icon.png (512×512).
// electron-builder turns build/icon.png into the Windows .ico; the dev window uses it directly.
// Run with Electron (it has the image tools built in):  npx electron scripts/make-icon.cjs
const { app, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

app.whenReady().then(() => {
  const dir = path.join(__dirname, '..', 'build')
  const source = nativeImage.createFromPath(path.join(dir, 'icon-source.png'))
  const { width, height } = source.getSize()
  const side = Math.min(width, height)
  const square = source.crop({ x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), width: side, height: side })

  // BGRA pixels (premultiplied). Outside the circle → transparent; a 1.5 px soft edge so the round shape isn't jagged.
  const px = square.toBitmap()
  const c = (side - 1) / 2
  const radius = side / 2 - 1
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const d = Math.hypot(x - c, y - c)
      const keep = Math.max(0, Math.min(1, radius - d + 0.5)) // 1 inside, 0 outside, soft in between
      const i = (y * side + x) * 4
      // Electron bitmaps are premultiplied: colour must shrink together with alpha.
      for (let ch = 0; ch < 4; ch++) px[i + ch] = Math.round(px[i + ch] * keep)
    }
  }
  const round = nativeImage.createFromBitmap(px, { width: side, height: side })
  const out = round.resize({ width: 512, height: 512, quality: 'best' })
  fs.writeFileSync(path.join(dir, 'icon.png'), out.toPNG())
  console.log(`icon.png written (512×512) from a ${width}×${height} source`)
  app.quit()
})
