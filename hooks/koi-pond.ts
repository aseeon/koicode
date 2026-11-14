// Koi Pond: tile mosaic koi seen from above, swimming over the app's own background.
// Every column of a koi's tiles rides the same closed path (SMIL animateMotion with rotate="auto"), each a little behind
// the column in front, so the body follows the head through a turn and bends into a C, the tail tracing the head's arc.
// On top of that each column sways sideways a beat behind the one in front (CSS), so a swimming wave runs to the tail.
// Tiles are fixed inside their column: they never snap to a grid, so nothing flickers. Pure string building.

type Patch = { t: number; v: number; rt: number; rv: number; color: string }
export type Koi = {
  cell: number
  body: number // body length in columns, snout to tail root
  width: number // half width in rows at the widest point
  base: string
  patches: Patch[]
  path: [number, number][]
  speed: number // px per second along the path
  start: number // 0..1, where on the path the head is at time zero
  beat: number // seconds per tail beat
  wave?: number // sway size multiplier, 1 if absent
}
/** The colors a scene's koi are drawn with. `bg` is what shows behind them: faded tiles blend toward it. */
export type Palette = { bg: string; fin: string; eye: string; glint: string; shade: number; scallop: number }
export type Point = [number, number]

// The app's dark background, which shows through the scene: see-through tiles blend toward it.
const APP_BG = '#262624'
const FIN = '#3d3c39'
const EYE = '#121211'
const WHITE = '#bdbab2'
const ORANGE = '#d98a35'
const RED = '#c4521f'
const INK = '#2a2927'
const POND: Palette = { bg: APP_BG, fin: FIN, eye: EYE, glint: '#d8d4ca', shade: 0.1, scallop: 0 }

function hash(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export const n = (x: number): string => String(Math.round(x * 10) / 10)

/** A hex color darkened by k. */
function dark(hex: string, k: number): string {
  const a = parseInt(hex.slice(1), 16)
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k))
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`
}

/** Half width in rows at t (0 snout, 1 tail root): a blunt round head, widest a third back, a slim tail root. */
function halfAt(t: number, w: number): number {
  const s = t < 0.14 ? 0.45 + 0.55 * Math.sqrt(t / 0.14) : t < 0.42 ? 1 : 1 - 0.74 * ((t - 0.42) / 0.58) ** 1.2
  return w * s
}

/** The patch color at t, v. With scallop above 0 a patch edge has rounded bumps, like the cloud edges of a kohaku. */
function colorAt(k: Koi, t: number, v: number, scallop: number): string {
  for (const p of k.patches) {
    const [a, b] = [(t - p.t) / p.rt, (v - p.v) / p.rv]
    if (a * a + b * b <= (1 + scallop * Math.sin(9 * Math.atan2(b, a) + p.t * 50)) ** 2) return p.color
  }
  return k.base
}

/** A hex color blended toward the background bg by k: a see-through look that stays solid. */
function toBg(hex: string, k: number, bg: string): string {
  const a = parseInt(hex.slice(1), 16)
  const b = parseInt(bg.slice(1), 16)
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k)
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`
}

/**
 * Squares collected by fill, so a column is a few paths instead of a rect per tile.
 * Tiles touch, with no grid lines between them. Each one also reaches a whole tile back under the column behind it (columns are
 * drawn tail first, head last), so the gap that opens on the outside of a turn is always covered: a tile stretches
 * there instead of leaving a hole. Opacity becomes a blend toward the background, since overlapping see-through tiles
 * would show darker bands.
 */
function tiles(cell: number, pal: Palette) {
  // Per fill, runs of touching tiles down one column [x, first y, last y]: a run is drawn as one rectangle.
  const fills = new Map<string, [number, number, number][]>()
  // A hair over a cell, so neighbors overlap and no seam shows between them.
  const s = cell + 0.4
  const back = cell
  return {
    add(x: number, y: number, color: string, opacity: number): void {
      const fill = opacity < 1 ? toBg(color, 1 - opacity, pal.bg) : color
      const runs = fills.get(fill) ?? []
      const last = runs.at(-1)
      if (last !== undefined && last[0] === x && last[2] === y - cell) last[2] = y
      else runs.push([x, y, y])
      fills.set(fill, runs)
    },
    svg(): string {
      let out = ''
      for (const [color, runs] of fills) {
        const d = runs.map(([x, top, end]) => `M${n(x - s / 2 - back)} ${n(top - s / 2)}h${n(s + back)}v${n(end - top + s)}h-${n(s + back)}z`).join('')
        out += `<path d="${d}" fill="${color}"/>`
      }
      return out
    },
  }
}

type Bezier = [Point, Point, Point, Point]

