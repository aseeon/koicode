// Run: node scripts/check-koi-pond.mts
// Fails if the scene is over the app's size limit, or if a koi's path turns tighter than its gap-free radius.
import assert from 'node:assert/strict'
import { KOI, koiPaths, koiPondSvg, tightest, turnRadius } from '../hooks/koi-pond.ts'

const svg = koiPondSvg()
assert.ok(svg.length < 131072, `scene is ${svg.length} characters, over 131072`)
koiPaths().forEach((path, i) => {
  const k = KOI[i]!
  const before = tightest(k.path)
  const after = tightest(path)
  console.log(`koi ${i}: tightest turn ${Math.round(before)} -> ${Math.round(after)} px, needs ${Math.round(turnRadius(k))}`)
  assert.ok(after >= turnRadius(k), `koi ${i} turns at ${after}, tighter than ${turnRadius(k)}`)
})
console.log(`ok: ${svg.length} characters`)
