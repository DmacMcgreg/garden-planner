import { useState, useMemo, useCallback, useRef } from 'react'
import GardenScene from './Scene'
import StructurePanel from './StructurePanel'
import BedPanel from './BedPanel'
import ConfigPanel from './ConfigPanel'
import NavSidebar from './NavSidebar'
import AlertPanel from './AlertPanel'
import { layouts, plantLegend } from './layouts'
import type { BedConfig, BedAlert, GardenConfig } from './types'
import {
  getSunPosition,
  getDayOfYear,
  formatTime,
  degreesToCompass,
  calculateSunExposure,
  calculateHeatmapGrid,
  heatmapInstanceBounds,
  createDefaultHeatmap,
  DEFAULT_YARD_HEADING,
  SEASON_DAYS,
  seasonFromDay,
  dayOfYearToLabel,
  todayDayOfYear,
  currentHour,
  type Season,
  type SunExposureResult,
  type HeatmapMode,
  type HeatmapGrid,
  type HeatmapInstance,
} from './sun'
import {
  DEFAULT_STRUCTURES,
  PLANT_PRESETS,
  getMinSunHoursForBed,
  loadDefaultConfig,
  getDefaultConfigName,
  saveConfigToStorage,
  migrateBeds,
  migrateHeatmapsFromConfig,
  type Structure,
  type StructureType,
  type PlantType,
  type MeasurementUnit,
} from './types'

type CompassMode = 'locked' | 'camera-following'

const SEASON_COLORS: Record<Season, string> = {
  spring: 'text-green-400',
  summer: 'text-amber-400',
  fall: 'text-orange-400',
  winter: 'text-blue-400',
}

const HEATMAP_MODES: { value: HeatmapMode; label: string }[] = [
  { value: 'energyRating', label: 'Energy Rating' },
  { value: 'directSunHours', label: 'Direct Sun' },
  { value: 'peakSunHours', label: 'Peak Sun Hrs' },
  { value: 'peakIntensity', label: 'Peak Intensity' },
]

function maxCustomId(items: { id: string }[], prefix: string): number {
  let max = 0
  for (const item of items) {
    if (item.id.startsWith(prefix)) {
      const n = parseInt(item.id.slice(prefix.length), 10)
      if (n > max) max = n
    }
  }
  return max
}

const _defaultConfig = loadDefaultConfig()
const _initialHeatmaps: HeatmapInstance[] = _defaultConfig
  ? migrateHeatmapsFromConfig(_defaultConfig)
  : []

let nextStructureId = maxCustomId(_defaultConfig?.structures ?? DEFAULT_STRUCTURES, 'custom-') + 1
let nextBedId = maxCustomId(_defaultConfig?.beds ?? [], 'custom-bed-') + 1
let nextHeatmapId = maxCustomId(_initialHeatmaps, 'heatmap-') + 1