/** The closed Catmull-Rom curve through the points, as one cubic Bezier per point. */
function beziers(points: Point[]): Bezier[] {
  const p = (i: number): Point => points[(i + points.length) % points.length]!
  return points.map((_, i) => {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    return [p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]
  })
}

function along([a, b, c, d]: Bezier, u: number): Point {
  const v = 1 - u
  return [
    v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0],
    v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1],
  ]
}

const STEPS = 24

/** The tightest turn on one Bezier: the smallest radius of a circle through three neighbouring samples. */
function tightestOn(bz: Bezier): number {
  let least = Infinity
  for (let j = 1; j < STEPS; j += 1) {
    const [a, b, c] = [along(bz, (j - 1) / STEPS), along(bz, j / STEPS), along(bz, (j + 1) / STEPS)]
    const cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
    const r = (Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]) * Math.hypot(c[0] - a[0], c[1] - a[1])) / (2 * cross)
    least = Math.min(least, r)
  }
  return least
}

/** The tightest turn anywhere on the closed curve through the points. */
export function tightest(points: Point[]): number {
  return Math.min(...beziers(points).map(tightestOn))
}

/**
 * Eases the curve until no turn is tighter than `radius`: a point beside a too tight turn moves a little toward the
 * middle of its neighbours, and again, until the turn is wide enough.
 */
function gentle(points: Point[], radius: number): Point[] {
  let out = points.map(([x, y]): Point => [x, y])
  for (let round = 0; round < 400; round += 1) {
    const turns = beziers(out).map(tightestOn)
    if (Math.min(...turns) >= radius) break
    out = out.map(([x, y], i): Point => {
      const isTight = turns[i]! < radius || turns[(i - 1 + out.length) % out.length]! < radius
      if (!isTight) return [x, y]
      const [a, b] = [out[(i - 1 + out.length) % out.length]!, out[(i + 1) % out.length]!]
      return [x + ((a[0] + b[0]) / 2 - x) * 0.15, y + ((a[1] + b[1]) / 2 - y) * 0.15]
    })
  }
  return out
}

/** The path markup of the closed curve, and its length: the columns are spaced by time, so it has to be close. */
function loop(points: Point[]): { d: string; length: number } {
  const curves = beziers(points)
  let d = `M${n(points[0]![0])} ${n(points[0]![1])}`
  let length = 0
  for (const bz of curves) {
    d += `C${n(bz[1][0])} ${n(bz[1][1])} ${n(bz[2][0])} ${n(bz[2][1])} ${n(bz[3][0])} ${n(bz[3][1])}`
    let prev = bz[0]
    for (let j = 1; j <= STEPS; j += 1) {
      const q = along(bz, j / STEPS)
      length += Math.hypot(q[0] - prev[0], q[1] - prev[1])
      prev = q
    }
  }
  return { d: `${d}Z`, length }
}

/**
 * How wide a koi's turns must be. A tile reaches one tile back, so it can stretch to twice its length; on the outside
 * of a turn of radius R, columns at a distance h from the spine spread by (R + h) / R. So R >= h keeps every gap
 * covered, and the widest part is the tail fan, about 1.3 widths. Twice that leaves room for the sway, and keeps the
 * turns from looking cramped.
 */
export function turnRadius(k: Koi): number {
  return 2.6 * k.width * k.cell
}

/** Each koi's path, eased to its turn radius. */
export function koiPaths(list: Koi[] = KOI): Point[][] {
  return list.map(k => gentle(k.path, turnRadius(k)))
}

function swing(amp: number, beat: number, lag: number): string {
  return `<animateTransform attributeName="transform" type="rotate" values="${n(amp)};${n(-amp)};${n(amp)}" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${beat}s" begin="-${n(lag)}s" repeatCount="indefinite"/>`
}

