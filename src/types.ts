import type { HeatmapInstance } from './sun'

export interface BedConfig {
  id: string
  name: string
  x: number
  z: number
  width: number
  depth: number
  color: string
  sunNeeds: 'full' | 'partial' | 'shade-tolerant'
  plantType?: PlantType
  rotation?: number
  hasTrellis?: boolean
  trellisHeight?: number
}

export interface BedAlert {
  bedId: string
  type: 'sun-exposure' | 'spacing'
  severity: 'warning' | 'error'
  message: string
}

// Plant types and presets for adding new beds
export type PlantCategory = 'fruiting' | 'legumes' | 'leafy-greens' | 'brassicas' | 'root-vegetables' | 'herbs'

export const PLANT_CATEGORIES: { key: PlantCategory; label: string }[] = [
  { key: 'fruiting', label: 'Fruiting Vegetables' },
  { key: 'legumes', label: 'Legumes' },
  { key: 'leafy-greens', label: 'Leafy Greens' },
  { key: 'brassicas', label: 'Brassicas' },
  { key: 'root-vegetables', label: 'Root Vegetables' },
  { key: 'herbs', label: 'Herbs' },
]

export type PlantType =
  | 'tomatoes'
  | 'peppers'
  | 'cucumbers'
  | 'zucchini'
  | 'eggplant'
  | 'squash-winter'
  | 'beans'
  | 'peas'
  | 'bush-beans'
  | 'kale'
  | 'lettuce'
  | 'spinach'
  | 'swiss-chard'
  | 'arugula'
  | 'bok-choy'
  | 'broccoli'
  | 'cauliflower'
  | 'cabbage'
  | 'brussels-sprouts'
  | 'kohlrabi'
  | 'carrots'
  | 'beets'
  | 'radishes'
  | 'onions'
  | 'garlic'
  | 'potatoes'
  | 'herbs'
  | 'basil'
  | 'cilantro'
  | 'parsley'

export interface PlantPreset {
  name: string
  color: string
  sunNeeds: BedConfig['sunNeeds']
  minSunHours: number
  spacingInches: number
  phRange: [number, number]
  category: PlantCategory
  defaultWidth: number
  defaultDepth: number
  hasTrellis: boolean
  trellisHeight?: number
}

