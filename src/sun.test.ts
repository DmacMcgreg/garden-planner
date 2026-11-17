// Golden-value regression tests for sun.ts.
//
// These values were captured from the implementation BEFORE any of the
// 2026 improvements touched sun.ts. They lock the physical model so that
// optimisations (e.g. batch exposure calculation, shared sun-step precompute)
// cannot silently change the sun math.
//
// If you INTENTIONALLY change the physics (e.g. fix an Equation-of-Time bug),
// update these expectations deliberately and explain why in the commit.

import { describe, it, expect } from 'vitest'
import {
  getSunPosition,
  calculateSunExposure,
  calculateSunExposureBatch,
  calculateHeatmapGrid,
  structureToAABB,
  formatTime,
  degreesToCompass,
  seasonFromDay,
  dayOfYearToLabel,
  DEFAULT_LOCATION,
  DEFAULT_YARD_HEADING,
  type SunLocation,
} from './sun'

// Tight-enough precision: 2 decimals on angles/coords, exact on integers/booleans.
const close = (actual: number, expected: number) =>
  expect(actual).toBeCloseTo(expected, 2)

describe('getSunPosition — altitude / azimuth', () => {
  // The default location is Ontario (~43.7N, tz -5).
  const loc = DEFAULT_LOCATION

  it('summer solstice noon', () => {
    const s = getSunPosition(172, 12, DEFAULT_YARD_HEADING, loc)
    close(s.altitudeDeg, 69.3741)
    close(s.azimuthDeg, 167.5143)
    expect(s.isAboveHorizon).toBe(true)
    // June 21 noon sun in Ontario is well south (~167°) and high (~69°). ✓
  })

  it('summer solstice morning (7 AM) sun is in the east', () => {
    const s = getSunPosition(172, 7, DEFAULT_YARD_HEADING, loc)
    close(s.altitudeDeg, 23.1301)
    close(s.azimuthDeg, 79.027)
    expect(s.azimuthDeg).toBeLessThan(90) // east
  })

  it('winter solstice noon is low', () => {
    const s = getSunPosition(355, 12, DEFAULT_YARD_HEADING, loc)
    close(s.altitudeDeg, 22.7471)
    close(s.azimuthDeg, 175.9668)
  })

  it('spring & fall equinox noons are ~45° and due south', () => {
    close(getSunPosition(80, 12, DEFAULT_YARD_HEADING, loc).altitudeDeg, 45.5312)
    close(getSunPosition(266, 12, DEFAULT_YARD_HEADING, loc).altitudeDeg, 45.2441)
  })

  it('reports below-horizon before sunrise / after sunset with zero intensity', () => {
    const pre = getSunPosition(172, 4, DEFAULT_YARD_HEADING, loc)
    const post = getSunPosition(172, 22, DEFAULT_YARD_HEADING, loc)
    expect(pre.isAboveHorizon).toBe(false)
    expect(post.isAboveHorizon).toBe(false)
    expect(pre.intensity).toBe(0)
    expect(post.intensity).toBe(0)
  })
})

describe('getSunPosition — scene coordinates rotate with yard heading', () => {
  const loc = DEFAULT_LOCATION
  // Same real sun, but the scene-space X/Z must rotate as the yard heading changes.
  it('heading 0° vs 180° mirrors X', () => {
    const a = getSunPosition(172, 12, 0, loc)
    const b = getSunPosition(172, 12, 180, loc)
    close(a.sceneY, 112.3081) // Y is independent of heading
    close(b.sceneY, 112.3081)
    expect(a.sceneX).toBeCloseTo(-b.sceneX, 2)
  })

  it('90° rotation swaps X and Z', () => {
    const a = getSunPosition(172, 12, 0, loc)
    const b = getSunPosition(172, 12, 90, loc)
    // rotating the heading by 90° exchanges the X and Z magnitudes
    expect(Math.abs(a.sceneX)).toBeCloseTo(Math.abs(b.sceneZ), 2)
    expect(Math.abs(a.sceneZ)).toBeCloseTo(Math.abs(b.sceneX), 2)
  })
})