/** One koi: a group per column, each riding the path at its own distance behind the snout. */
function koi(k: Koi, index: number, path: Point[], pal: Palette): { defs: string; svg: string } {
  const seed = 17 + index * 31
  const c = k.cell
  const id = `k${index}`
  const { d, length } = loop(path)
  const dur = Math.round(length / k.speed)
  const speed = length / dur
  const tail = Math.round(k.body * 0.36)
  const total = k.body + tail
  // A column `behind` px back starts that much later, so at any moment it sits that far back along the path.
  const ride = (behind: number) =>
    `<animateMotion dur="${dur}s" begin="${n(-dur * (1 + k.start) + behind / speed)}s" rotate="auto" repeatCount="indefinite"><mpath href="#${id}"/></animateMotion>`
  // The sway: grows toward the tail, and each column is a little behind the one in front.
  const sway = (col: number) => {
    const t = col / total
    const amp = col < k.body ? c * (0.08 + 0.55 * t * t) : c * (0.45 + 0.9 * ((col - k.body) / tail))
    return `style="--a:${n(amp * (k.wave ?? 1))}px;animation-delay:${n(-2 * k.beat + (col / total) * k.beat * 0.9)}s"`
  }

  const columns: string[] = []
  for (let col = total - 1; col >= 0; col -= 1) {
    const cells = tiles(c, pal)
    let over = ''
    if (col < k.body) {
      const t = col / (k.body - 1)
      const half = halfAt(t, k.width)
      const rows = Math.ceil(half)
      for (let r = -rows; r <= rows; r += 1) {
        // How much of this tile the outline covers: edge tiles are drawn fainter, like the grey rims in a mosaic.
        const cover = half + 0.5 - Math.abs(r)
        if (cover < 0.3) continue
        const isEye = col === Math.round(k.body * 0.09) && Math.abs(r) === Math.max(1, Math.round(half) - 1)
        const color = isEye ? pal.eye : colorAt(k, t, half === 0 ? 0 : r / half, pal.scallop)
        const opacity = isEye ? 1 : cover < 0.75 ? 0.45 : cover < 1.1 ? 0.8 : 1
        const shade = hash(seed + col, r + 9) * pal.shade
        cells.add(0, r * c, dark(color, shade), opacity)
        if (isEye) over += `<rect x="${n(-c * 0.15)}" y="${n(r * c - c * 0.15)}" width="${n(c * 0.3)}" height="${n(c * 0.3)}" fill="${pal.glint}"/>`
      }
    } else {
      // The caudal fin: a dark fan that widens and forks into two lobes.
      const u = (col - k.body + 1) / tail
      const half = k.width * (0.3 + 1.0 * Math.sqrt(u))
      const notch = Math.max(0, (u - 0.35) * k.width * 1.7)
      for (let r = -Math.ceil(half); r <= Math.ceil(half); r += 1) {
        const cover = half + 0.5 - Math.abs(r)
        if (cover < 0.3 || Math.abs(r) < notch) continue
        cells.add(0, r * c, pal.fin, Math.round(Math.min(1, cover) * (0.9 - 0.35 * u) * 10) / 10)
      }
    }
    columns.push(`<g>${ride(col * c)}<g class="s" ${sway(col)}>${cells.svg()}${over}</g></g>`)
  }

  // Pectoral fins, wide and dark, and smaller pelvic fins: each pair rides the path at its root and flaps slowly.
  const finPair = (col: number, size: number, salt: number) => {
    const t = col / (k.body - 1)
    const root = halfAt(t, k.width) - 0.5
    let out = ''
    for (const side of [1, -1]) {
      const fin = tiles(c, pal)
      // The root: one solid block from the spine out to the first row of tiles, under the body tiles (fins are drawn
      // first). However the fin flaps or the body bends, the joint stays covered, so no gap opens along it.
      const reach = Math.max(1, Math.round((size - 1) * 0.7) + 1) + 2
      const y0 = side > 0 ? -root * c : -c
      const roots = `<path d="M${n(0.5 * c)} ${n(y0)}h-${n(reach * c)}v${n(root * c + c)}h${n(reach * c)}z" fill="${toBg(pal.fin, 0.12, pal.bg)}"/>`
      for (let o = 1; o <= size; o += 1) {
        const from = Math.floor(o * 0.6)
        const to = from + Math.max(1, Math.round((size - o) * 0.7) + 1)
        for (let b = from; b <= to; b += 1) {
          const edge = o === size || b === to
          fin.add(-b * c, side * o * c, pal.fin, edge ? 0.55 : 0.88)
        }
      }
      out += `<g transform="translate(0 ${n(side * root * c)})"><g>${swing(10 * side, k.beat * 1.7, k.beat * (side > 0 ? 0.2 : 1.0) + salt * 0.1)}${roots}${fin.svg()}</g></g>`
    }
    return `<g>${ride(col * c)}<g class="s" ${sway(col)}>${out}</g></g>`
  }
  const fins = finPair(Math.round(0.22 * k.body), Math.round(k.width * 1.15), 1) + finPair(Math.round(0.6 * k.body), Math.max(2, Math.round(k.width * 0.6)), 2)

  return {
    defs: `<path id="${id}" d="${d}"/>`,
    // Fins first and the snout last, so the head lies on top of everything behind it.
    svg: `<g id="f${index}" class="f${index}">${fins}${columns.join('')}</g>`,
  }
}