export const PLANT_PRESETS: Record<PlantType, PlantPreset> = {
  // Fruiting Vegetables
  tomatoes: { name: 'Tomatoes', color: '#C62828', sunNeeds: 'full', minSunHours: 8, spacingInches: 24, phRange: [6.0, 6.8], category: 'fruiting', defaultWidth: 6, defaultDepth: 3, hasTrellis: false },
  peppers: { name: 'Peppers', color: '#E65100', sunNeeds: 'full', minSunHours: 8, spacingInches: 18, phRange: [6.0, 6.8], category: 'fruiting', defaultWidth: 5, defaultDepth: 2.5, hasTrellis: false },
  cucumbers: { name: 'Cucumbers', color: '#2E7D32', sunNeeds: 'full', minSunHours: 7, spacingInches: 12, phRange: [6.0, 7.0], category: 'fruiting', defaultWidth: 5, defaultDepth: 3, hasTrellis: true, trellisHeight: 5 },
  zucchini: { name: 'Zucchini', color: '#558B2F', sunNeeds: 'full', minSunHours: 7, spacingInches: 36, phRange: [6.0, 7.5], category: 'fruiting', defaultWidth: 6, defaultDepth: 4, hasTrellis: false },
  eggplant: { name: 'Eggplant', color: '#4A148C', sunNeeds: 'full', minSunHours: 8, spacingInches: 24, phRange: [5.5, 6.5], category: 'fruiting', defaultWidth: 5, defaultDepth: 3, hasTrellis: false },
  'squash-winter': { name: 'Winter Squash', color: '#BF360C', sunNeeds: 'full', minSunHours: 7, spacingInches: 48, phRange: [6.0, 6.8], category: 'fruiting', defaultWidth: 8, defaultDepth: 4, hasTrellis: false },
  // Legumes
  beans: { name: 'Pole Beans', color: '#1B5E20', sunNeeds: 'full', minSunHours: 6, spacingInches: 6, phRange: [6.0, 7.0], category: 'legumes', defaultWidth: 6, defaultDepth: 2, hasTrellis: true, trellisHeight: 6 },
  peas: { name: 'Peas', color: '#43A047', sunNeeds: 'partial', minSunHours: 4, spacingInches: 4, phRange: [6.0, 7.5], category: 'legumes', defaultWidth: 5, defaultDepth: 2, hasTrellis: true, trellisHeight: 4 },
  'bush-beans': { name: 'Bush Beans', color: '#33691E', sunNeeds: 'full', minSunHours: 6, spacingInches: 6, phRange: [6.0, 7.0], category: 'legumes', defaultWidth: 5, defaultDepth: 2.5, hasTrellis: false },
  // Leafy Greens
  kale: { name: 'Kale', color: '#004D40', sunNeeds: 'shade-tolerant', minSunHours: 4, spacingInches: 18, phRange: [6.0, 7.5], category: 'leafy-greens', defaultWidth: 4, defaultDepth: 2.5, hasTrellis: false },
  lettuce: { name: 'Lettuce', color: '#9CCC65', sunNeeds: 'shade-tolerant', minSunHours: 3, spacingInches: 8, phRange: [6.0, 7.0], category: 'leafy-greens', defaultWidth: 4, defaultDepth: 2, hasTrellis: false },
  spinach: { name: 'Spinach', color: '#2E7D32', sunNeeds: 'shade-tolerant', minSunHours: 3, spacingInches: 6, phRange: [6.5, 7.5], category: 'leafy-greens', defaultWidth: 4, defaultDepth: 2, hasTrellis: false },
  'swiss-chard': { name: 'Swiss Chard', color: '#AD1457', sunNeeds: 'shade-tolerant', minSunHours: 4, spacingInches: 12, phRange: [6.0, 7.0], category: 'leafy-greens', defaultWidth: 4, defaultDepth: 2.5, hasTrellis: false },
  arugula: { name: 'Arugula', color: '#7CB342', sunNeeds: 'shade-tolerant', minSunHours: 3, spacingInches: 6, phRange: [6.0, 7.0], category: 'leafy-greens', defaultWidth: 3, defaultDepth: 2, hasTrellis: false },
  'bok-choy': { name: 'Bok Choy', color: '#66BB6A', sunNeeds: 'shade-tolerant', minSunHours: 3, spacingInches: 8, phRange: [6.0, 7.5], category: 'leafy-greens', defaultWidth: 4, defaultDepth: 2, hasTrellis: false },
  // Brassicas
  broccoli: { name: 'Broccoli', color: '#00695C', sunNeeds: 'shade-tolerant', minSunHours: 4, spacingInches: 18, phRange: [6.0, 7.0], category: 'brassicas', defaultWidth: 4, defaultDepth: 2.5, hasTrellis: false },
  cauliflower: { name: 'Cauliflower', color: '#C8B88A', sunNeeds: 'shade-tolerant', minSunHours: 4, spacingInches: 18, phRange: [6.0, 7.0], category: 'brassicas', defaultWidth: 4, defaultDepth: 2.5, hasTrellis: false },
  cabbage: { name: 'Cabbage', color: '#1B5E20', sunNeeds: 'shade-tolerant', minSunHours: 4, spacingInches: 18, phRange: [6.0, 7.5], category: 'brassicas', defaultWidth: 4, defaultDepth: 2.5, hasTrellis: false },
  'brussels-sprouts': { name: 'Brussels Sprouts', color: '#388E3C', sunNeeds: 'shade-tolerant', minSunHours: 4, spacingInches: 24, phRange: [6.0, 6.8], category: 'brassicas', defaultWidth: 5, defaultDepth: 3, hasTrellis: false },
  kohlrabi: { name: 'Kohlrabi', color: '#7E57C2', sunNeeds: 'shade-tolerant', minSunHours: 4, spacingInches: 6, phRange: [6.0, 7.0], category: 'brassicas', defaultWidth: 3, defaultDepth: 2, hasTrellis: false },
  // Root Vegetables
  carrots: { name: 'Carrots', color: '#EF6C00', sunNeeds: 'partial', minSunHours: 5, spacingInches: 3, phRange: [6.0, 6.8], category: 'root-vegetables', defaultWidth: 4, defaultDepth: 2, hasTrellis: false },
  beets: { name: 'Beets', color: '#880E4F', sunNeeds: 'partial', minSunHours: 5, spacingInches: 4, phRange: [6.0, 7.5], category: 'root-vegetables', defaultWidth: 4, defaultDepth: 2, hasTrellis: false },
  radishes: { name: 'Radishes', color: '#D32F2F', sunNeeds: 'partial', minSunHours: 4, spacingInches: 3, phRange: [6.0, 7.0], category: 'root-vegetables', defaultWidth: 3, defaultDepth: 2, hasTrellis: false },
  onions: { name: 'Onions', color: '#F9A825', sunNeeds: 'full', minSunHours: 6, spacingInches: 4, phRange: [6.0, 7.0], category: 'root-vegetables', defaultWidth: 4, defaultDepth: 2, hasTrellis: false },
  garlic: { name: 'Garlic', color: '#F5F5DC', sunNeeds: 'full', minSunHours: 6, spacingInches: 6, phRange: [6.0, 7.0], category: 'root-vegetables', defaultWidth: 3, defaultDepth: 2, hasTrellis: false },
  potatoes: { name: 'Potatoes', color: '#8D6E63', sunNeeds: 'full', minSunHours: 6, spacingInches: 12, phRange: [4.8, 6.0], category: 'root-vegetables', defaultWidth: 6, defaultDepth: 3, hasTrellis: false },
  // Herbs
  herbs: { name: 'Mixed Herbs', color: '#689F38', sunNeeds: 'partial', minSunHours: 5, spacingInches: 12, phRange: [6.0, 7.0], category: 'herbs', defaultWidth: 4, defaultDepth: 2.5, hasTrellis: false },
  basil: { name: 'Basil', color: '#4CAF50', sunNeeds: 'full', minSunHours: 6, spacingInches: 12, phRange: [6.0, 7.0], category: 'herbs', defaultWidth: 3, defaultDepth: 2, hasTrellis: false },
  cilantro: { name: 'Cilantro', color: '#81C784', sunNeeds: 'partial', minSunHours: 4, spacingInches: 6, phRange: [6.2, 6.8], category: 'herbs', defaultWidth: 3, defaultDepth: 2, hasTrellis: false },
  parsley: { name: 'Parsley', color: '#388E3C', sunNeeds: 'partial', minSunHours: 4, spacingInches: 8, phRange: [6.0, 7.0], category: 'herbs', defaultWidth: 3, defaultDepth: 2, hasTrellis: false },
}

