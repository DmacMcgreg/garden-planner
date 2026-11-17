// Build each specimen once. Beds instance the same mesh at the crop's spacing.
import {
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  Vector3,
  CylinderGeometry,
  SphereGeometry,
  Quaternion,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PLANT_PRESETS, type PlantType } from './types'

const UP = new Vector3(0, 1, 0)
const TAU = Math.PI * 2

function colored(geometry: BufferGeometry, tint: string) {
  const c = new Color(tint)
  const colors = new Float32Array(geometry.getAttribute('position').count * 3)
  for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i)
  const uv = geometry.getAttribute('uv')
  if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.01, 0.01)
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

function stem(start: Vector3, end: Vector3, radius: number, tint = '#758449') {
  const direction = end.clone().sub(start)
  const g = new CylinderGeometry(radius * 0.63, radius, direction.length(), 5)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, direction.normalize()))
  g.translate(...start.clone().lerp(end, 0.5).toArray())
  return colored(g, tint)
}

function leaf(
  base: Vector3,
  angle: number,
  length: number,
  width: number,
  lift: number,
  curl: number,
  tint: string,
  ruffle = 0,
) {
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = []
  const color = new Color(tint),
    ca = Math.cos(angle),
    sa = Math.sin(angle)
  const rows = width < 0.054 ? 4 : 9
  const cols = width < 0.054 ? 2 : 4
  for (let row = 0; row <= rows; row++) {
    const t = row / rows,
      envelope = 0.015 + Math.pow(Math.sin(t * Math.PI), 0.78)
    for (let col = 0; col <= cols; col++) {
      const k = (col * 2) / cols - 1,
        side = Math.abs(k)
      const wave = Math.sin(t * 30 + angle + col) * ruffle * side
      const x = (width + wave) * envelope * k,
        z = t * length
      const y = t * lift + Math.sin(Math.PI * t) * curl + side * envelope * width * 0.38 + wave
      uvs.push(col / cols, t)
      positions.push(base.x + x * ca + z * sa, base.y + y, base.z + z * ca - x * sa)
      const light = (0.74 + 0.28 * t + 0.16 * Math.sin(row * 1.8 + col)) * (col === cols / 2 ? 1.24 : 1)
      colors.push(color.r * light, color.g * light, color.b * light)
      if (row < rows && col < cols) {
        const i = row * (cols + 1) + col
        const next = i + cols + 1
        indices.push(i, next, i + 1, i + 1, next, next + 1)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

function fruit(x: number, y: number, z: number, radius: number, tint: string, pepper: boolean) {
  const g = new SphereGeometry(radius, 12, 9)
  if (pepper) {
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getX(i), p.getZ(i)),
        lobe = 1 + 0.15 * Math.cos(4 * a)
      p.setXYZ(i, p.getX(i) * lobe, p.getY(i) * 1.35, p.getZ(i) * lobe)
    }
    g.computeVertexNormals()
  }
  return colored(g.translate(x, y, z), tint)
}

function oval(at: Vector3, width: number, height: number, depth: number, tint: string) {
  const shape = new SphereGeometry(1, 10, 8)
  return colored(shape.scale(width, height, depth).translate(at.x, at.y, at.z), tint)
}

type RosetteSpec = [
  count: number,
  reach: number,
  width: number,
  height: number,
  ruffle: number,
  leafColor: string,
]
const rosettes = {
  kale: [15, 0.48, 0.16, 0.85, 0.085, '#496f58'],
  spinach: [13, 0.37, 0.14, 0.36, 0.016, '#47813f'],
  'swiss-chard': [11, 0.5, 0.19, 0.9, 0.036, '#437e50'],
  arugula: [12, 0.31, 0.074, 0.39, 0.043, '#719c43'],
  'bok-choy': [11, 0.37, 0.17, 0.45, 0.014, '#52894e'],
  cabbage: [19, 0.58, 0.29, 0.38, 0.018, '#7da58b'],
  broccoli: [10, 0.62, 0.18, 0.53, 0.035, '#63957a'],
  cauliflower: [12, 0.55, 0.17, 0.66, 0.025, '#789a69'],
  kohlrabi: [8, 0.38, 0.12, 0.66, 0.014, '#6c927e'],
  beets: [8, 0.26, 0.1, 0.48, 0.016, '#536e40'],
  radishes: [7, 0.24, 0.09, 0.29, 0.035, '#739949'],
} satisfies Partial<Record<PlantType, RosetteSpec>>

function radial(angle: number, radius: number, height: number) {
  return new Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius)
}

function rosetteCrop(type: keyof typeof rosettes, phase: number) {
  const parts: BufferGeometry[] = []
  const [count, reach, width, height, ruffle, tint] = rosettes[type]
  const bulb = type === 'kohlrabi' ? 0.17 : type === 'beets' || type === 'radishes' ? 0.105 : 0
  if (bulb)
    parts.push(
      oval(
        new Vector3(0, type === 'kohlrabi' ? 0.13 : -0.025, 0),
        bulb,
        bulb,
        bulb,
        type === 'radishes' ? '#c63a45' : type === 'beets' ? '#793547' : '#9584a3',
      ),
    )
  for (let i = 0; i < count; i++) {
    const a = i * 2.4 + phase
    const t = i / count
    const base = radial(a, bulb * 0.32, bulb)
    const length = reach * (1 - t * 0.54)
    const lift = height * (0.6 + 0.4 * t)
    parts.push(leaf(base, a, length, width * (1 - t * 0.35), lift, 0.06 + width * 0.45, tint, ruffle))
    if (type === 'swiss-chard' || type === 'bok-choy' || type === 'beets') {
      const rib =
        type === 'bok-choy'
          ? '#d1ddad'
          : type === 'beets'
            ? '#a44755'
            : ['#dd7461', '#dfab54', '#bc4966'][i % 3]
      parts.push(
        leaf(
          base,
          a,
          length * 0.83,
          width * (type === 'bok-choy' ? 0.5 : 0.17),
          lift * 0.95,
          0.1 + width * 0.48,
          rib,
        ),
      )
    }
  }
  if (type === 'broccoli' || type === 'cauliflower') {
    const color = type === 'broccoli' ? '#48764c' : '#e3d6ae'
    const y = type === 'broccoli' ? 0.68 : 0.46
    parts.push(stem(new Vector3(), new Vector3(0, y, 0), 0.09))
    for (let i = 0; i < 34; i++) {
      const t = Math.sqrt(i / 34)
      parts.push(oval(radial(i * 2.4, 0.24 * t, y - t * t * 0.12), 0.078, 0.07, 0.078, color))
    }
  }
  if (type === 'cabbage') {
    parts.push(oval(new Vector3(0, 0.34, 0), 0.28, 0.24, 0.27, '#9eb69b'))
    for (let i = 0; i < 9; i++)
      parts.push(
        leaf(new Vector3(0, 0.17 + i * 0.018, 0), i * 2.4, 0.28 - i * 0.014, 0.15, 0.26, 0.17, '#a7bf9f'),
      )
  }
  return parts
}

function compoundHerb(type: 'carrots' | 'parsley' | 'cilantro', phase: number) {
  const parts: BufferGeometry[] = []
  const fine = type === 'carrots',
    flat = type === 'cilantro'
  for (let i = 0; i < (fine ? 8 : 7); i++) {
    const a = phase + i * 2.4
    const top = radial(a, fine ? 0.18 : 0.29, (fine ? 0.64 : 0.51) + 0.15 * (i % 3))
    parts.push(stem(new Vector3(), top, 0.012))
    for (let j = 1; j <= 5; j++) {
      const joint = top.clone().multiplyScalar(j / 6)
      for (const side of [-1, 1]) {
        const angle = a + side * 0.95
        const branch = radial(angle, (6 - j) * 0.029 + 0.04, 0.08)
        parts.push(stem(joint, joint.clone().add(branch), 0.006))
        for (let k = 1; k <= (fine ? 5 : 3); k++) {
          const base = joint.clone().addScaledVector(branch, k / (fine ? 5 : 3))
          parts.push(
            leaf(
              base,
              angle + (k % 2 ? 0.8 : -0.8),
              fine ? 0.082 : 0.102,
              fine ? 0.009 : flat ? 0.052 : 0.038,
              0.04,
              flat ? 0.008 : 0.025,
              fine ? '#74964d' : flat ? '#80a660' : '#4f8d49',
              flat ? 0.009 : fine ? 0 : 0.017,
            ),
          )
        }
      }
    }
  }
  return parts
}

function climbingCrop(type: 'cucumbers' | 'peas' | 'beans' | 'bush-beans', phase: number) {
  const parts: BufferGeometry[] = []
  const pea = type === 'peas',
    cucumber = type === 'cucumbers',
    bush = type === 'bush-beans'
  const height = bush ? 1.12 : cucumber ? 2.8 : pea ? 2.4 : 3.6
  for (let vine = 0; vine < (bush ? 4 : 2); vine++) {
    let base = new Vector3()
    for (let i = 1; i <= 9; i++) {
      const a = i * 1.75 + vine * 2.4 + phase
      const top = radial(a, bush ? i * 0.038 : 0.12, (height * i) / 9)
      parts.push(stem(base, top, cucumber ? 0.026 : 0.017))
      const joint = top.clone().add(radial(a, pea ? 0.13 : 0.23, 0.045))
      parts.push(stem(top, joint, 0.011))
      const leaves = pea ? 4 : cucumber ? 1 : 3
      for (let k = 0; k < leaves; k++) {
        parts.push(
          leaf(
            joint,
            a + (k - (leaves - 1) / 2) * 0.8,
            cucumber ? 0.47 : pea ? 0.17 : 0.31,
            cucumber ? 0.24 : pea ? 0.063 : 0.115,
            -0.08,
            0.09,
            cucumber ? '#578344' : pea ? '#90a96c' : '#588a43',
            cucumber ? 0.028 : 0,
          ),
        )
      }
      if (i % 3 === 2) {
        const fruit = joint.clone()
        fruit.y -= cucumber ? 0.26 : 0.18
        const radius = cucumber ? 0.087 : pea ? 0.043 : 0.03
        parts.push(
          oval(
            fruit,
            radius,
            cucumber ? 0.26 : 0.2,
            radius * 0.78,
            cucumber ? '#456934' : pea ? '#91ad5c' : '#8caa53',
          ),
        )
        if (pea)
          for (let j = -1; j <= 1; j++)
            parts.push(
              oval(fruit.clone().add(new Vector3(0.015, j * 0.092, 0.012)), 0.041, 0.054, 0.035, '#91ad5c'),
            )
      }
      base = top
    }
  }
  return parts
}

function fieldCrop(
  type: 'zucchini' | 'squash-winter' | 'potatoes' | 'brussels-sprouts' | 'onions' | 'garlic',
  phase: number,
) {
  const parts: BufferGeometry[] = []
  const zero = new Vector3()
  if (type === 'onions' || type === 'garlic') {
    const garlic = type === 'garlic'
    parts.push(oval(new Vector3(0, -0.04, 0), 0.11, 0.13, 0.11, garlic ? '#dcceaf' : '#c19459'))
    for (let i = 0; i < (garlic ? 7 : 10); i++) {
      const a = phase + i * 2.4
      const top = radial(a, 0.12 + (i % 4) * 0.055, 0.57 + (i % 3) * 0.18)
      if (garlic) parts.push(leaf(zero, a, 0.23, 0.042, top.y, 0.24, '#84a47c'))
      else {
        const bend = top.clone().multiplyScalar(0.67)
        bend.y += 0.08
        parts.push(stem(zero, bend, 0.029, '#799d85'), stem(bend, top, 0.016, '#90b19a'))
      }
    }
  } else if (type === 'brussels-sprouts') {
    parts.push(stem(zero, new Vector3(0, 1.85, 0), 0.085))
    for (let i = 0; i < 18; i++) {
      const a = phase + i * 2.4,
        y = 0.26 + i * 0.086
      parts.push(oval(radial(a, 0.1, y), 0.082, 0.087, 0.084, '#8da66e'))
      if (i % 2 === 0 || i > 13)
        parts.push(leaf(new Vector3(0, y, 0), a, 0.4, 0.17, 0.11, 0.12, '#678b70', 0.01))
    }
  } else if (type === 'potatoes') {
    for (let i = 0; i < 5; i++) {
      const a = phase + i * 2.4,
        top = radial(a, 0.34, 0.88 + (i % 2) * 0.23)
      parts.push(stem(zero, top, 0.028))
      for (let j = 1; j <= 5; j++) {
        const base = top.clone().multiplyScalar(j / 6)
        for (const side of [-1, 1])
          parts.push(leaf(base, a + side * (1 + j / 9), 0.31, 0.115, 0.07, 0.09, '#61834a', 0.01))
      }
      if (i % 2 === 0)
        for (let k = 0; k < 5; k++)
          parts.push(oval(top.clone().add(radial((k * TAU) / 5, 0.041, 0)), 0.038, 0.019, 0.038, '#dbccde'))
    }
  } else {
    const squash = type === 'squash-winter'
    for (let i = 0; i < 10; i++) {
      const a = phase + i * 2.4
      const tip = radial(a, (squash ? 0.72 : 0.46) + (i % 3) * 0.11, squash ? 0.29 : 0.65)
      parts.push(stem(zero, tip, 0.03))
      for (let k = -1; k <= 1; k++)
        parts.push(leaf(tip, a + k * 0.55, 0.45, 0.15, -0.14, 0.08, squash ? '#67884c' : '#55804b', 0.028))
      if (i % 4 === 0) {
        const center = radial(a, squash ? 0.75 : 0.29, 0.11)
        const body = oval(
          zero,
          squash ? 0.23 : 0.095,
          squash ? 0.19 : 0.09,
          squash ? 0.23 : 0.33,
          squash ? '#d7974c' : '#416b38',
        )
        parts.push(body.rotateY(a).translate(center.x, center.y, center.z))
        for (let k = 0; k < 5; k++) parts.push(leaf(tip, (k * TAU) / 5, 0.1, 0.042, 0.04, 0.028, '#e7af3d'))
      }
    }
  }
  return parts
}

function speciesGeometry(type: PlantType, phase: number): BufferGeometry[] | undefined {
  if (type in rosettes) return rosetteCrop(type as keyof typeof rosettes, phase)
  switch (type) {
    case 'peas':
    case 'beans':
    case 'cucumbers':
    case 'bush-beans':
      return climbingCrop(type, phase)
    case 'cilantro':
    case 'parsley':
    case 'carrots':
      return compoundHerb(type, phase)
    case 'onions':
    case 'garlic':
    case 'potatoes':
    case 'zucchini':
    case 'squash-winter':
    case 'brussels-sprouts':
      return fieldCrop(type, phase)
  }
}

export function createCrop(type: PlantType, variant: number) {
  const pieces: BufferGeometry[] = [],
    category = PLANT_PRESETS[type].category
  const herb = category === 'herbs'
  const tomato = type === 'tomatoes',
    pepper = type === 'peppers'
  const phase = variant * 1.71,
    zero = new Vector3()
  const rosemary = type === 'herbs' && variant === 1
  const species = speciesGeometry(type, phase)
  if (species) {
    pieces.push(...species)
  } else if (type === 'lettuce') {
    const shades = [
      ['#a8c560', '#a3c658', '#789945'],
      ['#607f49', '#708b50', '#5f824a'],
      ['#806044', '#866454', '#789452'],
    ][variant]
    for (let i = 0; i < 22; i++) {
      const t = i / 22
      pieces.push(
        leaf(
          zero,
          i * 2.39996 + phase,
          0.44 * (1 - t * 0.65),
          0.2244,
          0.16 + 0.28 * t,
          0.14,
          shades[(i + variant) % 3],
          0.064,
        ),
      )
    }
  } else if (rosemary) {
    for (let b = 0; b < 12; b++) {
      const a = b * 2.4,
        reach = 0.13 + (b % 4) * 0.06
      const top = new Vector3(Math.sin(a) * reach, 0.56 + (b % 3) * 0.12, Math.cos(a) * reach)
      pieces.push(stem(zero, top, 0.009, '#89856b'))
      for (let j = 1; j <= 10; j++) {
        const base = top.clone().multiplyScalar(j / 11)
        for (const angle of [a + j * 1.8, a + j * 1.8 + Math.PI]) {
          pieces.push(leaf(base, angle, 0.1, 0.018, 0.07, 0.014, j % 2 ? '#92a68b' : '#72917b'))
        }
      }
    }
  } else {
    const branches = herb ? 5 : 3
    const height = herb ? 0.76 : tomato ? 2.65 : 1.55
    for (let b = 0; b < branches; b++) {
      const a = phase + (b * TAU) / branches,
        spread = herb ? 0.3 : 0.46
      const top = new Vector3(Math.sin(a) * spread, height * (1 - b * 0.09), Math.cos(a) * spread)
      pieces.push(stem(zero, top, herb ? 0.018 : 0.032))
      for (let n = 1; n <= 7; n++) {
        const t = n / 8,
          angle = a + n * 2.4,
          joint = top.clone().multiplyScalar(t)
        const len = (herb ? 0.28 : 0.54) * (1 - t * 0.47)
        const tip = joint.clone().add(new Vector3(Math.sin(angle) * len, len * 0.51, Math.cos(angle) * len))
        pieces.push(stem(joint, tip, 0.011))
        const shades = herb ? ['#568b3b', '#84aa50', '#5d9b48'] : ['#417732', '#648d39', '#4f803b']
        const shade = shades[(b + n + variant) % 3]
        for (const sign of [-1, 1]) {
          pieces.push(
            leaf(
              joint.clone().lerp(tip, 0.55),
              angle + sign * 0.88,
              len * 0.93,
              len * (tomato ? 0.21 : 0.36),
              -0.035,
              len * 0.32,
              shade,
              tomato ? 0.015 : 0,
            ),
          )
        }
        pieces.push(leaf(tip, angle, len * 0.86, len * 0.32, -len * 0.24, len * 0.22, shade))
        if ((tomato || pepper || type === 'eggplant') && n % 3 === 1) {
          const tint = tomato
            ? ['#c54420', '#d45422', '#abb043'][(b + n + variant) % 3]
            : type === 'eggplant'
              ? '#663356'
              : ['#cf4922', '#b99c35', '#597a31'][(b + n + variant) % 3]
          const r = tomato ? 0.11 : 0.145
          pieces.push(
            type === 'eggplant'
              ? oval(new Vector3(tip.x, tip.y - 0.2, tip.z), 0.13, 0.24, 0.12, tint)
              : fruit(tip.x, tip.y - r, tip.z, r, tint, !tomato),
          )
          if (tomato) pieces.push(fruit(tip.x + 0.13, tip.y - 0.24, tip.z + 0.05, 0.105, tint, false))
          for (let sepal = 0; sepal < 4; sepal++)
            pieces.push(leaf(tip, (sepal * TAU) / 4, r * 0.8, 0.02, -0.04, 0.02, '#466d36'))
        }
      }
    }
  }
  const merged = mergeGeometries(pieces)!
  for (const g of pieces) g.dispose()
  return merged
}