describe('getSunPosition — other latitudes', () => {
  it('equator at equinox noon: sun is nearly overhead', () => {
    const eq: SunLocation = { latitude: 0, longitude: 0, tzOffsetHours: 0 }
    const s = getSunPosition(80, 12, DEFAULT_YARD_HEADING, eq)
    close(s.altitudeDeg, 87.9982) // ~88° — essentially straight up
  })

  it('Sydney (33.8S) in late December: high summer sun', () => {
    const syd: SunLocation = { latitude: -33.8, longitude: 151.2, tzOffsetHours: 10 }
    const s = getSunPosition(355, 12, DEFAULT_YARD_HEADING, syd)
    close(s.altitudeDeg, 79.5617) // southern summer
  })
})

describe('calculateSunExposure', () => {
  const loc = DEFAULT_LOCATION

  it('open summer yard gets strong, all-day sun', () => {
    const e = calculateSunExposure(0, 0, 172, DEFAULT_YARD_HEADING, [], loc)
    expect(e.directSunHours).toBe(15.25)
    expect(e.peakSunHours).toBe(8.81)
    expect(e.peakIntensity).toBe(1.5)
    expect(e.energyRating).toBe(10)
    expect(e.hourly.length).toBeGreaterThan(0)
  })

  it('a tall building to the east blocks morning hours', () => {
    const tallBuilding = [
      { position: [12, 10, 0] as [number, number, number], size: [4, 20, 20] as [number, number, number], castShadow: true },
    ]
    const e = calculateSunExposure(0, 0, 172, DEFAULT_YARD_HEADING, tallBuilding, loc)
    expect(e.directSunHours).toBe(10) // down from 15.25
    expect(e.peakSunHours).toBe(6.59)
    expect(e.energyRating).toBe(8.2)
    // Morning is obstructed, afternoon opens up:
    const morningBlocked = e.hourly.filter((h) => h.hour < 12 && h.isObstructed).length
    expect(morningBlocked).toBe(10)
  })

  it('winter exposure is much lower than summer', () => {
    const e = calculateSunExposure(0, 0, 355, DEFAULT_YARD_HEADING, [], loc)
    expect(e.peakSunHours).toBe(2.21)
    expect(e.directSunHours).toBe(8.75)
  })
})

