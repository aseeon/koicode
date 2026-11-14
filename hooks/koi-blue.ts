// Koi Blue: kohaku swimming over a floor of blue square tiles.
// The koi use the Koi Pond engine (see koi-pond.ts) with a smooth look and fine columns. Each koi casts a
// shadow, a copy of its group flooded dark and shifted, drawn just before it so it falls on the tiles and the koi below.

import { type Koi, type Palette, n, school } from './koi-pond.ts'

const TILE = '#2a57a4' // the tile blue, also what faded koi tiles blend toward
const GROUT = '#8eabdc'
const CREAM = '#ece6d6'
const RED = '#e4521d'
const DEEP = '#d4431a'

const PAL: Palette = { bg: TILE, fin: '#dde3ec', eye: '#1a1c24', glint: '#f4f1ea', shade: 0, scallop: 0.13 }

export const BLUE_KOI: Koi[] = [
  {
    // Kohaku with a red head and two big cloud patches down the back.
    cell: 7, body: 39, width: 7, base: CREAM, speed: 34, start: 0.1, beat: 3.2, wave: 2,
    patches: [{ t: 0.11, v: 0, rt: 0.09, rv: 0.7, color: RED }, { t: 0.36, v: 0.1, rt: 0.14, rv: 0.85, color: RED }, { t: 0.62, v: -0.15, rt: 0.12, rv: 0.8, color: DEEP }, { t: 0.84, v: 0.1, rt: 0.07, rv: 0.6, color: RED }],
    path: [[380, 260], [800, 170], [1180, 250], [1330, 480], [1170, 740], [720, 800], [360, 640], [260, 420]],
  },
  {
    // Kohaku with a long broken stripe.
    cell: 7, body: 38, width: 6.9, base: CREAM, speed: 30, start: 0.6, beat: 3.4, wave: 2,
    patches: [{ t: 0.2, v: -0.1, rt: 0.12, rv: 0.8, color: DEEP }, { t: 0.45, v: 0.15, rt: 0.13, rv: 0.85, color: RED }, { t: 0.7, v: -0.1, rt: 0.11, rv: 0.75, color: RED }],
    path: [[1422, 686], [1447, 502], [1169, 375], [821, 310], [439, 356], [269, 519], [242, 694], [455, 849], [838, 875], [1203, 833]],
  },
  {
    // Kohaku with one long red back, the head left white.
    cell: 7, body: 39, width: 7.2, base: CREAM, speed: 32, start: 0.35, beat: 3.3, wave: 2,
    patches: [{ t: 0.42, v: 0, rt: 0.3, rv: 0.75, color: RED }, { t: 0.08, v: 0.2, rt: 0.05, rv: 0.4, color: DEEP }],
    path: [[1391, 764], [1196, 847], [997, 813], [843, 648], [844, 407], [904, 171], [1106, 110], [1312, 107], [1438, 303], [1474, 536]],
  },
  {
    // Kohaku with three round patches, like the steps of a stair.
    cell: 7, body: 38, width: 7, base: CREAM, speed: 36, start: 0.8, beat: 3, wave: 2,
    patches: [{ t: 0.14, v: 0.1, rt: 0.1, rv: 0.75, color: DEEP }, { t: 0.4, v: -0.2, rt: 0.11, rv: 0.75, color: RED }, { t: 0.66, v: 0.2, rt: 0.11, rv: 0.75, color: RED }],
    path: [[358, 888], [559, 866], [750, 793], [804, 562], [783, 330], [635, 169], [439, 163], [250, 247], [204, 479], [203, 719]],
  },
  {
    // A young koi with one red crown, on a small oval in the middle.
    cell: 5, body: 36, width: 6.2, base: CREAM, speed: 40, start: 0.3, beat: 2.4, wave: 1.6,
    patches: [{ t: 0.12, v: 0, rt: 0.1, rv: 0.75, color: RED }],
    path: [[1180, 500], [1069, 670], [800, 740], [531, 670], [420, 500], [531, 330], [800, 260], [1069, 330]],
  },
]

function hash(i: number): number {
  const x = Math.sin(i * 91.7 + 12.3) * 43758.5453
  return x - Math.floor(x)
}

/** The tile floor: one 4 by 4 block of slightly different blues, repeated. */
function floor(): string {
  const shades = ['#2a57a4', '#2d5caa', '#27529c', '#3060ad', '#2853a0']
  let tiles = ''
  for (let i = 0; i < 16; i += 1) {
    tiles += `<rect x="${(i % 4) * 64 + 2.5}" y="${Math.floor(i / 4) * 64 + 2.5}" width="59" height="59" rx="2" fill="${shades[Math.floor(hash(i) * shades.length)]}"/>`
  }
  return `<pattern id="tl" width="256" height="256" patternUnits="userSpaceOnUse"><rect width="256" height="256" fill="${GROUT}"/>${tiles}</pattern>`
}

export function koiBlueSvg(): string {
  const { defs, fish, style } = school(BLUE_KOI, PAL)
  const art = `<radialGradient id="vg" r=".75"><stop offset=".55" stop-color="#071636" stop-opacity="0"/><stop offset="1" stop-color="#071636" stop-opacity=".55"/></radialGradient>
<filter id="sh" color-interpolation-filters="sRGB"><feFlood flood-color="#0b1c45" flood-opacity=".7"/><feComposite in2="SourceGraphic" operator="in"/></filter>`
  const shadow = (i: number) => `<use href="#f${i}" transform="translate(30 40)" filter="url(#sh)"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><style>${style}</style><defs>${floor()}${art}${defs}</defs>
<rect x="-400" y="-400" width="2400" height="1800" fill="url(#tl)"/>
${fish.map((f, i) => shadow(i) + f).join('\n')}
<rect x="-400" y="-400" width="2400" height="1800" fill="url(#vg)"/>
</svg>`
}
