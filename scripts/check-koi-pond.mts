// Run: node scripts/check-koi-pond.mts
// Fails if a scene is over the app's size limit, or if a koi's path turns tighter than its gap-free radius.
import assert from 'node:assert/strict'
import { type Koi, KOI, koiPaths, koiPondSvg, tightest, turnRadius } from '../hooks/koi-pond.ts'
import { BLUE_KOI, koiBlueSvg } from '../hooks/koi-blue.ts'

const scenes: [string, Koi[], () => string][] = [['Koi Pond', KOI, koiPondSvg], ['Koi Blue', BLUE_KOI, koiBlueSvg]]
for (const [name, list, build] of scenes) {
  const svg = build()
  assert.ok(svg.length < 131072, `${name} is ${svg.length} characters, over 131072`)
  koiPaths(list).forEach((path, i) => {
    const k = list[i]!
    const after = tightest(path)
    console.log(`${name} koi ${i}: tightest turn ${Math.round(tightest(k.path))} -> ${Math.round(after)} px, needs ${Math.round(turnRadius(k))}`)
    assert.ok(after >= turnRadius(k), `${name} koi ${i} turns at ${after}, tighter than ${turnRadius(k)}`)
  })
  console.log(`ok: ${name}, ${svg.length} characters`)
}
