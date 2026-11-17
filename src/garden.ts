import { getSunPosition, type HeatmapInstance, type SunLocation } from './sun'
import { PLANT_PRESETS, type BedConfig, type PlantType, type Structure } from './types'

export type GardenView = 'render' | 'orbit' | 'plan'
export interface YardSize {
  width: number
  depth: number
}
export const ORIGINAL_YARD: YardSize = { width: 24, depth: 10 }

export function gardenBounds(yard: YardSize, beds: BedConfig[], structures: Structure[], heatmaps: HeatmapInstance[]) {
  let left = -yard.width / 2, right = yard.width / 2, back = -yard.depth / 2, front = yard.depth / 2, top = 0
  function include(x: number, z: number, w: number, d: number, height: number) {
    left = Math.min(left, x - w / 2)
    right = Math.max(right, x + w / 2)
    back = Math.min(back, z - d / 2)
    front = Math.max(front, z + d / 2)
    top = Math.max(top, height)
  }
  for (const bed of beds) {
    const angle = (bed.rotation ?? 0) * Math.PI / 180
    const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle))
    include(bed.x, bed.z, bed.width * c + bed.depth * s, bed.width * s + bed.depth * c,
      bed.hasTrellis ? bed.trellisHeight ?? 5 : 2)
  }
  for (const { position: [x, y, z], size: [w, h, d] } of structures) include(x, z, w, d, y + h / 2)
  for (const map of heatmaps) if (map.visible) include(map.centerX, map.centerZ, map.width, map.depth, 0)
  return { left, right, back, front, top }
}

function starterBed(id: string, name: string, plantType: PlantType, x: number, z: number): BedConfig {
  const p = PLANT_PRESETS[plantType]
  return { id, name, plantType, x, z, width: 7.5, depth: 2.8, color: p.color, sunNeeds: p.sunNeeds }
}

export const STARTER_BEDS: BedConfig[] = [
  {
    ...starterBed('starter-tomatoes', 'Cherry tomatoes', 'tomatoes', -4.8, -2.2),
    hasTrellis: true,
    trellisHeight: 3.4,
  },
  starterBed('starter-greens', 'Salad greens', 'lettuce', 4.8, 2.2),
  starterBed('starter-peppers', 'Sweet peppers', 'peppers', 4.8, -2.2),
  starterBed('starter-herbs', 'Culinary herbs', 'herbs', -4.8, 2.2),
]

export function starterStructures({ width, depth }: YardSize): Structure[] {
  const fence = (id: string, name: string, x: number, z: number, w: number, d: number): Structure => ({
    id,
    name,
    type: 'fence',
    position: [x, 2.6, z],
    size: [w, 5.2, d],
    color: '#b68d66',
    castShadow: true,
    receiveShadow: true,
  })
  return [
    {
      id: 'starter-tree',
      type: 'tree',
      name: 'Garden tree',
      position: [width * 0.36, 5.35, -depth / 2 - 1.25],
      size: [7.8, 10.7, 7.8],
      color: '#638147',
      castShadow: true,
      receiveShadow: true,
    },
    fence('starter-back', 'Back fence', 0, -depth / 2 - 2.2, width + 4, 0.22),
    fence('starter-left', 'Left fence', -width / 2 - 2, 0, 0.22, depth + 4.4),
    fence('starter-right', 'Right fence', width / 2 + 2, 0, 0.22, depth + 4.4),
  ]
}

export function daylightCurve(day: number, location: SunLocation) {
  const altitude = (hour: number) => getSunPosition(day, hour, 0, location).altitudeDeg
  const samples = Array.from({ length: 289 }, (_, i) => ({ hour: i / 12, elevation: altitude(i / 12) }))
  let rise: number | undefined
  let set: number | undefined
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i]
    if (a.elevation > 0 === b.elevation > 0) continue
    const cross = a.hour + (b.hour - a.hour) * (-a.elevation / (b.elevation - a.elevation))
    if (b.elevation > 0) rise = cross
    else set = cross
  }
  const noon = samples.reduce((best, s) => (s.elevation > best.elevation ? s : best))
  const normal = rise !== undefined && set !== undefined && rise < set
  const start = normal ? Math.floor(rise! * 60) / 60 : 0
  const end = normal ? Math.ceil(set! * 60) / 60 : 24
  return { samples, noon, start, end, rise, set, polarNight: noon.elevation <= 0 }
}
