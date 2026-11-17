import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
// Lazy-load the 3D scene so Three.js + drei ship in a separate chunk that
// loads after first paint. A lightweight fallback renders while it streams in.
const GardenScene = lazy(() => import('./Scene'))
import { Box, Camera, Check, ChevronRight, Grid2X2, Image as ImageIcon, Leaf, MapPin, Maximize, Minimize, Ruler, Save, SlidersHorizontal, Sprout, Sun, Tags } from 'lucide-react'
import { ORIGINAL_YARD, STARTER_BEDS, starterStructures, type YardSize, type GardenView } from './garden'
import { layouts, classicStructures } from './layouts'
import { PlantCatalog, LayoutPicker } from './PlantLibrary'
import { SunlightPanel } from './SunlightPanel'
import { PlannerTools } from './PlannerTools'
import { YardPhotoEditor, type YardPhoto } from './YardPhoto'
import StructurePanel from './StructurePanel'
import BedPanel from './BedPanel'
import ConfigPanel from './ConfigPanel'
import AlertPanel from './AlertPanel'
import { ErrorBoundary } from './ErrorBoundary'
import type { BedConfig, BedAlert, GardenConfig } from './types'
import {
  getSunPosition,
  getDayOfYear,
  calculateSunExposure,
  calculateSunExposureBatch,
  bedInSun,
  calculateHeatmapGrid,
  heatmapInstanceBounds,
  createDefaultHeatmap,
  DEFAULT_YARD_HEADING,
  seasonFromDay,
  formatTime,
  degreesToCompass,
  type Season,
  type SunExposureResult,
  type SunLocation,
  type HeatmapGrid,
  type HeatmapInstance,
} from './sun'
import {
  DEFAULT_CITY_KEY,
  cityKey,
  findCityByKey,
  getTzOffsetHours,
  type CityRecord,
} from './cities'
import {
  PLANT_PRESETS,
  getMinSunHoursForBed,
  getDefaultConfigName,
  saveConfigToStorage,
  migrateBeds,
  migrateHeatmapsFromConfig,
  type Structure,
  type StructureType,
  type PlantType,
  type MeasurementUnit,
} from './types'
// Presentational sidebar sections (extracted for desktop + mobile reuse).
import {
  DateSection,
  TimeSection,
  SunPositionSection,
  SunExposureSection,
  HeatmapSection,
  LocationSection,
  OrientationSection,
  CompassSection,
  MeasurementsSection,
  type CompassMode,
} from './sections'

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

