import { describe, expect, it } from 'vitest'
import { daylightCurve, gardenBounds, ORIGINAL_YARD, STARTER_BEDS, starterStructures } from './garden'
import type { Structure } from './types'
import { estimateYardDepth } from './photoScale'
import { calculateSunExposure, getSunPosition, DEFAULT_LOCATION, bedInSun } from './sun'

it('frames rotated beds, elevated structures and visible maps outside the planting patch', () => {
  const bed = { ...STARTER_BEDS[0], width: 12, depth: 2, rotation: 90, x: -20, z: 10 }
  const house: Structure = { ...starterStructures(ORIGINAL_YARD)[0], type: 'building', position: [18, 15, 0], size: [12, 30, 68] }
  const map = { id: 'map', name: 'Heatmap', centerX: 36, centerZ: 0, width: 8, depth: 2,
    mode: 'peakSunHours' as const, opacity: 1, visible: true }
  const bounds = gardenBounds(ORIGINAL_YARD, [bed], [house], [map, { ...map, visible: false, centerZ: 200 }])
  expect(bounds).toEqual({ left: -21, right: 40, back: -34, front: 34, top: 30 })
})

describe('daylight across the civil day', () => {
  it('finds Toronto sunrise and sunset on opposite sides of the solar maximum', () => {
    const curve = daylightCurve(172, DEFAULT_LOCATION)
    expect(curve.rise).toBeLessThan(curve.noon.hour)
    expect(curve.set).toBeGreaterThan(curve.noon.hour)
    expect(Math.abs(getSunPosition(172, curve.rise!, 0, DEFAULT_LOCATION).altitudeDeg)).toBeLessThan(
      0.01,
    )
    expect(Math.abs(getSunPosition(172, curve.set!, 0, DEFAULT_LOCATION).altitudeDeg)).toBeLessThan(0.01)
  })
  it('includes daylight before 4 AM and after 10 PM during polar summer', () => {
    const arctic = { latitude: 78, longitude: 15, tzOffsetHours: 1 }
    expect(calculateSunExposure(0, 0, 172, 0, [], arctic).directSunHours).toBe(24)
    const winter = daylightCurve(355, arctic)
    expect(winter.polarNight).toBe(true)
    expect([winter.start, winter.end]).toEqual([0, 24])
  })
  it('allows sunlight beneath a tree crown and respects its shadow switch', () => {
    const tree = starterStructures(ORIGINAL_YARD).find((s) => s.type === 'tree')!
    const [x, , z] = tree.position
    const low = { ...getSunPosition(172, 12), sceneX: 100, sceneY: 1, sceneZ: z }
    expect(bedInSun(x - 1, z, low, [tree])).toBe(false)
    expect(bedInSun(x - 1, z + 2, low, [tree])).toBe(true)
    expect(bedInSun(x - 1, z, low, [{ ...tree, castShadow: false }])).toBe(true)
  })
})

describe('photo calibration', () => {
  it('recovers the depth of a tilted rectangle from one real width', () => {
    // Project perpendicular unit vectors through a pinhole camera with a 3:2 image.
    const project = (x: number, z: number) => {
      const u = x * Math.cos(0.4) + z * Math.sin(0.4)
      const v = -x * Math.sin(0.4) + z * Math.cos(0.4)
      const depth = 45 + v * Math.cos(0.6)
      return { x: 0.5 + (0.9 * u) / depth, y: 0.5 + (1.5 * 0.9 * v * Math.sin(0.6)) / depth }
    }
    const corners = [project(-10, -4), project(10, -4), project(10, 4), project(-10, 4)]
    expect(estimateYardDepth(corners, 1.5, 20)).toBeCloseTo(8, 8)
  })
  it('supports a straight overhead image and rejects crossed corners', () => {
    const corners = [
      { x: 0.1, y: 0.7 },
      { x: 0.9, y: 0.7 },
      { x: 0.9, y: 0.3 },
      { x: 0.1, y: 0.3 },
    ]
    expect(estimateYardDepth(corners, 2, 24)).toBeCloseTo(6)
    expect(estimateYardDepth([corners[1], corners[0], corners[2], corners[3]], 2, 24)).toBeNull()
  })
})