describe('calculateSunExposureBatch — equivalence with per-point', () => {
  // The batch function must produce EXACTLY the same numbers as calling
  // calculateSunExposure once per point. If this ever breaks, the alerts
  // optimisation has silently changed the sun model.
  const loc = DEFAULT_LOCATION
  const structures = [
    { position: [12, 10, 0] as [number, number, number], size: [4, 20, 20] as [number, number, number], castShadow: true },
  ]
  const points = [
    { x: 0, z: 0 },
    { x: -5, z: 3 },
    { x: 6, z: -2 },
    { x: 2, z: 4 },
  ]

  it('returns identical results for every point, across day & heading', () => {
    for (const [doy, heading] of [
      [172, DEFAULT_YARD_HEADING],
      [355, DEFAULT_YARD_HEADING],
      [80, 90],
      [266, 0],
    ] as const) {
      const batch = calculateSunExposureBatch(points, doy, heading, structures, loc)
      expect(batch.length).toBe(points.length)
      for (let i = 0; i < points.length; i++) {
        const single = calculateSunExposure(points[i].x, points[i].z, doy, heading, structures, loc)
        expect(batch[i].directSunHours).toBe(single.directSunHours)
        expect(batch[i].peakSunHours).toBe(single.peakSunHours)
        expect(batch[i].peakIntensity).toBe(single.peakIntensity)
        expect(batch[i].energyRating).toBe(single.energyRating)
        expect(batch[i].hourly.length).toBe(single.hourly.length)
        // Hourly entries must match hour-for-hour (including obstruction flags).
        for (let h = 0; h < single.hourly.length; h++) {
          expect(batch[i].hourly[h].hour).toBe(single.hourly[h].hour)
          expect(batch[i].hourly[h].isObstructed).toBe(single.hourly[h].isObstructed)
          expect(batch[i].hourly[h].intensity).toBeCloseTo(single.hourly[h].intensity, 5)
        }
      }
    }
  })

  it('returns an empty array for no points', () => {
    expect(calculateSunExposureBatch([], 172, DEFAULT_YARD_HEADING, [], loc)).toEqual([])
  })

  it('ignores structures with castShadow: false (matches per-point)', () => {
    // A non-shadowing structure must be a no-op in both code paths.
    const mixed = [
      { position: [12, 10, 0] as [number, number, number], size: [4, 20, 20] as [number, number, number], castShadow: true },
      { position: [0, 5, 0] as [number, number, number], size: [3, 10, 3] as [number, number, number], castShadow: false },
    ]
    const batch = calculateSunExposureBatch(points, 172, DEFAULT_YARD_HEADING, mixed, loc)
    const single = calculateSunExposure(points[0].x, points[0].z, 172, DEFAULT_YARD_HEADING, mixed, loc)
    expect(batch[0].directSunHours).toBe(single.directSunHours)
    expect(batch[0].peakSunHours).toBe(single.peakSunHours)
    // And the castShadow:false box must not block anything on its own:
    const onlyFalse = [mixed[1]]
    const b2 = calculateSunExposureBatch(points, 172, DEFAULT_YARD_HEADING, onlyFalse, loc)
    const open = calculateSunExposure(points[0].x, points[0].z, 172, DEFAULT_YARD_HEADING, [], loc)
    expect(b2[0].directSunHours).toBe(open.directSunHours)
  })

  it('matches per-point with no structures at all (empty array path)', () => {
    const batch = calculateSunExposureBatch(points, 172, DEFAULT_YARD_HEADING, [], loc)
    for (let i = 0; i < points.length; i++) {
      const single = calculateSunExposure(points[i].x, points[i].z, 172, DEFAULT_YARD_HEADING, [], loc)
      expect(batch[i].peakSunHours).toBe(single.peakSunHours)
      expect(batch[i].directSunHours).toBe(single.directSunHours)
    }
  })

  it('matches at a shadow boundary (point collinear with building edge)', () => {
    // Probe directly under the building's east face so several hours sit right
    // on the AABB silhouette edge — the slab-method boundary is most fragile here.
    const building = [
      { position: [10, 10, 0] as [number, number, number], size: [8, 20, 20] as [number, number, number], castShadow: true },
    ]
    const edgePoint = [{ x: 6, z: 0 }] // exactly at minX = 10 - 8/2
    for (const heading of [DEFAULT_YARD_HEADING, 0, 90]) {
      const batch = calculateSunExposureBatch(edgePoint, 172, heading, building, loc)
      const single = calculateSunExposure(edgePoint[0].x, edgePoint[0].z, 172, heading, building, loc)
      expect(batch[0].directSunHours).toBe(single.directSunHours)
      expect(batch[0].peakSunHours).toBe(single.peakSunHours)
    }
  })
})

describe('timezone & shadow edge cases', () => {
  const loc = DEFAULT_LOCATION

  it('apparent solar hour shifts with tzOffset at the same clock time', () => {
    // Same lat/lon/day/clock-hour, different tz offset → different sun position.
    // This proves the timezone term is actually wired into the hour angle.
    const a = getSunPosition(172, 12, 0, { latitude: 43.7, longitude: -79.4, tzOffsetHours: -5 })
    const b = getSunPosition(172, 12, 0, { latitude: 43.7, longitude: -79.4, tzOffsetHours: -4 })
    expect(a.altitudeDeg).not.toBeCloseTo(b.altitudeDeg, 2)
  })

  it('a building that does NOT cast shadow never obstructs', () => {
    // A big box that doesn't cast shadows must leave exposure identical to open sky.
    const noShadow = [
      { position: [0, 5, 0] as [number, number, number], size: [4, 20, 4] as [number, number, number], castShadow: false },
    ]
    const open = calculateSunExposure(0, 0, 172, DEFAULT_YARD_HEADING, [], loc)
    const boxed = calculateSunExposure(0, 0, 172, DEFAULT_YARD_HEADING, noShadow, loc)
    expect(boxed.directSunHours).toBe(open.directSunHours)
    expect(boxed.peakSunHours).toBe(open.peakSunHours)
  })
})