export default function App({ initialConfig, fromBackup = false }: {
  initialConfig: GardenConfig | null
  fromBackup?: boolean
}) {
  const [initialHeatmaps] = useState(() => initialConfig ? migrateHeatmapsFromConfig(initialConfig) : [])
  const nextStructureId = useRef(maxCustomId(initialConfig?.structures ?? [], 'custom-') + 1)
  const nextBedId = useRef(maxCustomId(initialConfig?.beds ?? [], 'custom-bed-') + 1)
  const nextHeatmapId = useRef(maxCustomId(initialHeatmaps, 'heatmap-') + 1)
  const [view, setView] = useState<GardenView>(fromBackup ? 'plan' : 'orbit')
  const [gardenName, setGardenName] = useState(initialConfig?.name)
  const [tool, setTool] = useState<string | null>(null)
  const [labels, setLabels] = useState(!fromBackup)
  const [original, setOriginal] = useState(false)
  const [comparison, setComparison] = useState(50)
  const [photo, setPhoto] = useState<YardPhoto | null>(initialConfig?.yardPhoto ?? null)
  const [yard, setYard] = useState<YardSize>(initialConfig?.yard ?? ORIGINAL_YARD)
  const [landscape, setLandscape] = useState(initialConfig ? !!initialConfig.landscape : true)
  const [showSunPath, setShowSunPath] = useState(initialConfig?.showSunPath ?? !!initialConfig)
  const [layoutIdx, setLayoutIdx] = useState(initialConfig?.layoutIdx)
  const [yardGuides, setYardGuides] = useState(initialConfig?.yardGuides ?? (!!initialConfig && !initialConfig.yard))
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  function changeView(next: GardenView) {
    setView(next)
    setOriginal(false)
  }
  const [dayOfYear, setDayOfYear] = useState(
    initialConfig?.dayOfYear ?? getDayOfYear((initialConfig?.season as Season) ?? 'summer'),
  )
  const season = seasonFromDay(dayOfYear)
  const [hour, setHour] = useState(initialConfig?.hour ?? 9.5)

  // F2: Garden orientation
  const [yardHeadingDeg, setYardHeadingDeg] = useState(
    initialConfig?.yardHeadingDeg ?? DEFAULT_YARD_HEADING,
  )

  // F2b: Geographic location — drives latitude/longitude/tz for sun math
  const [city, setCity] = useState<CityRecord>(() => {
    const fromKey = findCityByKey(initialConfig?.cityKey ?? '')
    if (fromKey) return fromKey
    if (initialConfig?.latitude != null) {
      return {
        name: 'Custom',
        admin: '',
        country: '',
        lat: initialConfig.latitude,
        lon: initialConfig.longitude ?? 0,
        tz: initialConfig.cityTz ?? 'UTC',
      }
    }
    return findCityByKey(DEFAULT_CITY_KEY)!
  })

  // F1: Compass mode
  const [compassMode, setCompassMode] = useState<CompassMode>('locked')
  const [cameraAzimuth, setCameraAzimuth] = useState(0)

  // F3: Structures
  const [structures, setStructures] = useState<Structure[]>(
    () => initialConfig?.structures ?? starterStructures(ORIGINAL_YARD),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Garden beds (user-defined; loaded from saved config or empty)
  const [beds, setBeds] = useState<BedConfig[]>(() => migrateBeds(initialConfig?.beds ?? STARTER_BEDS))
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)

  // Measurements
  const [showMeasurements, setShowMeasurements] = useState(initialConfig?.showMeasurements ?? false)
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>(
    (initialConfig?.measurementUnit as MeasurementUnit) ?? 'ft',
  )

  // Sun probe
  const [sunProbeActive, setSunProbeActive] = useState(false)
  const [sunProbePosition, setSunProbePosition] = useState<{ x: number; z: number } | null>(null)

  // Heatmaps (multiple instances)
  const [heatmaps, setHeatmaps] = useState<HeatmapInstance[]>(initialHeatmaps)
  const [selectedHeatmapId, setSelectedHeatmapId] = useState<string | null>(null)
  const [gardenItemsOpacity, setGardenItemsOpacity] = useState(initialConfig?.gardenItemsOpacity ?? 1)
  const [sunVizRadius, setSunVizRadius] = useState(initialConfig?.sunVizRadius ?? 32)
  const [resetViewNonce, setResetViewNonce] = useState(0)
  // Bumping this remounts the lazy <Scene> after a chunk-load error so the
  // import is retried (React.lazy otherwise caches the rejected promise).
  const [sceneRetryKey, setSceneRetryKey] = useState(0)

  // Measurement grid
  const _defaultGridWidth = 60
  const _defaultGridDepth = 60
  const [showGrid, setShowGrid] = useState(initialConfig?.showGrid ?? false)
  const [gridSpacing, setGridSpacing] = useState(initialConfig?.gridSpacing ?? 1)
  const [gridCenterX, setGridCenterX] = useState(initialConfig?.gridCenterX ?? 0)
  const [gridCenterZ, setGridCenterZ] = useState(initialConfig?.gridCenterZ ?? 0)
  const [gridWidth, setGridWidth] = useState(initialConfig?.gridWidth ?? _defaultGridWidth)
  const [gridDepth, setGridDepth] = useState(initialConfig?.gridDepth ?? _defaultGridDepth)

  // Mutual exclusion: selecting one item deselects the others
  const selectBed = useCallback((id: string | null) => {
    setSelectedBedId(id)
    if (id) {
      setSelectedId(null)
      setSelectedHeatmapId(null)
      setTool(current => current === 'section-structures' || current === 'section-heatmap' ? 'section-beds' : current)
    }
  }, [])

  const selectStructure = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) {
      setSelectedBedId(null)
      setSelectedHeatmapId(null)
      setTool(current => current === 'section-beds' || current === 'section-heatmap' ? 'section-structures' : current)
    }
  }, [])

  const selectHeatmap = useCallback((id: string | null) => {
    setSelectedHeatmapId(id)
    if (id) {
      setSelectedId(null)
      setSelectedBedId(null)
      setTool(current => current === 'section-structures' || current === 'section-beds' ? 'section-heatmap' : current)
    }
  }, [])

  const sunLocation = useMemo<SunLocation>(() => {
    // Build a Date for the current dayOfYear in the current year so that
    // getTzOffsetHours resolves DST at the right calendar moment.
    const year = new Date().getFullYear()
    const date = new Date(Date.UTC(year, 0, 1, 12, 0, 0))
    date.setUTCDate(dayOfYear)
    return {
      latitude: city.lat,
      longitude: city.lon,
      tzOffsetHours: getTzOffsetHours(city.tz, date),
    }
  }, [city, dayOfYear])

  const sun = useMemo(
    () => getSunPosition(dayOfYear, hour, yardHeadingDeg, sunLocation),
    [dayOfYear, hour, yardHeadingDeg, sunLocation],
  )

  const sunExposure = useMemo<SunExposureResult | null>(() => {
    if (!sunProbePosition) return null
    return calculateSunExposure(
      sunProbePosition.x,
      sunProbePosition.z,
      dayOfYear,
      yardHeadingDeg,
      structures,
      sunLocation,
    )
  }, [sunProbePosition, dayOfYear, yardHeadingDeg, structures, sunLocation])

  const handleSunProbePlace = useCallback((x: number, z: number) => {
    setSunProbePosition({ x, z })
    setTool('section-sun-exposure')
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
        sunLocation,
      )
    }
    return out
  }, [heatmaps, dayOfYear, yardHeadingDeg, structures, sunLocation])

  const exposures = useMemo(
    () =>
      calculateSunExposureBatch(
        beds.map((b) => ({ x: b.x, z: b.z })),
        dayOfYear,
        yardHeadingDeg,
        structures,
        sunLocation,
      ),
    [beds, dayOfYear, yardHeadingDeg, structures, sunLocation],
  )

  const bedAlerts = useMemo<BedAlert[]>(() => {
    const alerts: BedAlert[] = []
    beds.forEach((bed, i) => {
      const minSunHours = getMinSunHoursForBed(bed)
      const exposure = exposures[i]
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
    })
    return alerts
  }, [beds, exposures])

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
    const num = nextHeatmapId.current++
    const id = `heatmap-${num}`
    const h = createDefaultHeatmap(id, `Heatmap ${num}`)
    setHeatmaps((prev) => [...prev, h])
    selectHeatmap(id)
  }, [selectHeatmap])

  const handleUpdateHeatmap = useCallback((id: string, patch: Partial<HeatmapInstance>) => {
    setHeatmaps((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)))
  }, [])

  const handleDeleteHeatmap = useCallback((id: string) => {
    setHeatmaps((prev) => prev.filter((h) => h.id !== id))
    setSelectedHeatmapId((cur) => (cur === id ? null : cur))
  }, [])

  const handleTriggerSunHeatmap = useCallback(() => {
    setHeatmaps((prev) => {
      if (prev.length === 0) {
        const num = nextHeatmapId.current++
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
        i === 0 ? { ...h, visible: true, mode: 'directSunHours', opacity: 1 } : h,
      )
    })
  }, [])

  // F3: Structure mutation callbacks
  const handleAddStructure = useCallback(
    (type: StructureType) => {
      const num = nextStructureId.current++
      const id = `custom-${num}`
      const newStructure: Structure =
        type === 'tree'
          ? {
              id,
              type,
              name: `Tree ${num}`,
              position: [0, 6, 0],
              size: [8, 12, 8],
              color: '#638147',
              castShadow: true,
              receiveShadow: true,
            }
          : type === 'building'
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

  const handleUpdateStructure = useCallback((id: string, patch: Partial<Structure>) => {
    setStructures((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const handleDeleteStructure = useCallback((id: string) => {
    setStructures((prev) => prev.filter((s) => s.id !== id))
    setSelectedId(null)
  }, [])

  const handleStructureMove = useCallback((id: string, position: [number, number, number]) => {
    setStructures((prev) => prev.map((s) => (s.id === id ? { ...s, position } : s)))
  }, [])

  const handleResetStructures = useCallback(() => {
    setStructures([])
    setSelectedId(null)
  }, [])

  // Bed mutation callbacks
  const handleAddBed = useCallback(
    (plantType: PlantType) => {
      const preset = PLANT_PRESETS[plantType]
      const num = nextBedId.current++
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

  const handleUpdateBed = useCallback((id: string, patch: Partial<BedConfig>) => {
    setBeds(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
    if (patch.x !== undefined || patch.z !== undefined) {
      setDismissedAlerts(prev => {
        const next = new Set(prev)
        next.delete(id + ':sun-exposure')
        next.delete(id + ':spacing')
        return next.size === prev.size ? prev : next
      })
    }
  }, [])

  const handleDeleteBed = useCallback((id: string) => {
    setBeds((prev) => prev.filter((b) => b.id !== id))
    setSelectedBedId(null)
  }, [])

  const handleBedMove = useCallback((id: string, x: number, z: number) => {
    handleUpdateBed(id, { x, z })
  }, [handleUpdateBed])

  const handleResetBeds = useCallback(() => {
    setBeds([])
    setSelectedBedId(null)
  }, [])

  const getCurrentConfig = useCallback(
    (name: string): GardenConfig => ({
      name,
      savedAt: new Date().toISOString(),
      yard,
      yardPhoto: photo ?? undefined,
      layoutIdx,
      yardGuides,
      landscape,
      showSunPath,
      season,
      dayOfYear,
      hour,
      yardHeadingDeg,
      structures,
      beds,
      showMeasurements,
      measurementUnit,
      gardenItemsOpacity,
      sunVizRadius,
      cityKey: cityKey(city),
      latitude: city.lat,
      longitude: city.lon,
      cityTz: city.tz,
      showGrid,
      gridSpacing,
      gridCenterX,
      gridCenterZ,
      gridWidth,
      gridDepth,
      heatmaps,
    }),
    [
      yard,
      layoutIdx,
      yardGuides,
      photo,
      landscape,
      showSunPath,
      season,
      dayOfYear,
      hour,
      yardHeadingDeg,
      structures,
      beds,
      showMeasurements,
      measurementUnit,
      gardenItemsOpacity,
      sunVizRadius,
      city,
      showGrid,
      gridSpacing,
      gridCenterX,
      gridCenterZ,
      gridWidth,
      gridDepth,
      heatmaps,
    ],
  )

  const [saveFlash, setSaveFlash] = useState<'idle' | 'saved' | 'full'>('idle')
  const handleQuickSave = useCallback(() => {
    const name = getDefaultConfigName()
    if (!name || fromBackup) {
      setTool('section-config')
      setTimeout(() => setSaveFlash('idle'), 2000)
      return
    }
    const config = getCurrentConfig(name)
    try {
      saveConfigToStorage(config)
      setSaveFlash('saved')
    } catch {
      setSaveFlash('full')
      setTool('section-config')
    }
    setTimeout(() => setSaveFlash('idle'), 1500)
  }, [fromBackup, getCurrentConfig])

  const handleLoadConfig = useCallback((config: GardenConfig) => {
    setGardenName(config.name)
    setDayOfYear(config.dayOfYear ?? getDayOfYear((config.season as Season) ?? 'summer'))
    setResetViewNonce(n => n + 1)
    setPhoto(config.yardPhoto ?? null)
    setYard(config.yard ?? ORIGINAL_YARD)
    setLayoutIdx(config.layoutIdx)
    setYardGuides(config.yardGuides ?? !config.yard)
    setLandscape(!!config.landscape)
    setOriginal(false)
    setShowSunPath(config.showSunPath ?? true)
    setDismissedAlerts(new Set())
    setSunProbePosition(null)
    setSunProbeActive(false)
    setHour(config.hour ?? 14)
    setYardHeadingDeg(config.yardHeadingDeg ?? DEFAULT_YARD_HEADING)
    const restoredCity =
      findCityByKey(config.cityKey ?? '') ??
      (config.latitude != null
        ? {
            name: 'Custom',
            admin: '',
            country: '',
            lat: config.latitude,
            lon: config.longitude ?? 0,
            tz: config.cityTz ?? 'UTC',
          }
        : findCityByKey(DEFAULT_CITY_KEY)!)
    setCity(restoredCity)
    setStructures(config.structures)
    setBeds(migrateBeds(config.beds))
    setShowMeasurements(config.showMeasurements)
    setMeasurementUnit(config.measurementUnit ?? 'ft')
    setGardenItemsOpacity(config.gardenItemsOpacity ?? 1)
    setSunVizRadius(config.sunVizRadius ?? 32)
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
    nextStructureId.current = maxCustomId(config.structures, 'custom-') + 1
    nextBedId.current = maxCustomId(config.beds, 'custom-bed-') + 1
    nextHeatmapId.current = maxCustomId(migratedHeatmaps, 'heatmap-') + 1
  }, [])

  const renderSectionBody = useCallback(
    (id: string) => {
      switch (id) {
        case 'section-config':
          return <ConfigPanel getCurrentConfig={getCurrentConfig} onLoadConfig={handleLoadConfig} />
        case 'section-season':
          return (
            <DateSection
              dayOfYear={dayOfYear}
              season={season}
              setDayOfYear={setDayOfYear}
              setHour={setHour}
            />
          )
        case 'section-time':
          return <TimeSection hour={hour} setHour={setHour} />
        case 'section-sun-position':
          return (
            <SunPositionSection
              sun={sun}
              sunVizRadius={sunVizRadius}
              setSunVizRadius={setSunVizRadius}
            />
          )
        case 'section-sun-exposure':
          return (
            <SunExposureSection
              sunProbeActive={sunProbeActive}
              sunProbePosition={sunProbePosition}
              sunExposure={sunExposure}
              season={season}
              setSunProbeActive={(active) => {
                setSunProbeActive(active)
                if (active && !window.matchMedia('(min-width: 1024px)').matches) setTool(null)
              }}
              setSunProbePosition={setSunProbePosition}
            />
          )
        case 'section-heatmap':
          return (
            <HeatmapSection
              heatmaps={heatmaps}
              heatmapGrids={heatmapGrids}
              selectedHeatmapId={selectedHeatmapId}
              gardenItemsOpacity={gardenItemsOpacity}
              selectHeatmap={selectHeatmap}
              handleAddHeatmap={handleAddHeatmap}
              handleUpdateHeatmap={handleUpdateHeatmap}
              handleDeleteHeatmap={handleDeleteHeatmap}
              setGardenItemsOpacity={setGardenItemsOpacity}
            />
          )
        case 'section-location':
          return <LocationSection city={city} sunLocation={sunLocation} setCity={setCity} />
        case 'section-orientation':
          return (
            <OrientationSection
              yardHeadingDeg={yardHeadingDeg}
              setYardHeadingDeg={setYardHeadingDeg}
              DEFAULT_YARD_HEADING={DEFAULT_YARD_HEADING}
            />
          )
        case 'section-compass':
          return (
            <CompassSection
              sun={sun}
              yardHeadingDeg={yardHeadingDeg}
              compassMode={compassMode}
              cameraAzimuth={cameraAzimuth}
              setCompassMode={setCompassMode}
              setResetViewNonce={setResetViewNonce}
            />
          )
        case 'section-measurements':
          return (
            <MeasurementsSection
              showMeasurements={showMeasurements}
              measurementUnit={measurementUnit}
              showGrid={showGrid}
              gridSpacing={gridSpacing}
              gridCenterX={gridCenterX}
              gridCenterZ={gridCenterZ}
              gridWidth={gridWidth}
              gridDepth={gridDepth}
              defaultGridWidth={_defaultGridWidth}
              defaultGridDepth={_defaultGridDepth}
              setShowMeasurements={setShowMeasurements}
              setMeasurementUnit={setMeasurementUnit}
              setShowGrid={setShowGrid}
              setGridSpacing={setGridSpacing}
              setGridCenterX={setGridCenterX}
              setGridCenterZ={setGridCenterZ}
              setGridWidth={setGridWidth}
              setGridDepth={setGridDepth}
            />
          )
        case 'section-beds':
          return (
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
          )
        case 'section-structures':
          return (
            <StructurePanel
              structures={structures}
              selectedId={selectedId}
              onSelect={selectStructure}
              onAdd={handleAddStructure}
              onUpdate={handleUpdateStructure}
              onDelete={handleDeleteStructure}
              onReset={handleResetStructures}
            />
          )
        default:
          return null
      }
    },
    [
      getCurrentConfig,
      handleLoadConfig,
      dayOfYear,
      season,
      setDayOfYear,
      setHour,
      hour,
      sun,
      sunVizRadius,
      setSunVizRadius,
      sunProbeActive,
      sunProbePosition,
      sunExposure,
      setSunProbeActive,
      setSunProbePosition,
      heatmaps,
      heatmapGrids,
      selectedHeatmapId,
      gardenItemsOpacity,
      selectHeatmap,
      handleAddHeatmap,
      handleUpdateHeatmap,
      handleDeleteHeatmap,
      setGardenItemsOpacity,
      city,
      sunLocation,
      setCity,
      yardHeadingDeg,
      setYardHeadingDeg,
      compassMode,
      cameraAzimuth,
      setCompassMode,
      setResetViewNonce,
      showMeasurements,
      measurementUnit,
      showGrid,
      gridSpacing,
      gridCenterX,
      gridCenterZ,
      gridWidth,
      gridDepth,
      setShowMeasurements,
      setMeasurementUnit,
      setShowGrid,
      setGridSpacing,
      setGridCenterX,
      setGridCenterZ,
      setGridWidth,
      setGridDepth,
      beds,
      selectedBedId,
      selectBed,
      handleAddBed,
      handleUpdateBed,
      handleDeleteBed,
      handleResetBeds,
      bedAlerts,
      structures,
      selectedId,
      selectStructure,
      handleAddStructure,
      handleUpdateStructure,
      handleDeleteStructure,
      handleResetStructures,
    ],
  )

  function resizeYard(next: YardSize) {
    const oldStructures = starterStructures(yard),
      newStructures = starterStructures(next)
    setStructures((all) =>
      all.map((s) => {
        const i = oldStructures.findIndex((f) => f.id === s.id)
        if (i < 0) return s
        const unchanged = (a: number[], b: number[]) => a.every((v, j) => v === b[j])
        return {
          ...s,
          position: unchanged(s.position, oldStructures[i].position)
            ? newStructures[i].position
            : s.position,
          size: unchanged(s.size, oldStructures[i].size) ? newStructures[i].size : s.size,
        }
      }),
    )
    setYard(next)
  }
  function editBed(id: string) {
    setExpanded(false)
    setOriginal(false)
    selectBed(id)
    setTool('section-beds')
  }
  const selectionTool = selectedHeatmapId ? 'section-heatmap' : selectedId ? 'section-structures' : 'section-beds'
  const showPhoto = view === 'render' && original && !!photo
  const unitSize = (feet: number) => Number((measurementUnit === 'm' ? feet * 0.3048 : feet).toFixed(1))
  return (
    <main className={'garden-workspace' + (tool ? ' tools-open' : '')}>
      <header className="workspace-header">
        <h1>{gardenName ?? 'Backyard garden'}</h1>
        <div className="garden-context">
          <button onClick={() => setTool('section-location')}>
            <MapPin />
            {city.name}
          </button>
          <button onClick={() => setTool('yard-photo')}>
            <Ruler />
            {unitSize(yard.width)} × {unitSize(yard.depth)} {measurementUnit}
          </button>
          <button className="header-save" onClick={handleQuickSave}>
            {saveFlash === 'saved' ? <Check /> : <Save />}
            {saveFlash === 'saved' ? 'Saved' : 'Save'}
          </button>
          <button
            className="settings-button"
            onClick={() => setTool(selectionTool)}
            aria-label="Open garden tools"
          >
            <SlidersHorizontal />
          </button>
        </div>
      </header>
      <div className="garden-stage">
        <section
          className={'garden-viewport' + (expanded ? ' expanded' : '')}
          aria-label="Interactive garden"
        >
          <ErrorBoundary
            fallback={(_err, retry) => (
              <SceneErrorFallback
                onRetry={() => {
                  setSceneRetryKey((k) => k + 1)
                  retry()
                }}
              />
            )}
          >
            <Suspense fallback={<SceneLoadingFallback />}>
              <GardenScene
                key={sceneRetryKey}
                view={view}
                yard={yard}
                yardGuides={yardGuides}
                layout={layoutIdx === undefined ? undefined : layouts[layoutIdx]}
                labels={labels && !original}
                original={view === 'render' && original && !photo}
                landscape={landscape}
                showSunPath={showSunPath}
                season={season}
                dayOfYear={dayOfYear}
                hour={hour}
                yardHeadingDeg={yardHeadingDeg}
                sunLocation={sunLocation}
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
                sunVizRadius={sunVizRadius}
                resetViewNonce={resetViewNonce}
                showGrid={showGrid}
                gridSpacing={gridSpacing}
                gridCenterX={gridCenterX}
                gridCenterZ={gridCenterZ}
                gridWidth={gridWidth}
                gridDepth={gridDepth}
              />
            </Suspense>
          </ErrorBoundary>

          {showPhoto && (
            <div className="photo-compare">
              <img
                src={photo!.image}
                alt="Original backyard"
                style={{ clipPath: 'inset(0 ' + (100 - comparison) + '% 0 0)' }}
              />
              <div className="compare-line" style={{ left: comparison + '%' }}>
                <span>↔</span>
              </div>
              <input
                type="range"
                aria-label="Original photo and planted render comparison"
                min="0"
                max="100"
                value={comparison}
                onChange={(e) => setComparison(+e.target.value)}
              />
            </div>
          )}
          <div className="scene-toolbar">
            <div className="scene-state">
              <i />
              {showPhoto
                ? 'Photo comparison'
                : original
                  ? 'Original yard'
                  : view === 'orbit'
                    ? '3D orbit'
                    : view === 'plan'
                      ? 'Plan view'
                      : 'Garden render'}
            </div>
            <div className="scene-actions">
              <button className="edit-planters" onClick={() => setTool(selectionTool)}>
                <SlidersHorizontal />
                <span>{selectedHeatmapId ? 'Edit heatmap' : selectedId ? 'Edit structure' : 'Edit planters'}</span>
              </button>
              <button
                aria-label="Show bed labels"
                aria-pressed={labels}
                onClick={() => setLabels((p) => !p)}
              >
                <Tags />
              </button>
              <button
                aria-label={expanded ? 'Exit expanded view' : 'Expand garden view'}
                onClick={() => setExpanded((p) => !p)}
              >
                {expanded ? <Minimize /> : <Maximize />}
              </button>
            </div>
          </div>
          <div className="view-bar" aria-label="Garden view">
            {(
              [
                ['render', 'Render', ImageIcon],
                ['orbit', '3D orbit', Box],
                ['plan', 'Plan', Grid2X2],
              ] as const
            ).map(([key, text, Icon]) => (
              <button key={key} aria-pressed={view === key} onClick={() => changeView(key)}>
                <Icon />
                {text}
              </button>
            ))}
          </div>
          {view === 'render' && (
            <div className="render-actions">
              <button onClick={() => setOriginal((p) => !p)} aria-pressed={original}>
                {original ? 'Show planted yard' : photo ? 'Compare photo' : 'Show original yard'}
              </button>
              <button aria-label="Choose original yard photo" onClick={() => setTool('yard-photo')}>
                <Camera size={15} />
              </button>
            </div>
          )}
          {expanded && <div className="expanded-readout">
            {formatTime(hour)} · {season} · {sun.isAboveHorizon ? sun.altitudeDeg.toFixed(1) + '° elevation' : 'Below horizon'}
            <br />Yard heading {degreesToCompass(yardHeadingDeg)} ({yardHeadingDeg.toFixed(1)}°)
          </div>}
          {sunProbeActive && <span className="probe-prompt">Tap the ground to place the sun probe</span>}
          <button
            className="compass-dial"
            aria-label="Open compass settings"
            onClick={() => setTool('section-compass')}
          >
            <span>N</span>
            <i
              style={{
                transform: 'rotate(' + (90 - yardHeadingDeg + (cameraAzimuth * 180) / Math.PI) + 'deg)',
              }}
            />
          </button>
        </section>
        <SunlightPanel
          day={dayOfYear}
          hour={hour}
          changeHour={setHour}
          location={sunLocation}
          sun={sun}
          onDate={() => setTool('section-season')}
        />
      </div>
      <section className="planting-section" aria-labelledby="planting-title">
        <div className="planting-header">
          <h2 id="planting-title">Planting plan</h2>
          <span>
            {beds.length} {beds.length === 1 ? 'bed' : 'beds'}
          </span>
          <div className="directory-actions">
            <AlertPanel
              alerts={activeBedAlerts}
              dismissedCount={dismissedCount}
              beds={beds}
              onSelectBed={(id, type) => {
                if (type === 'sun-exposure') {
                  setOriginal(false)
                  selectBed(id)
                  setTool(null)
                  document.querySelector('.garden-viewport')?.scrollIntoView({ block: 'nearest' })
                } else {
                  editBed(id)
                }
              }}
              onDismiss={handleDismissAlert}
              onTriggerSunHeatmap={handleTriggerSunHeatmap}
            />
            <button onClick={() => setTool('section-library')}>Add plants</button>
            <button onClick={() => setTool('section-beds')}>
              <Sprout size={15} />
              Manage beds
            </button>
          </div>
        </div>
        <div className="bed-directory">
          {beds.map((b, i) => {
            const portrait = b.plantType
            return (
              <button
                key={b.id}
                className={'bed-card' + (b.id === selectedBedId ? ' selected' : '')}
                onClick={() => editBed(b.id)}
              >
                {portrait ? (
                  <img src={'/garden/' + portrait + '.webp'} alt="" />
                ) : (
                  <span className="crop-symbol" style={{ color: b.color }}>
                    <Leaf />
                  </span>
                )}
                <span className="bed-copy">
                  <small>Bed {String(i + 1).padStart(2, '0')}</small>
                  <strong>{b.name || 'Unnamed bed'}</strong>
                  <span>
                    <Sun size={13} />
                    {exposures[i].directSunHours.toFixed(1)} h sun ·{' '}
                    {bedInSun(b.x, b.z, sun, structures)
                      ? 'In sun'
                      : sun.isAboveHorizon
                        ? 'In shade'
                        : 'Night'}
                  </span>
                </span>
                <ChevronRight className="card-arrow" size={15} />
              </button>
            )
          })}
        </div>
        {!beds.length && (
          <button className="empty-beds" onClick={() => setTool('section-beds')}>
            <Sprout />
            Add your first planting bed
          </button>
        )}
      </section>
      <PlannerTools section={tool} onSection={setTool} onClose={() => setTool(null)}>
        {tool === 'section-library' ? (
          <PlantCatalog onAdd={(type) => { handleAddBed(type); setTool('section-beds') }} />
        ) : tool === 'section-layout' ? (
          <LayoutPicker current={layoutIdx} onApply={(idx) => {
            setLayoutIdx(layouts[idx] ? idx : undefined)
            const planting = layouts[idx]?.beds ?? (idx === -2 ? STARTER_BEDS : [])
            setBeds(structuredClone(planting))
            setSelectedBedId(null)
            setDismissedAlerts(new Set())
            setOriginal(false)
          }} hasBeds={beds.length > 0} />
        ) : tool === 'yard-photo' ? (
          <YardPhotoEditor
            photo={photo}
            yard={yard}
            onPhoto={setPhoto}
            onSize={resizeYard}
            onLocation={setCity}
          />
        ) : (
          tool && renderSectionBody(tool)
        )}
        {tool === 'section-structures' && (
          <button className="text-action" onClick={() => {
            if (structures.length && !window.confirm('Replace structures with the original house, neighbor building and two fences?')) return
            setStructures(structuredClone(classicStructures))
            setSelectedId(null)
          }}>Restore original structures</button>
        )}
        {tool === 'section-measurements' && (
          <label className="path-toggle">
            <input type="checkbox" checked={yardGuides} onChange={e => setYardGuides(e.target.checked)} />
            Property boundary, shared space and compass directions
          </label>
        )}
        {tool === 'section-sun-position' && (
          <label className="path-toggle">
            <input
              type="checkbox"
              checked={showSunPath}
              onChange={(e) => setShowSunPath(e.target.checked)}
            />
            Show sun path in the garden
          </label>
        )}
        {tool === 'section-config' && saveFlash === 'full' && (
          <p role="alert">Browser storage is full. Export this garden to keep a copy.</p>
        )}
      </PlannerTools>
    </main>
  )
}

// Shown while the lazy-loaded 3D scene chunk streams in. Matches the scene's
// night-sky background so the transition into the canvas is unobtrusive.
function SceneLoadingFallback() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: '#1e2330' }}
      role="status"
      aria-live="polite"
    >
      <div className="text-gray-400 text-sm">Loading 3D scene…</div>
    </div>
  )
}

// Shown if the 3D scene fails to load (e.g. a chunk fetch failed) or throws
// during render. Offers a retry that remounts the lazy <Scene>.
function SceneErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
      style={{ background: '#1e2330' }}
      role="alert"
    >
      <div className="text-gray-200 text-sm font-medium">
        Couldn’t load the 3D scene
      </div>
      <div className="text-gray-400 text-xs max-w-xs">
        The scene failed to load. Check your connection and try again.
      </div>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded text-xs text-white font-medium transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