const presetByName = new Map(
  (Object.entries(PLANT_PRESETS) as [PlantType, PlantPreset][]).map(([k, v]) => [v.name.toLowerCase(), k]),
)

export function migrateBeds(beds: BedConfig[]): BedConfig[] {
  return beds.map((b) => {
    if (b.plantType) return b
    const match = presetByName.get(b.name.toLowerCase())
    return match ? { ...b, plantType: match } : b
  })
}

export function migrateHeatmapsFromConfig(config: GardenConfig): HeatmapInstance[] {
  if (config.heatmaps && config.heatmaps.length > 0) return config.heatmaps
  if (
    config.heatmapVisible === undefined &&
    config.heatmapCenterX === undefined
  ) {
    return []
  }
  const centerX = config.heatmapCenterX ?? 0
  const centerZ = config.heatmapCenterZ ?? 1
  const width = config.heatmapWidth ?? 28
  const depth = config.heatmapDepth ?? 16
  const legacyMode = (config.heatmapMode as HeatmapInstance['mode']) ?? 'energyRating'
  return [
    {
      id: 'heatmap-1',
      name: 'Heatmap 1',
      visible: config.heatmapVisible ?? false,
      mode: legacyMode,
      opacity: config.heatmapOpacity ?? 0.55,
      centerX,
      centerZ,
      width,
      depth,
    },
  ]
}