describe('calculateHeatmapGrid', () => {
  const loc = DEFAULT_LOCATION
  const bounds = { minX: -6, maxX: 6, minZ: -4, maxZ: 4 }

  it('produces the expected dimensions and peak values for an open yard', () => {
    const g = calculateHeatmapGrid(172, DEFAULT_YARD_HEADING, [], 2, bounds, loc)
    expect(g.cols).toBe(7)
    expect(g.rows).toBe(5)
    close(g.maxPeakSunHours, 8.8078)
    close(g.maxDirectSunHours, 15)
    close(g.maxEnergyRating, 10)
  })

  it('a building reduces peak sun, more on the sheltered (east) side', () => {
    const building = [
      { position: [12, 10, 0] as [number, number, number], size: [4, 20, 20] as [number, number, number], castShadow: true },
    ]
    const g = calculateHeatmapGrid(172, DEFAULT_YARD_HEADING, building, 2, bounds, loc)
    const mid = Math.floor(g.rows / 2)
    const westCell = g.peakSunHours[mid * g.cols + 0]
    const eastCell = g.peakSunHours[mid * g.cols + (g.cols - 1)]
    close(g.maxPeakSunHours, 7.7384)
    close(westCell, 7.0699)
    close(eastCell, 5.8449)
    // The east cell (near the building) gets LESS sun than the west cell. ✓
    expect(eastCell).toBeLessThan(westCell)
  })
})

describe('structureToAABB', () => {
  it('builds an axis-aligned box from center + size', () => {
    const a = structureToAABB([0, 5, 0], [4, 10, 6])
    expect(a).toEqual({ minX: -2, maxX: 2, minY: 0, maxY: 10, minZ: -3, maxZ: 3 })
  })
})

describe('formatTime', () => {
  it('formats midnight, noon, and PM times correctly', () => {
    expect(formatTime(0)).toBe('12:00 AM')
    expect(formatTime(12)).toBe('12:00 PM')
    expect(formatTime(13.5)).toBe('1:30 PM')
    expect(formatTime(14.25)).toBe('2:15 PM')
    expect(formatTime(23.75)).toBe('11:45 PM')
  })
})

describe('degreesToCompass', () => {
  it('maps the 8 principal/ordinal directions', () => {
    expect(degreesToCompass(0)).toBe('N')
    expect(degreesToCompass(45)).toBe('NE')
    expect(degreesToCompass(90)).toBe('E')
    expect(degreesToCompass(180)).toBe('S')
    expect(degreesToCompass(270)).toBe('W')
    expect(degreesToCompass(360)).toBe('N')
    expect(degreesToCompass(22.5)).toBe('NNE')
    expect(degreesToCompass(337.5)).toBe('NNW')
  })
})

describe('seasonFromDay', () => {
  it('classifies day-of-year into seasons at the right boundaries', () => {
    expect(seasonFromDay(1)).toBe('winter')
    expect(seasonFromDay(79)).toBe('winter') // day before spring
    expect(seasonFromDay(80)).toBe('spring') // Mar 21
    expect(seasonFromDay(171)).toBe('spring')
    expect(seasonFromDay(172)).toBe('summer') // Jun 21
    expect(seasonFromDay(265)).toBe('summer')
    expect(seasonFromDay(266)).toBe('fall') // Sep 23
    expect(seasonFromDay(354)).toBe('fall')
    expect(seasonFromDay(355)).toBe('winter') // Dec 21
    expect(seasonFromDay(365)).toBe('winter')
  })
})

describe('dayOfYearToLabel', () => {
  it('formats solstice/equinox dates', () => {
    expect(dayOfYearToLabel(1)).toBe('Jan 1')
    expect(dayOfYearToLabel(80)).toBe('Mar 21')
    expect(dayOfYearToLabel(172)).toBe('Jun 21')
    expect(dayOfYearToLabel(355)).toBe('Dec 21')
  })
})
