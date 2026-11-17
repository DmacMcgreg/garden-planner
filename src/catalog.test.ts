import { describe, expect, it } from 'vitest'
import { createCrop } from './cropGeometry'
import { layouts } from './layouts'
import { PLANT_PRESETS, getMinSunHoursForBed, migrateBeds, type BedConfig, type PlantType } from './types'

// Catalog rows from the planner before the redesign, commit 4321e33.
const originalCatalog = [
  ['tomatoes', 'Tomatoes', 'fruiting', '#C62828', 'full', 8, 24, 6, 6.8, 6, 3, 0],
  ['peppers', 'Peppers', 'fruiting', '#E65100', 'full', 8, 18, 6, 6.8, 5, 2.5, 0],
  ['cucumbers', 'Cucumbers', 'fruiting', '#2E7D32', 'full', 7, 12, 6, 7, 5, 3, 5],
  ['zucchini', 'Zucchini', 'fruiting', '#558B2F', 'full', 7, 36, 6, 7.5, 6, 4, 0],
  ['eggplant', 'Eggplant', 'fruiting', '#4A148C', 'full', 8, 24, 5.5, 6.5, 5, 3, 0],
  ['squash-winter', 'Winter Squash', 'fruiting', '#BF360C', 'full', 7, 48, 6, 6.8, 8, 4, 0],
  ['beans', 'Pole Beans', 'legumes', '#1B5E20', 'full', 6, 6, 6, 7, 6, 2, 6],
  ['peas', 'Peas', 'legumes', '#43A047', 'partial', 4, 4, 6, 7.5, 5, 2, 4],
  ['bush-beans', 'Bush Beans', 'legumes', '#33691E', 'full', 6, 6, 6, 7, 5, 2.5, 0],
  ['kale', 'Kale', 'leafy-greens', '#004D40', 'shade-tolerant', 4, 18, 6, 7.5, 4, 2.5, 0],
  ['lettuce', 'Lettuce', 'leafy-greens', '#9CCC65', 'shade-tolerant', 3, 8, 6, 7, 4, 2, 0],
  ['spinach', 'Spinach', 'leafy-greens', '#2E7D32', 'shade-tolerant', 3, 6, 6.5, 7.5, 4, 2, 0],
  ['swiss-chard', 'Swiss Chard', 'leafy-greens', '#AD1457', 'shade-tolerant', 4, 12, 6, 7, 4, 2.5, 0],
  ['arugula', 'Arugula', 'leafy-greens', '#7CB342', 'shade-tolerant', 3, 6, 6, 7, 3, 2, 0],
  ['bok-choy', 'Bok Choy', 'leafy-greens', '#66BB6A', 'shade-tolerant', 3, 8, 6, 7.5, 4, 2, 0],
  ['broccoli', 'Broccoli', 'brassicas', '#00695C', 'shade-tolerant', 4, 18, 6, 7, 4, 2.5, 0],
  ['cauliflower', 'Cauliflower', 'brassicas', '#C8B88A', 'shade-tolerant', 4, 18, 6, 7, 4, 2.5, 0],
  ['cabbage', 'Cabbage', 'brassicas', '#1B5E20', 'shade-tolerant', 4, 18, 6, 7.5, 4, 2.5, 0],
  ['brussels-sprouts', 'Brussels Sprouts', 'brassicas', '#388E3C', 'shade-tolerant', 4, 24, 6, 6.8, 5, 3, 0],
  ['kohlrabi', 'Kohlrabi', 'brassicas', '#7E57C2', 'shade-tolerant', 4, 6, 6, 7, 3, 2, 0],
  ['carrots', 'Carrots', 'root-vegetables', '#EF6C00', 'partial', 5, 3, 6, 6.8, 4, 2, 0],
  ['beets', 'Beets', 'root-vegetables', '#880E4F', 'partial', 5, 4, 6, 7.5, 4, 2, 0],
  ['radishes', 'Radishes', 'root-vegetables', '#D32F2F', 'partial', 4, 3, 6, 7, 3, 2, 0],
  ['onions', 'Onions', 'root-vegetables', '#F9A825', 'full', 6, 4, 6, 7, 4, 2, 0],
  ['garlic', 'Garlic', 'root-vegetables', '#F5F5DC', 'full', 6, 6, 6, 7, 3, 2, 0],
  ['potatoes', 'Potatoes', 'root-vegetables', '#8D6E63', 'full', 6, 12, 4.8, 6, 6, 3, 0],
  ['herbs', 'Mixed Herbs', 'herbs', '#689F38', 'partial', 5, 12, 6, 7, 4, 2.5, 0],
  ['basil', 'Basil', 'herbs', '#4CAF50', 'full', 6, 12, 6, 7, 3, 2, 0],
  ['cilantro', 'Cilantro', 'herbs', '#81C784', 'partial', 4, 6, 6.2, 6.8, 3, 2, 0],
  ['parsley', 'Parsley', 'herbs', '#388E3C', 'partial', 4, 8, 6, 7, 3, 2, 0],
] as const

const portraits = import.meta.glob('../public/garden/*.webp', { query: '?url' })

describe('original plant catalog', () => {
  it('includes every original preset', () => {
    expect(Object.keys(PLANT_PRESETS)).toEqual(expect.arrayContaining(originalCatalog.map(([type]) => type)))
  })

  for (const [
    type,
    name,
    category,
    color,
    sunNeeds,
    minSunHours,
    spacingInches,
    low,
    high,
    defaultWidth,
    defaultDepth,
    trellisHeight,
  ] of originalCatalog) {
    it('supports ' + type + ' in new and imported beds', () => {
      expect(PLANT_PRESETS[type]).toEqual({
        name,
        category,
        color,
        sunNeeds,
        minSunHours,
        spacingInches,
        phRange: [low, high],
        defaultWidth,
        defaultDepth,
        hasTrellis: trellisHeight > 0,
        ...(trellisHeight ? { trellisHeight } : {}),
      })
      const bed = { id: type, name, color, sunNeeds, x: 0, z: 0, width: defaultWidth, depth: defaultDepth }
      const [migrated] = migrateBeds([bed])
      expect(migrated.plantType).toBe(type)
      expect(getMinSunHoursForBed(migrated)).toBe(minSunHours)
      expect(portraits).toHaveProperty(['../public/garden/' + type + '.webp'])
      const geometry = createCrop(type, 0)
      geometry.computeBoundingSphere()
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0)
      geometry.dispose()
    })
  }

  it('preserves custom bed names and colors when a crop is unspecified or unrecognized', () => {
    const bed: BedConfig = {
      ...layouts[0].beds[0],
      name: 'Patio mix',
      color: '#ffeedd',
      plantType: undefined,
    }
    expect(migrateBeds([bed, { ...bed, plantType: 'unknown' as PlantType }])).toEqual([bed, bed])
  })

  it('identifies the old Herbs rows in all three original layouts', () => {
    expect(layouts.map((l) => [l.beds.length, l.paths.length, l.panels.length])).toEqual([
      [9, 2, 4],
      [9, 3, 4],
      [9, 4, 4],
    ])
    for (const layout of layouts) {
      expect(layout.beds.every((b) => b.plantType && b.plantType in PLANT_PRESETS)).toBe(true)
      expect(layout.beds.find((b) => b.name === 'Herbs')?.plantType).toBe('herbs')
    }
  })
})