export function getMinSunHoursForBed(bed: BedConfig): number {
  if (bed.plantType) return PLANT_PRESETS[bed.plantType].minSunHours
  return bed.sunNeeds === 'full' ? 6 : bed.sunNeeds === 'partial' ? 4 : 3
}

export type MeasurementUnit = 'ft' | 'm'

// Structure types
export type StructureType = 'building' | 'fence'

export interface Structure {
  id: string
  type: StructureType
  name: string
  position: [number, number, number]
  size: [number, number, number]
  color: string
  castShadow: boolean
  receiveShadow: boolean
}

export interface GardenConfig {
  name: string
  savedAt: string
  season: string
  dayOfYear: number
  hour: number
  yardHeadingDeg: number
  structures: Structure[]
  beds: BedConfig[]
  showMeasurements: boolean
  measurementUnit: MeasurementUnit
  gardenItemsOpacity: number
  sunVizRadius?: number
  cityKey?: string
  latitude?: number
  longitude?: number
  cityTz?: string
  showGrid?: boolean
  gridSpacing?: number
  gridCenterX?: number
  gridCenterZ?: number
  gridWidth?: number
  gridDepth?: number
  // Multi-heatmap (current format)
  heatmaps?: HeatmapInstance[]
  // Legacy single-heatmap fields (pre multi-heatmap; migrated on load)
  heatmapVisible?: boolean
  heatmapMode?: string
  heatmapOpacity?: number
  heatmapCenterX?: number
  heatmapCenterZ?: number
  heatmapWidth?: number
  heatmapDepth?: number
}

const STORAGE_KEY = 'garden-planner-configs'
const DEFAULT_CONFIG_KEY = 'garden-planner-default'

export function loadSavedConfigs(): Record<string, GardenConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, GardenConfig>
  } catch {
    return {}
  }
}

export function saveConfigToStorage(config: GardenConfig): void {
  const all = loadSavedConfigs()
  all[config.name] = config
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function deleteConfigFromStorage(name: string): void {
  const all = loadSavedConfigs()
  delete all[name]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  if (getDefaultConfigName() === name) {
    clearDefaultConfig()
  }
}

export function getDefaultConfigName(): string | null {
  return localStorage.getItem(DEFAULT_CONFIG_KEY)
}

export function setDefaultConfigName(name: string): void {
  localStorage.setItem(DEFAULT_CONFIG_KEY, name)
}

export function clearDefaultConfig(): void {
  localStorage.removeItem(DEFAULT_CONFIG_KEY)
}

export function loadDefaultConfig(): GardenConfig | null {
  const name = getDefaultConfigName()
  if (!name) return null
  const all = loadSavedConfigs()
  return all[name] ?? null
}

export function exportConfigToFile(config: GardenConfig): void {
  const json = JSON.stringify(config, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${config.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseConfigFromJson(json: string): GardenConfig | null {
  try {
    const parsed = JSON.parse(json)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.name === 'string' &&
      Array.isArray(parsed.structures) &&
      Array.isArray(parsed.beds)
    ) {
      return parsed as GardenConfig
    }
    return null
  } catch {
    return null
  }
}