export default function App() {
  const [layoutIdx, setLayoutIdx] = useState(_defaultConfig?.layoutIdx ?? 0)
  const [dayOfYear, setDayOfYear] = useState(
    _defaultConfig?.dayOfYear ?? getDayOfYear((_defaultConfig?.season as Season) ?? 'summer'),
  )
  const season = seasonFromDay(dayOfYear)
  const [hour, setHour] = useState(_defaultConfig?.hour ?? 14)

  // F2: Garden orientation
  const [yardHeadingDeg, setYardHeadingDeg] = useState(_defaultConfig?.yardHeadingDeg ?? DEFAULT_YARD_HEADING)

  // F1: Compass mode
  const [compassMode, setCompassMode] = useState<CompassMode>('locked')
  const [cameraAzimuth, setCameraAzimuth] = useState(0)

  // F3: Structures
  const [structures, setStructures] = useState<Structure[]>(_defaultConfig?.structures ?? DEFAULT_STRUCTURES)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Garden beds (mutable, cloned from layout presets or default config)
  const [beds, setBeds] = useState<BedConfig[]>(() =>
    migrateBeds(_defaultConfig?.beds ?? structuredClone(layouts[0].beds)),
  )
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)

  // Measurements
  const [showMeasurements, setShowMeasurements] = useState(_defaultConfig?.showMeasurements ?? false)
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>((_defaultConfig?.measurementUnit as MeasurementUnit) ?? 'ft')

  // Sun probe
  const [sunProbeActive, setSunProbeActive] = useState(false)
  const [sunProbePosition, setSunProbePosition] = useState<{ x: number; z: number } | null>(null)

  // Heatmaps (multiple instances)
  const [heatmaps, setHeatmaps] = useState<HeatmapInstance[]>(_initialHeatmaps)
  const [selectedHeatmapId, setSelectedHeatmapId] = useState<string | null>(null)
  const [gardenItemsOpacity, setGardenItemsOpacity] = useState(_defaultConfig?.gardenItemsOpacity ?? 1)

  // Measurement grid
  const _defaultGridWidth = 60
  const _defaultGridDepth = 60
  const [showGrid, setShowGrid] = useState(_defaultConfig?.showGrid ?? false)
  const [gridSpacing, setGridSpacing] = useState(_defaultConfig?.gridSpacing ?? 1)
  const [gridCenterX, setGridCenterX] = useState(_defaultConfig?.gridCenterX ?? 0)
  const [gridCenterZ, setGridCenterZ] = useState(_defaultConfig?.gridCenterZ ?? 0)
  const [gridWidth, setGridWidth] = useState(_defaultConfig?.gridWidth ?? _defaultGridWidth)
  const [gridDepth, setGridDepth] = useState(_defaultConfig?.gridDepth ?? _defaultGridDepth)

  const layout = layouts[layoutIdx]

  // Mutual exclusion: selecting one item deselects the others
  const selectBed = useCallback((id: string | null) => {
    setSelectedBedId(id)
    if (id) {
      setSelectedId(null)
      setSelectedHeatmapId(null)
      requestAnimationFrame(() => {
        const section = document.getElementById('section-beds')
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [])

  const selectStructure = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) {
      setSelectedBedId(null)
      setSelectedHeatmapId(null)
    }
  }, [])

  const selectHeatmap = useCallback((id: string | null) => {
    setSelectedHeatmapId(id)
    if (id) {
      setSelectedId(null)
      setSelectedBedId(null)
      requestAnimationFrame(() => {
        const section = document.getElementById('section-heatmap')
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
  }, [])

  const sun = useMemo(
    () => getSunPosition(dayOfYear, hour, yardHeadingDeg),
    [dayOfYear, hour, yardHeadingDeg],
  )

  const sunExposure = useMemo<SunExposureResult | null>(() => {
    if (!sunProbePosition) return null
    return calculateSunExposure(
      sunProbePosition.x,
      sunProbePosition.z,
      dayOfYear,
      yardHeadingDeg,
      structures,
    )
  }, [sunProbePosition, dayOfYear, yardHeadingDeg, structures])

  const handleSunProbePlace = useCallback((x: number, z: number) => {
    setSunProbePosition({ x, z })
  }, [])

  const heatmapGrids = useMemo<Record<string, HeatmapGrid>>(() => {
    const out: Record<string, HeatmapGrid> = {}
    for (const h of heatmaps) {
      if (!h.visible) continue
      out[h.id] = calculateHeatmapGrid(
        dayOfYear,
        yardHeadingDeg,
        structures,
        1,
        heatmapInstanceBounds(h),
      )
    }
    return out
  }, [heatmaps, dayOfYear, yardHeadingDeg, structures])

  const bedAlerts = useMemo<BedAlert[]>(() => {
    const alerts: BedAlert[] = []
    for (const bed of beds) {
      const minSunHours = getMinSunHoursForBed(bed)
      const exposure = calculateSunExposure(bed.x, bed.z, dayOfYear, yardHeadingDeg, structures)
      if (exposure.peakSunHours < minSunHours) {
        const deficit = minSunHours - exposure.peakSunHours
        alerts.push({
          bedId: bed.id,
          type: 'sun-exposure',
          severity: deficit > 2 ? 'error' : 'warning',
          message: `Needs ${minSunHours}+ PSH but gets ${exposure.peakSunHours.toFixed(1)} here`,
        })
      }
      if (bed.plantType) {
        const preset = PLANT_PRESETS[bed.plantType]
        const spacingFt = preset.spacingInches / 12
        if (bed.width < spacingFt || bed.depth < spacingFt) {
          alerts.push({
            bedId: bed.id,
            type: 'spacing',
            severity: 'error',
            message: `Bed too small for ${preset.spacingInches}" spacing (min ${spacingFt.toFixed(1)}' per side)`,
          })
        }
      }
    }
    return alerts
  }, [beds, dayOfYear, yardHeadingDeg, structures])

  // Dismissed alerts: keyed by "bedId:alertType", auto-cleared on bed move
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  const handleDismissAlert = useCallback((bedId: string, alertType: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(`${bedId}:${alertType}`))
  }, [])

  const activeBedAlerts = useMemo(
    () => bedAlerts.filter((a) => !dismissedAlerts.has(`${a.bedId}:${a.type}`)),
    [bedAlerts, dismissedAlerts],
  )

  const dismissedCount = bedAlerts.length - activeBedAlerts.length

  const handleAddHeatmap = useCallback(() => {
    const num = nextHeatmapId++
    const id = `heatmap-${num}`
    const h = createDefaultHeatmap(id, `Heatmap ${num}`)
    setHeatmaps((prev) => [...prev, h])
    selectHeatmap(id)
  }, [selectHeatmap])

  const handleUpdateHeatmap = useCallback(
    (id: string, patch: Partial<HeatmapInstance>) => {
      setHeatmaps((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)))
    },
    [],
  )

  const handleDeleteHeatmap = useCallback((id: string) => {
    setHeatmaps((prev) => prev.filter((h) => h.id !== id))
    setSelectedHeatmapId((cur) => (cur === id ? null : cur))
  }, [])

  const handleTriggerSunHeatmap = useCallback(() => {
    setHeatmaps((prev) => {
      if (prev.length === 0) {
        const num = nextHeatmapId++
        const id = `heatmap-${num}`
        return [
          {
            ...createDefaultHeatmap(id, `Heatmap ${num}`),
            mode: 'directSunHours',
            opacity: 1,
          },
        ]
      }
      return prev.map((h, i) =>
        i === 0
          ? { ...h, visible: true, mode: 'directSunHours', opacity: 1 }
          : h,
      )
    })
  }, [])

  // F3: Structure mutation callbacks
  const handleAddStructure = useCallback(
    (type: StructureType) => {
      const num = nextStructureId++
      const id = `custom-${num}`
      const newStructure: Structure =
        type === 'building'
          ? {
              id,
              type: 'building',
              name: `Building ${num}`,
              position: [0, 5, 0],
              size: [6, 10, 6],
              color: '#607d8b',
              castShadow: true,
              receiveShadow: true,
            }
          : {
              id,
              type: 'fence',
              name: `Fence ${num}`,
              position: [0, 3, 0],
              size: [10, 6, 0.15],
              color: '#8d6e63',
              castShadow: true,
              receiveShadow: true,
            }
      setStructures((prev) => [...prev, newStructure])
      selectStructure(id)
    },
    [selectStructure],
  )

  const handleUpdateStructure = useCallback(
    (id: string, patch: Partial<Structure>) => {
      setStructures((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      )
    },
    [],
  )

  const handleDeleteStructure = useCallback((id: string) => {
    setStructures((prev) => prev.filter((s) => s.id !== id))
    setSelectedId(null)
  }, [])

  const handleStructureMove = useCallback(
    (id: string, position: [number, number, number]) => {
      setStructures((prev) =>
        prev.map((s) => (s.id === id ? { ...s, position } : s)),
      )
    },
    [],
  )

  const handleResetStructures = useCallback(() => {
    setStructures(DEFAULT_STRUCTURES)
    setSelectedId(null)
  }, [])

  // Bed mutation callbacks
  const handleAddBed = useCallback(
    (plantType: PlantType) => {
      const preset = PLANT_PRESETS[plantType]
      const num = nextBedId++
      const id = `custom-bed-${num}`
      const newBed: BedConfig = {
        id,
        name: `${preset.name} ${num}`,
        x: 0,
        z: 0,
        width: preset.defaultWidth,
        depth: preset.defaultDepth,
        color: preset.color,
        sunNeeds: preset.sunNeeds,
        plantType,
        hasTrellis: preset.hasTrellis,
        trellisHeight: preset.trellisHeight,
      }
      setBeds((prev) => [...prev, newBed])
      selectBed(id)
    },
    [selectBed],
  )

  const handleUpdateBed = useCallback(
    (id: string, patch: Partial<BedConfig>) => {
      setBeds((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
    },
    [],
  )

  const handleDeleteBed = useCallback((id: string) => {
    setBeds((prev) => prev.filter((b) => b.id !== id))
    setSelectedBedId(null)
  }, [])

  const handleBedMove = useCallback(
    (id: string, x: number, z: number) => {
      setBeds((prev) => prev.map((b) => (b.id === id ? { ...b, x, z } : b)))
      // Auto-undismiss alerts for moved bed so user re-evaluates at new position
      setDismissedAlerts((prev) => {
        const next = new Set(prev)
        for (const key of prev) {
          if (key.startsWith(`${id}:`)) next.delete(key)
        }
        return next.size === prev.size ? prev : next
      })
    },
    [],
  )

  const handleResetBeds = useCallback(() => {
    setBeds(migrateBeds(structuredClone(layouts[layoutIdx].beds)))
    setSelectedBedId(null)
  }, [layoutIdx])

  const getCurrentConfig = useCallback(
    (name: string): GardenConfig => ({
      name,
      savedAt: new Date().toISOString(),
      layoutIdx,
      season,
      dayOfYear,
      hour,
      yardHeadingDeg,
      structures,
      beds,
      showMeasurements,
      measurementUnit,
      gardenItemsOpacity,
      showGrid,
      gridSpacing,
      gridCenterX,
      gridCenterZ,
      gridWidth,
      gridDepth,
      heatmaps,
    }),
    [
      layoutIdx, season, dayOfYear, hour, yardHeadingDeg, structures, beds,
      showMeasurements, measurementUnit,
      gardenItemsOpacity, showGrid, gridSpacing,
      gridCenterX, gridCenterZ, gridWidth, gridDepth,
      heatmaps,
    ],
  )

  const [saveFlash, setSaveFlash] = useState<'idle' | 'saved' | 'no-default'>('idle')
  const handleQuickSave = useCallback(() => {
    const name = getDefaultConfigName()
    if (!name) {
      setSaveFlash('no-default')
      setTimeout(() => setSaveFlash('idle'), 2000)
      return
    }
    const config = getCurrentConfig(name)
    saveConfigToStorage(config)
    setSaveFlash('saved')
    setTimeout(() => setSaveFlash('idle'), 1500)
  }, [getCurrentConfig])

  const handleLoadConfig = useCallback((config: GardenConfig) => {
    setLayoutIdx(config.layoutIdx)
    setDayOfYear(config.dayOfYear ?? getDayOfYear(config.season as Season))
    setHour(config.hour)
    setYardHeadingDeg(config.yardHeadingDeg)
    setStructures(config.structures)
    setBeds(migrateBeds(config.beds))
    setShowMeasurements(config.showMeasurements)
    setMeasurementUnit(config.measurementUnit as MeasurementUnit)
    setGardenItemsOpacity(config.gardenItemsOpacity)
    setShowGrid(config.showGrid ?? false)
    setGridSpacing(config.gridSpacing ?? 1)
    setGridCenterX(config.gridCenterX ?? 0)
    setGridCenterZ(config.gridCenterZ ?? 0)
    setGridWidth(config.gridWidth ?? _defaultGridWidth)
    setGridDepth(config.gridDepth ?? _defaultGridDepth)
    const migratedHeatmaps = migrateHeatmapsFromConfig(config)
    setHeatmaps(migratedHeatmaps)
    setSelectedHeatmapId(null)
    setSelectedId(null)
    setSelectedBedId(null)
    nextStructureId = maxCustomId(config.structures, 'custom-') + 1
    nextBedId = maxCustomId(config.beds, 'custom-bed-') + 1
    nextHeatmapId = maxCustomId(migratedHeatmaps, 'heatmap-') + 1
  }, [])

  const sidebarRef = useRef<HTMLElement>(null)

  return (
    <div className="h-screen w-screen flex bg-gray-900 text-white">
      {/* ---- Nav icon bar ---- */}
      <NavSidebar sidebarRef={sidebarRef} />

      {/* ---- Sidebar ---- */}
      <aside
        ref={sidebarRef}
        className="w-[290px] flex-shrink-0 border-r border-gray-700 overflow-y-auto flex flex-col"
        style={{ background: '#1e2330' }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold tracking-tight">
            Backyard Garden Planner
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            24 x 10 ft &middot; Ontario ~43.7&deg;N
          </p>
        </div>

        <hr className="border-gray-700 mx-4" />

        {/* Save / Load */}
        <div id="section-config">
        <ConfigPanel
          getCurrentConfig={getCurrentConfig}
          onLoadConfig={handleLoadConfig}
        />
        </div>

        <hr className="border-gray-700 mx-4" />

        {/* Layout selector */}
        <section id="section-layout" className="px-4 py-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Layout
          </h2>
          <div className="space-y-1.5">
            {layouts.map((l, i) => (
              <button
                key={l.id}
                onClick={() => {
                  setLayoutIdx(i)
                  setBeds(migrateBeds(structuredClone(layouts[i].beds)))
                  setSelectedBedId(null)
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  i === layoutIdx
                    ? 'bg-green-700/60 border border-green-500/60'
                    : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                }`}
              >
                <span className="font-semibold">{l.name}</span>
                <span className="block text-xs text-gray-400 mt-0.5">
                  {l.subtitle}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            {layout.description}
          </p>
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* Season / Date */}
        <section id="section-season" className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Date
            </h2>
            <button
              onClick={() => {
                setDayOfYear(todayDayOfYear())
                setHour(Math.min(21, Math.max(5, Math.round(currentHour() * 4) / 4)))
              }}
              className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-[10px] text-gray-300 font-medium transition-colors"
            >
              Today
            </button>
          </div>
          <input
            type="range"
            min={1}
            max={365}
            step={1}
            value={dayOfYear}
            onChange={(e) => setDayOfYear(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between items-center text-xs mt-1">
            <span className="text-gray-500">Jan</span>
            <span className={`font-semibold ${SEASON_COLORS[season]}`}>
              {dayOfYearToLabel(dayOfYear)} — {season.charAt(0).toUpperCase() + season.slice(1)}
            </span>
            <span className="text-gray-500">Dec</span>
          </div>
          {/* Season snap buttons */}
          <div className="grid grid-cols-4 gap-1 mt-2">
            {(Object.entries(SEASON_DAYS) as [Season, number][]).map(([s, day]) => (
              <button
                key={s}
                onClick={() => setDayOfYear(day)}
                className={`px-2 py-1 rounded text-[10px] font-medium capitalize transition-colors ${
                  season === s
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-800 text-gray-500 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* Time of day */}
        <section id="section-time" className="px-4 py-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Time of Day
          </h2>
          <input
            type="range"
            min={5}
            max={21}
            step={0.25}
            value={hour}
            onChange={(e) => setHour(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5 AM</span>
            <span className="text-amber-400 font-semibold">
              {formatTime(hour)}
            </span>
            <span>9 PM</span>
          </div>
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* Sun info */}
        <section id="section-sun-position" className="px-4 py-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Sun Position
          </h2>
          {sun.isAboveHorizon ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-800 rounded px-3 py-2">
                <div className="text-xs text-gray-500">Altitude</div>
                <div className="font-mono font-semibold text-amber-400">
                  {sun.altitudeDeg.toFixed(1)}&deg;
                </div>
              </div>
              <div className="bg-gray-800 rounded px-3 py-2">
                <div className="text-xs text-gray-500">Azimuth</div>
                <div className="font-mono font-semibold text-amber-400">
                  {sun.azimuthDeg.toFixed(1)}&deg;
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sun is below the horizon</p>
          )}
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* Sun Exposure Probe */}
        <section id="section-sun-exposure" className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Sun Exposure
            </h2>
            <button
              onClick={() => {
                const next = !sunProbeActive
                setSunProbeActive(next)
                if (!next) setSunProbePosition(null)
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors ${
                sunProbeActive
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {sunProbeActive ? 'Probing...' : 'Place Probe'}
            </button>
          </div>

          {sunProbeActive && !sunProbePosition && (
            <p className="text-xs text-amber-400/80">
              Click anywhere on the ground to analyze sun exposure
            </p>
          )}

          {sunProbePosition && sunExposure && (
            <SunExposurePanel
              position={sunProbePosition}
              exposure={sunExposure}
              season={season}
              onClear={() => {
                setSunProbePosition(null)
                setSunProbeActive(false)
              }}
            />
          )}
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* Sun Heatmaps */}
        <section id="section-heatmap" className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Sun Heatmaps
            </h2>
            <button
              onClick={handleAddHeatmap}
              className="text-[10px] px-2 py-0.5 rounded bg-amber-700/70 hover:bg-amber-600 text-white font-medium transition-colors"
              title="Add new heatmap"
            >
              + Add
            </button>
          </div>

          {/* Garden items opacity (global) */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Garden Items Opacity</span>
              <span className="font-mono">{Math.round(gardenItemsOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={gardenItemsOpacity}
              onChange={(e) => setGardenItemsOpacity(parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          {heatmaps.length === 0 && (
            <div className="text-[10px] text-gray-500 italic py-2">
              No heatmaps. Click + Add to create one.
            </div>
          )}

          {heatmaps.map((h) => {
            const isSelected = h.id === selectedHeatmapId
            const grid = heatmapGrids[h.id] ?? null
            return (
              <div
                key={h.id}
                className={`mb-2 rounded border transition-colors ${
                  isSelected
                    ? 'border-amber-500/70 bg-amber-900/10'
                    : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={h.visible}
                    onChange={(e) =>
                      handleUpdateHeatmap(h.id, { visible: e.target.checked })
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="accent-amber-500 flex-shrink-0"
                    title="Show/hide"
                  />
                  <button
                    onClick={() => selectHeatmap(isSelected ? null : h.id)}
                    className="flex-1 text-left text-[11px] font-medium text-gray-200 truncate"
                  >
                    {h.name}
                  </button>
                  <button
                    onClick={() => handleDeleteHeatmap(h.id)}
                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors px-1"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>

                {isSelected && (
                  <div className="px-2 pb-2 space-y-1.5 border-t border-gray-700/60 pt-2">
                    {/* Name */}
                    <input
                      type="text"
                      value={h.name}
                      onChange={(e) =>
                        handleUpdateHeatmap(h.id, { name: e.target.value })
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] focus:border-amber-500 focus:outline-none"
                    />

                    {/* Mode */}
                    <div className="grid grid-cols-2 gap-1">
                      {HEATMAP_MODES.map((m) => (
                        <button
                          key={m.value}
                          onClick={() =>
                            handleUpdateHeatmap(h.id, { mode: m.value })
                          }
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            h.mode === m.value
                              ? 'bg-amber-700 text-white'
                              : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Opacity */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                        <span>Opacity</span>
                        <span className="font-mono">{Math.round(h.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={h.opacity}
                        onChange={(e) =>
                          handleUpdateHeatmap(h.id, {
                            opacity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>

                    {/* Area */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                          cX
                        </span>
                        <input
                          type="number"
                          step={0.5}
                          value={h.centerX}
                          onChange={(e) =>
                            handleUpdateHeatmap(h.id, {
                              centerX: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-gray-900 border border-gray-700 rounded pl-7 pr-1 py-1 text-[10px] font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </label>
                      <label className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                          cZ
                        </span>
                        <input
                          type="number"
                          step={0.5}
                          value={h.centerZ}
                          onChange={(e) =>
                            handleUpdateHeatmap(h.id, {
                              centerZ: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-gray-900 border border-gray-700 rounded pl-7 pr-1 py-1 text-[10px] font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                          W
                        </span>
                        <input
                          type="number"
                          step={1}
                          min={2}
                          value={h.width}
                          onChange={(e) =>
                            handleUpdateHeatmap(h.id, {
                              width: Math.max(2, parseFloat(e.target.value) || 2),
                            })
                          }
                          className="w-full bg-gray-900 border border-gray-700 rounded pl-6 pr-1 py-1 text-[10px] font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </label>
                      <label className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                          D
                        </span>
                        <input
                          type="number"
                          step={1}
                          min={2}
                          value={h.depth}
                          onChange={(e) =>
                            handleUpdateHeatmap(h.id, {
                              depth: Math.max(2, parseFloat(e.target.value) || 2),
                            })
                          }
                          className="w-full bg-gray-900 border border-gray-700 rounded pl-5 pr-1 py-1 text-[10px] font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </label>
                    </div>

                    {h.visible && <HeatmapLegend mode={h.mode} grid={grid} />}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* F2: Garden Orientation */}
        <section id="section-orientation" className="px-4 py-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Garden Orientation
          </h2>
          <input
            type="range"
            min={0}
            max={360}
            step={0.5}
            value={yardHeadingDeg}
            onChange={(e) => setYardHeadingDeg(parseFloat(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between items-center text-xs mt-1">
            <span className="text-gray-500">0&deg;</span>
            <span className="text-emerald-400 font-semibold font-mono">
              {yardHeadingDeg.toFixed(1)}&deg; &mdash;{' '}
              {degreesToCompass(yardHeadingDeg)}
            </span>
            <span className="text-gray-500">360&deg;</span>
          </div>
          {yardHeadingDeg !== DEFAULT_YARD_HEADING && (
            <button
              onClick={() => setYardHeadingDeg(DEFAULT_YARD_HEADING)}
              className="mt-1.5 text-[10px] text-gray-500 hover:text-white transition-colors"
            >
              Reset to {DEFAULT_YARD_HEADING}&deg; (
              {degreesToCompass(DEFAULT_YARD_HEADING)})
            </button>
          )}
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* F1: Compass with mode toggle */}
        <section id="section-compass" className="px-4 py-3 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Compass
            </h2>
            <div className="flex bg-gray-800 rounded overflow-hidden border border-gray-700">
              <button
                onClick={() => setCompassMode('locked')}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  compassMode === 'locked'
                    ? 'bg-emerald-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                N-Up
              </button>
              <button
                onClick={() => setCompassMode('camera-following')}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  compassMode === 'camera-following'
                    ? 'bg-emerald-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Camera
              </button>
            </div>
          </div>
          <CompassRose
            sunAzimuth={sun.isAboveHorizon ? sun.azimuthDeg : -1}
            yardHeadingDeg={yardHeadingDeg}
            compassMode={compassMode}
            cameraAzimuth={cameraAzimuth}
          />
          <span className="text-[10px] text-gray-500 mt-1">
            {compassMode === 'locked' ? 'N-Up (fixed)' : 'Camera View'}
          </span>
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* Measurements toggle */}
        <section id="section-measurements" className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Measurements
            </h2>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showMeasurements}
                onChange={(e) => setShowMeasurements(e.target.checked)}
                className="accent-cyan-500"
              />
              Labels
            </label>
          </div>
          {showMeasurements && (
            <div className="flex bg-gray-800 rounded overflow-hidden border border-gray-700 mb-2">
              <button
                onClick={() => setMeasurementUnit('ft')}
                className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                  measurementUnit === 'ft'
                    ? 'bg-cyan-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Feet
              </button>
              <button
                onClick={() => setMeasurementUnit('m')}
                className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                  measurementUnit === 'm'
                    ? 'bg-cyan-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Metres
              </button>
            </div>
          )}

          {/* Grid overlay */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-700/60">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Ground Grid</span>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="accent-cyan-500"
              />
              Show
            </label>
          </div>
          {showGrid && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                <span>Cell Size</span>
                <span className="font-mono">
                  {gridSpacing < 1
                    ? `${(gridSpacing * 12).toFixed(0)}"`
                    : `${gridSpacing.toFixed(gridSpacing % 1 === 0 ? 0 : 1)} ft`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[0.5, 1, 2, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setGridSpacing(s)}
                    className={`px-1 py-1 rounded text-[10px] font-medium transition-colors ${
                      gridSpacing === s
                        ? 'bg-cyan-700 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                    }`}
                  >
                    {s < 1 ? `${s * 12}"` : `${s}'`}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-gray-600 mt-1 leading-tight">
                Major lines every {(gridSpacing * 5).toFixed(gridSpacing * 5 % 1 === 0 ? 0 : 1)} ft
              </p>

              {/* Grid center + size */}
              <div className="mt-2 pt-2 border-t border-gray-700/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Area</span>
                  <button
                    onClick={() => {
                      setGridCenterX(0)
                      setGridCenterZ(0)
                      setGridWidth(_defaultGridWidth)
                      setGridDepth(_defaultGridDepth)
                    }}
                    className="text-[9px] text-gray-500 hover:text-white transition-colors"
                    title="Reset grid to default center and size"
                  >
                    Reset
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <label className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                      cX
                    </span>
                    <input
                      type="number"
                      step={1}
                      value={gridCenterX}
                      onChange={(e) => setGridCenterX(parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-900 border border-gray-700 rounded pl-7 pr-1 py-1 text-[10px] font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </label>
                  <label className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                      cZ
                    </span>
                    <input
                      type="number"
                      step={1}
                      value={gridCenterZ}
                      onChange={(e) => setGridCenterZ(parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-900 border border-gray-700 rounded pl-7 pr-1 py-1 text-[10px] font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                      W
                    </span>
                    <input
                      type="number"
                      step={5}
                      min={5}
                      max={400}
                      value={gridWidth}
                      onChange={(e) =>
                        setGridWidth(Math.min(400, Math.max(5, parseFloat(e.target.value) || 5)))
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded pl-6 pr-1 py-1 text-[10px] font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </label>
                  <label className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                      D
                    </span>
                    <input
                      type="number"
                      step={5}
                      min={5}
                      max={400}
                      value={gridDepth}
                      onChange={(e) =>
                        setGridDepth(Math.min(400, Math.max(5, parseFloat(e.target.value) || 5)))
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded pl-5 pr-1 py-1 text-[10px] font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </label>
                </div>
                {/* Quick size presets */}
                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  {[20, 40, 60, 120].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setGridWidth(s)
                        setGridDepth(s)
                      }}
                      className={`px-1 py-1 rounded text-[10px] font-medium transition-colors ${
                        gridWidth === s && gridDepth === s
                          ? 'bg-cyan-700 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                      }`}
                      title={`${s} x ${s} ft`}
                    >
                      {s}'
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* Garden beds panel */}
        <div id="section-beds">
        <BedPanel
          beds={beds}
          selectedBedId={selectedBedId}
          onSelect={selectBed}
          onAdd={handleAddBed}
          onUpdate={handleUpdateBed}
          onDelete={handleDeleteBed}
          onReset={handleResetBeds}
          alerts={bedAlerts}
        />
        </div>

        <hr className="border-gray-700 mx-4" />

        {/* Plant legend */}
        <section id="section-legend" className="px-4 py-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Plant Legend
          </h2>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {plantLegend.map((p) => (
              <div key={p.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: p.color }}
                />
                <span className="font-medium">{p.name}</span>
                <span className="text-gray-500 ml-auto text-[10px]">
                  {p.sun}
                </span>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-gray-700 mx-4" />

        {/* F3: Structures panel */}
        <div id="section-structures">
        <StructurePanel
          structures={structures}
          selectedId={selectedId}
          onSelect={selectStructure}
          onAdd={handleAddStructure}
          onUpdate={handleUpdateStructure}
          onDelete={handleDeleteStructure}
          onReset={handleResetStructures}
        />
        </div>

        {/* Bottom spacer */}
        <div className="h-4 flex-shrink-0" />
      </aside>

      {/* ---- 3D Scene ---- */}
      <main className="flex-1 relative">
        <GardenScene
          layout={layout}
          season={season}
          dayOfYear={dayOfYear}
          hour={hour}
          yardHeadingDeg={yardHeadingDeg}
          structures={structures}
          selectedId={selectedId}
          beds={beds}
          selectedBedId={selectedBedId}
          onCameraAzimuthChange={setCameraAzimuth}
          onSelectStructure={selectStructure}
          onStructureMove={handleStructureMove}
          onSelectBed={selectBed}
          onBedMove={handleBedMove}
          onBedUpdate={handleUpdateBed}
          showMeasurements={showMeasurements}
          measurementUnit={measurementUnit}
          sunProbeActive={sunProbeActive}
          sunProbePosition={sunProbePosition}
          onSunProbePlace={handleSunProbePlace}
          heatmaps={heatmaps}
          heatmapGrids={heatmapGrids}
          selectedHeatmapId={selectedHeatmapId}
          onSelectHeatmap={selectHeatmap}
          onUpdateHeatmap={handleUpdateHeatmap}
          gardenItemsOpacity={gardenItemsOpacity}
          showGrid={showGrid}
          gridSpacing={gridSpacing}
          gridCenterX={gridCenterX}
          gridCenterZ={gridCenterZ}
          gridWidth={gridWidth}
          gridDepth={gridDepth}
        />

        {/* HUD overlay */}
        <div className="absolute top-4 left-4 bg-black/65 backdrop-blur-sm text-white px-4 py-2 rounded-lg pointer-events-none">
          <div className="text-sm font-semibold">
            {sun.isAboveHorizon ? '\u2600' : '\u263D'}{' '}
            {formatTime(hour)} &mdash;{' '}
            {season.charAt(0).toUpperCase() + season.slice(1)}{' '}
            {sun.isAboveHorizon
              ? `(alt: ${sun.altitudeDeg.toFixed(1)}\u00B0)`
              : '(below horizon)'}
          </div>
          <div className="text-xs text-gray-300 mt-0.5">
            {layout.name} &middot; Heading:{' '}
            {degreesToCompass(yardHeadingDeg)} ({yardHeadingDeg.toFixed(0)}&deg;)
          </div>
        </div>

        {/* Canvas overlay controls (top-right) */}
        <div className="absolute top-4 right-4 z-10 flex items-start gap-2">
          {/* Quick save */}
          <button
            onClick={handleQuickSave}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg backdrop-blur-sm text-sm font-medium transition-colors ${
              saveFlash === 'saved'
                ? 'bg-emerald-900/70 text-emerald-200'
                : saveFlash === 'no-default'
                  ? 'bg-red-900/70 text-red-200'
                  : 'bg-gray-800/70 text-gray-400 hover:bg-gray-800/85 hover:text-gray-200'
            }`}
            title="Save to default config"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              {saveFlash === 'saved' ? (
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              ) : (
                <path d="M13.75 7h-3v5.296l1.943-2.048a.75.75 0 011.114 1.004l-3.25 3.5a.75.75 0 01-1.114 0l-3.25-3.5a.75.75 0 111.114-1.004l1.943 2.048V7h-3A1.75 1.75 0 004.5 8.75v7.5c0 .966.784 1.75 1.75 1.75h7.5A1.75 1.75 0 0015.5 16.25v-7.5A1.75 1.75 0 0013.75 7z" />
              )}
            </svg>
            <span>
              {saveFlash === 'saved'
                ? 'Saved'
                : saveFlash === 'no-default'
                  ? 'Set a default first'
                  : 'Save'}
            </span>
          </button>

          {/* Alert notification panel */}
          <AlertPanel
            alerts={activeBedAlerts}
            dismissedCount={dismissedCount}
            beds={beds}
            onSelectBed={selectBed}
            onDismiss={handleDismissAlert}
            onTriggerSunHeatmap={handleTriggerSunHeatmap}
          />
        </div>

        {/* Controls hint */}
        <div className="absolute bottom-4 right-4 bg-black/50 text-gray-400 text-xs px-3 py-1.5 rounded pointer-events-none">
          {sunProbeActive
            ? 'Click on the ground to place sun probe'
            : 'Drag to orbit \u00B7 Scroll to zoom \u00B7 Click bed or structure to select/move'}
        </div>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Heatmap Legend                                                    */
/* ------------------------------------------------------------------ */

function HeatmapLegend({
  mode,
  grid,
}: {
  mode: HeatmapMode
  grid: HeatmapGrid | null
}) {
  let maxLabel: string;
  let unit: string;
  if (!grid) {
    maxLabel = '...';
    unit = '';
  } else {
    switch (mode) {
      case 'directSunHours':
        maxLabel = grid.maxDirectSunHours.toFixed(1);
        unit = 'h';
        break;
      case 'peakSunHours':
        maxLabel = grid.maxPeakSunHours.toFixed(1);
        unit = ' PSH';
        break;
      case 'peakIntensity':
        maxLabel = grid.maxPeakIntensity.toFixed(2);
        unit = '';
        break;
      case 'energyRating':
        maxLabel = grid.maxEnergyRating.toFixed(1);
        unit = '/10';
        break;
    }
  }

  return (
    <div className="bg-gray-800 rounded px-2.5 py-2">
      <div
        className="h-2.5 rounded-full mb-1"
        style={{
          background: 'linear-gradient(90deg, rgb(0,0,0), rgb(0,0,200), rgb(0,200,220), rgb(0,220,0), rgb(255,255,0), rgb(255,0,0))',
        }}
      />
      <div className="flex justify-between text-[9px] text-gray-500 font-mono">
        <span>0{unit}</span>
        <span>{maxLabel}{unit}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sun Exposure Panel                                                */
/* ------------------------------------------------------------------ */

function SunExposurePanel({
  position,
  exposure,
  season,
  onClear,
}: {
  position: { x: number; z: number }
  exposure: SunExposureResult
  season: Season
  onClear: () => void
}) {
  // Energy rating color
  const ratingColor =
    exposure.energyRating >= 7
      ? '#22c55e' // green — full sun
      : exposure.energyRating >= 4
        ? '#eab308' // yellow — partial
        : '#ef4444' // red — shade

  const ratingLabel =
    exposure.energyRating >= 7
      ? 'Full Sun'
      : exposure.energyRating >= 4
        ? 'Partial Sun'
        : 'Shade'

  return (
    <div className="space-y-2">
      {/* Position & clear */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-mono">
          Point ({position.x.toFixed(1)}, {position.z.toFixed(1)})
        </span>
        <button
          onClick={onClear}
          className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Energy rating bar */}
      <div className="bg-gray-800 rounded px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Energy Rating</span>
          <span
            className="text-xs font-bold"
            style={{ color: ratingColor }}
          >
            {exposure.energyRating.toFixed(1)}/10 — {ratingLabel}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${exposure.energyRating * 10}%`,
              background: `linear-gradient(90deg, #ef4444, #eab308, #22c55e)`,
            }}
          />
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-gray-800 rounded px-2.5 py-1.5">
          <div className="text-[10px] text-gray-500">Direct Sun</div>
          <div className="text-sm font-mono font-semibold text-amber-400">
            {exposure.directSunHours.toFixed(1)}h
          </div>
        </div>
        <div className="bg-gray-800 rounded px-2.5 py-1.5">
          <div className="text-[10px] text-gray-500">Peak Sun Hours</div>
          <div className="text-sm font-mono font-semibold text-orange-400">
            {exposure.peakSunHours.toFixed(1)} PSH
          </div>
        </div>
        <div className="bg-gray-800 rounded px-2.5 py-1.5">
          <div className="text-[10px] text-gray-500">Peak Intensity</div>
          <div className="text-sm font-mono font-semibold text-yellow-300">
            {exposure.peakIntensity.toFixed(2)}
          </div>
        </div>
        <div className="bg-gray-800 rounded px-2.5 py-1.5">
          <div className="text-[10px] text-gray-500">Peak At</div>
          <div className="text-sm font-mono font-semibold text-yellow-300">
            {formatTime(exposure.peakHour)}
          </div>
        </div>
      </div>

      {/* Hourly bar chart */}
      <div className="bg-gray-800 rounded px-2.5 py-2">
        <div className="text-[10px] text-gray-500 mb-1.5">
          Hourly Exposure — {season.charAt(0).toUpperCase() + season.slice(1)}
        </div>
        <div className="flex items-end gap-px h-12">
          {exposure.hourly.map((h) => {
            const barH = h.altitudeDeg > 0
              ? Math.max(2, (h.intensity / 1.5) * 100)
              : 0
            return (
              <div
                key={h.hour}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${barH}%`,
                  backgroundColor: h.isObstructed
                    ? '#374151' // gray — shadowed
                    : h.intensity > 1
                      ? '#f59e0b' // bright amber
                      : h.intensity > 0.5
                        ? '#d97706' // medium amber
                        : '#92400e', // dim amber
                  opacity: h.isObstructed ? 0.5 : 1,
                }}
                title={`${formatTime(h.hour)}: ${h.altitudeDeg.toFixed(1)} alt, ${h.isObstructed ? 'shadowed' : 'direct'}`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
          <span>
            {exposure.hourly.length > 0
              ? formatTime(exposure.hourly[0].hour)
              : ''}
          </span>
          <span>
            {exposure.hourly.length > 0
              ? formatTime(exposure.hourly[exposure.hourly.length - 1].hour)
              : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-amber-500" />
            <span className="text-[8px] text-gray-500">Direct</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-gray-600 opacity-50" />
            <span className="text-[8px] text-gray-500">Shadowed</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Compass Rose SVG (F1 + F2)                                       */
/* ------------------------------------------------------------------ */

interface CompassRoseProps {
  sunAzimuth: number
  yardHeadingDeg: number
  compassMode: CompassMode
  cameraAzimuth: number
}

function CompassRose({
  sunAzimuth,
  yardHeadingDeg,
  compassMode,
  cameraAzimuth,
}: CompassRoseProps) {
  // In camera-following mode, rotate the compass content to match the camera view
  const rotationOffset =
    compassMode === 'camera-following'
      ? -cameraAzimuth * (180 / Math.PI)
      : 0

  return (
    <svg viewBox="-55 -55 110 110" className="w-36 h-36">
      {/* Bezel (fixed, does not rotate) */}
      <circle
        cx="0"
        cy="0"
        r="50"
        fill="#111827"
        stroke={compassMode === 'camera-following' ? '#059669' : '#374151'}
        strokeWidth={compassMode === 'camera-following' ? 1.5 : 1}
      />

      {/* Rotatable inner content */}
      <g transform={`rotate(${rotationOffset})`}>
        {/* Tick marks */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1={42 * Math.sin((deg * Math.PI) / 180)}
            y1={-42 * Math.cos((deg * Math.PI) / 180)}
            x2={48 * Math.sin((deg * Math.PI) / 180)}
            y2={-48 * Math.cos((deg * Math.PI) / 180)}
            stroke="#6b7280"
            strokeWidth={deg % 90 === 0 ? 1.5 : 0.8}
          />
        ))}

        {/* Cardinal labels */}
        <text x="0" y="-38" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="bold">N</text>
        <text x="38" y="3.5" textAnchor="middle" fill="#d1d5db" fontSize="8" fontWeight="bold">E</text>
        <text x="0" y="44" textAnchor="middle" fill="#d1d5db" fontSize="8" fontWeight="bold">S</text>
        <text x="-38" y="3.5" textAnchor="middle" fill="#d1d5db" fontSize="8" fontWeight="bold">W</text>

        {/* Yard rectangle (rotated to dynamic heading) */}
        <g transform={`rotate(${yardHeadingDeg})`}>
          <rect
            x="-22"
            y="-8"
            width="44"
            height="16"
            rx="1.5"
            fill="rgba(74,124,74,0.5)"
            stroke="#7cb342"
            strokeWidth="1"
          />
          {/* House indicator */}
          <rect
            x="22"
            y="-10"
            width="6"
            height="20"
            rx="1"
            fill="rgba(120,113,108,0.7)"
            stroke="#9e9e9e"
            strokeWidth="0.5"
          />
          <text
            x="0"
            y="2.5"
            textAnchor="middle"
            fill="#c5e1a5"
            fontSize="5.5"
            fontWeight="600"
          >
            YARD
          </text>
        </g>

        {/* Sun position dot */}
        {sunAzimuth >= 0 && (
          <g transform={`rotate(${sunAzimuth})`}>
            <circle cx="0" cy="-32" r="4" fill="#FFD700" />
            <line
              x1="0"
              y1="-28"
              x2="0"
              y2="-22"
              stroke="#FFD700"
              strokeWidth="1"
              opacity="0.6"
            />
          </g>
        )}
      </g>
    </svg>
  )
}