export const KOI: Koi[] = [
  {
    // Kohaku: white with red patches, the big one. Wanders the window with one tight turn back on itself.
    cell: 10, body: 24, width: 4.4, base: WHITE, speed: 46, start: 0.05, beat: 2.6,
    patches: [{ t: 0.1, v: 0, rt: 0.12, rv: 0.85, color: RED }, { t: 0.42, v: -0.35, rt: 0.16, rv: 0.75, color: RED }, { t: 0.68, v: 0.35, rt: 0.13, rv: 0.7, color: RED }],
    path: [[260, 170], [700, 120], [1080, 220], [1240, 380], [1150, 520], [990, 470], [1010, 320], [1250, 200], [1470, 330], [1480, 640], [1200, 850], [700, 880], [330, 780], [170, 520]],
  },
  {
    // Ogon: orange with a white saddle; a broad loop along the right side.
    cell: 9, body: 22, width: 4, base: ORANGE, speed: 40, start: 0.55, beat: 2.9,
    patches: [{ t: 0.48, v: 0, rt: 0.1, rv: 1.2, color: WHITE }, { t: 0.0, v: 0, rt: 0.07, rv: 1, color: WHITE }, { t: 0.8, v: -0.4, rt: 0.08, rv: 0.6, color: RED }],
    path: [[1500, 120], [1280, 260], [1220, 520], [1340, 780], [1560, 860], [1720, 700], [1700, 420]],
  },
  {
    // Sanke: white, red and ink, along the left edge, with a wide U-turn at the top.
    cell: 9, body: 21, width: 3.8, base: WHITE, speed: 42, start: 0.3, beat: 2.4,
    patches: [{ t: 0.18, v: 0.2, rt: 0.15, rv: 0.9, color: RED }, { t: 0.5, v: -0.55, rt: 0.08, rv: 0.4, color: INK }, { t: 0.62, v: 0.3, rt: 0.15, rv: 0.8, color: RED }, { t: 0.85, v: -0.2, rt: 0.06, rv: 0.5, color: INK }],
    path: [[120, 950], [80, 600], [150, 300], [330, 140], [520, 230], [540, 420], [400, 560], [420, 800], [300, 1050]],
  },
  {
    // Tancho: white with one red crown; a long diagonal pass that leaves the window and comes back.
    cell: 8, body: 20, width: 3.4, base: WHITE, speed: 52, start: 0.7, beat: 2.1,
    patches: [{ t: 0.1, v: 0, rt: 0.09, rv: 0.75, color: RED }],
    path: [[-200, 1050], [450, 760], [1050, 420], [1750, -120], [1950, 450], [900, 1250]],
  },
  {
    // A small orange and white koi on an oval near the top.
    cell: 7, body: 18, width: 3, base: WHITE, speed: 44, start: 0.15, beat: 1.9,
    patches: [{ t: 0.3, v: 0, rt: 0.26, rv: 1.3, color: ORANGE }, { t: 0.82, v: 0, rt: 0.1, rv: 1.2, color: RED }],
    path: [[1200, 290], [1103, 403], [870, 450], [637, 403], [540, 290], [637, 177], [870, 130], [1103, 177]],
  },
  {
    // A small kohaku along the bottom.
    cell: 8, body: 19, width: 3.2, base: WHITE, speed: 38, start: 0.45, beat: 2.2,
    patches: [{ t: 0.28, v: 0.2, rt: 0.2, rv: 0.9, color: RED }, { t: 0.72, v: -0.2, rt: 0.13, rv: 0.9, color: ORANGE }],
    path: [[100, 1080], [500, 880], [900, 930], [1300, 860], [1650, 1000], [1400, 1250], [800, 1260], [300, 1250]],
  },
]

/** All koi of a scene: their path defs, each fish's markup (group id f0, f1, ...) and the sway CSS. */
export function school(list: Koi[], pal: Palette): { defs: string; fish: string[]; style: string } {
  const paths = koiPaths(list)
  const all = list.map((k, i) => koi(k, i, paths[i]!, pal))
  const beats = list.map((k, i) => `.f${i} .s{animation-duration:${n(k.beat / 2)}s}`).join('')
  const style = `.s{animation:sway 1s ease-in-out infinite alternate}${beats}
@keyframes sway{from{transform:translateY(var(--a))}to{transform:translateY(calc(-1 * var(--a)))}}
@media (prefers-reduced-motion: reduce){.s{animation:none}}`
  return { defs: all.map(f => f.defs).join(''), fish: all.map(f => f.svg), style }
}

export function koiPondSvg(): string {
  const { defs, fish, style } = school(KOI, POND)
  // Each koi casts a shadow, a shifted copy of it drawn just before it. The shadow is the app's background color, so it
  // only shows where it falls on a koi below.
  const shadow = (i: number) => `<use href="#f${i}" transform="translate(14 20)" filter="url(#sh)"/>`

  // No ground of its own: the app's background shows through between the fish.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"><style>${style}</style><defs>${defs}<filter id="sh"><feFlood flood-color="${APP_BG}"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
${fish.map((f, i) => shadow(i) + f).join('\n')}
</svg>`
}