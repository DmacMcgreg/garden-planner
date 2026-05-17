import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
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
  seasonFromDay,
  type Season,
  type SunExposureResult,
  type SunLocation,
  type HeatmapGrid,
  type HeatmapInstance,
} from './src/sun'
import {
  DEFAULT_CITY_KEY,
  cityKey,
  findCityByKey,
  getTzOffsetHours,
  type CityRecord,
} from './src/cities'
import {
  PLANT_PRESETS,
  getMinSunHoursForBed,
  migrateBeds,
  migrateHeatmapsFromConfig,
  type BedConfig,
  type BedAlert,
  type GardenConfig,
  type Structure,
  type StructureType,
  type PlantType,
  type MeasurementUnit,
} from './src/types'
import { loadDefaultConfig } from './src/storage'
import GardenScene from './src/components/GardenScene'
import { createBridge } from './src/components/sceneBridge'
import { ControlsSheet, type ControlsModel } from './src/panels/ControlsSheet'
import { C } from './src/ui/components'

function maxCustomId(items: { id: string }[], prefix: string): number {
  let max = 0
  for (const it of items) {
    if (it.id.startsWith(prefix)) {
      const n = parseInt(it.id.slice(prefix.length), 10)
      if (n > max) max = n
    }
  }
  return max
}

export default function App() {
  const bridge = useMemo(() => createBridge(), [])

  const [dayOfYear, setDayOfYear] = useState(getDayOfYear('summer'))
  const season = seasonFromDay(dayOfYear)
  const [hour, setHour] = useState(14)
  const [yardHeadingDeg, setYardHeadingDeg] = useState(DEFAULT_YARD_HEADING)
  const [city, setCity] = useState<CityRecord>(
    () => findCityByKey(DEFAULT_CITY_KEY)!,
  )
  const [structures, setStructures] = useState<Structure[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [beds, setBeds] = useState<BedConfig[]>([])
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)
  const [showMeasurements, setShowMeasurements] = useState(false)
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('ft')
  const [sunProbeActive, setSunProbeActive] = useState(false)
  const [sunProbePosition, setSunProbePosition] = useState<{
    x: number
    z: number
  } | null>(null)
  const [heatmaps, setHeatmaps] = useState<HeatmapInstance[]>([])
  const [selectedHeatmapId, setSelectedHeatmapId] = useState<string | null>(null)
  const [gardenItemsOpacity, setGardenItemsOpacity] = useState(1)
  const [sunVizRadius, setSunVizRadius] = useState(32)
  const [showGrid, setShowGrid] = useState(false)
  const [gridSpacing, setGridSpacing] = useState(1)
  const [gridCenterX, setGridCenterX] = useState(0)
  const [gridCenterZ, setGridCenterZ] = useState(0)
  const [gridWidth, setGridWidth] = useState(60)
  const [gridDepth, setGridDepth] = useState(60)

  const [moveMode, setMoveMode] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)

  const nextStructureId = useRef(1)
  const nextBedId = useRef(1)
  const nextHeatmapId = useRef(1)

  const selectBed = useCallback((id: string | null) => {
    setSelectedBedId(id)
    if (id) {
      setSelectedId(null)
      setSelectedHeatmapId(null)
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
    }
  }, [])

  const sunLocation = useMemo<SunLocation>(() => {
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

  const bedAlerts = useMemo<BedAlert[]>(() => {
    const alerts: BedAlert[] = []
    for (const bed of beds) {
      const minSunHours = getMinSunHoursForBed(bed)
      const exposure = calculateSunExposure(
        bed.x,
        bed.z,
        dayOfYear,
        yardHeadingDeg,
        structures,
        sunLocation,
      )
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
  }, [beds, dayOfYear, yardHeadingDeg, structures, sunLocation])

  /* ---- Heatmap handlers ---- */
  const onAddHeatmap = useCallback(() => {
    const num = nextHeatmapId.current++
    const id = `heatmap-${num}`
    setHeatmaps((p) => [...p, createDefaultHeatmap(id, `Heatmap ${num}`)])
    selectHeatmap(id)
  }, [selectHeatmap])
  const onUpdateHeatmap = useCallback(
    (id: string, patch: Partial<HeatmapInstance>) =>
      setHeatmaps((p) => p.map((h) => (h.id === id ? { ...h, ...patch } : h))),
    [],
  )
  const onDeleteHeatmap = useCallback((id: string) => {
    setHeatmaps((p) => p.filter((h) => h.id !== id))
    setSelectedHeatmapId((c) => (c === id ? null : c))
  }, [])

  /* ---- Structure handlers ---- */
  const onAddStructure = useCallback(
    (type: StructureType) => {
      const num = nextStructureId.current++
      const id = `custom-${num}`
      const s: Structure =
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
      setStructures((p) => [...p, s])
      selectStructure(id)
    },
    [selectStructure],
  )
  const onUpdateStructure = useCallback(
    (id: string, patch: Partial<Structure>) =>
      setStructures((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    [],
  )
  const onDeleteStructure = useCallback((id: string) => {
    setStructures((p) => p.filter((s) => s.id !== id))
    setSelectedId(null)
  }, [])
  const onMoveStructure = useCallback(
    (id: string, position: [number, number, number]) =>
      setStructures((p) =>
        p.map((s) => (s.id === id ? { ...s, position } : s)),
      ),
    [],
  )
  const onResetStructures = useCallback(() => {
    setStructures([])
    setSelectedId(null)
  }, [])

  /* ---- Bed handlers ---- */
  const onAddBed = useCallback(
    (plantType: PlantType) => {
      const preset = PLANT_PRESETS[plantType]
      const num = nextBedId.current++
      const id = `custom-bed-${num}`
      const bed: BedConfig = {
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
      setBeds((p) => [...p, bed])
      selectBed(id)
    },
    [selectBed],
  )
  const onUpdateBed = useCallback(
    (id: string, patch: Partial<BedConfig>) =>
      setBeds((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b))),
    [],
  )
  const onDeleteBed = useCallback((id: string) => {
    setBeds((p) => p.filter((b) => b.id !== id))
    setSelectedBedId(null)
  }, [])
  const onMoveBed = useCallback(
    (id: string, x: number, z: number) =>
      setBeds((p) => p.map((b) => (b.id === id ? { ...b, x, z } : b))),
    [],
  )
  const onResetBeds = useCallback(() => {
    setBeds([])
    setSelectedBedId(null)
  }, [])

  /* ---- Config save/load ---- */
  const getCurrentConfig = useCallback(
    (name: string): GardenConfig => ({
      name,
      savedAt: new Date().toISOString(),
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
      season, dayOfYear, hour, yardHeadingDeg, structures, beds,
      showMeasurements, measurementUnit, gardenItemsOpacity, sunVizRadius,
      city, showGrid, gridSpacing, gridCenterX, gridCenterZ, gridWidth,
      gridDepth, heatmaps,
    ],
  )

  const applyConfig = useCallback((config: GardenConfig) => {
    setDayOfYear(config.dayOfYear ?? getDayOfYear(config.season as Season))
    setHour(config.hour)
    setYardHeadingDeg(config.yardHeadingDeg)
    const restored =
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
    setCity(restored)
    setStructures(config.structures)
    setBeds(migrateBeds(config.beds))
    setShowMeasurements(config.showMeasurements)
    setMeasurementUnit(config.measurementUnit as MeasurementUnit)
    setGardenItemsOpacity(config.gardenItemsOpacity)
    setSunVizRadius(config.sunVizRadius ?? 32)
    setShowGrid(config.showGrid ?? false)
    setGridSpacing(config.gridSpacing ?? 1)
    setGridCenterX(config.gridCenterX ?? 0)
    setGridCenterZ(config.gridCenterZ ?? 0)
    setGridWidth(config.gridWidth ?? 60)
    setGridDepth(config.gridDepth ?? 60)
    const migrated = migrateHeatmapsFromConfig(config)
    setHeatmaps(migrated)
    setSelectedHeatmapId(null)
    setSelectedId(null)
    setSelectedBedId(null)
    nextStructureId.current = maxCustomId(config.structures, 'custom-') + 1
    nextBedId.current = maxCustomId(config.beds, 'custom-bed-') + 1
    nextHeatmapId.current = maxCustomId(migrated, 'heatmap-') + 1
  }, [])

  // Load the saved default config (async) on first mount.
  useEffect(() => {
    loadDefaultConfig().then((cfg) => {
      if (cfg) applyConfig(cfg)
    })
  }, [applyConfig])

  const onPick = useCallback(
    (kind: 'bed' | 'structure' | 'heatmap', id: string) => {
      if (kind === 'bed') selectBed(id)
      else if (kind === 'structure') selectStructure(id)
      else selectHeatmap(id)
    },
    [selectBed, selectStructure, selectHeatmap],
  )
  const onDeselect = useCallback(() => {
    setSelectedBedId(null)
    setSelectedId(null)
    setSelectedHeatmapId(null)
  }, [])
  const onProbePlace = useCallback((x: number, z: number) => {
    setSunProbePosition({ x, z })
  }, [])

  const hasSelection = !!(selectedBedId || selectedId)
  const errorCount = bedAlerts.filter((a) => a.severity === 'error').length

  const model: ControlsModel = {
    dayOfYear,
    setDayOfYear,
    hour,
    setHour,
    yardHeadingDeg,
    setYardHeadingDeg,
    city,
    setCity,
    tzOffsetHours: sunLocation.tzOffsetHours,
    sun,
    sunVizRadius,
    setSunVizRadius,
    sunProbeActive,
    setSunProbeActive,
    sunProbePosition,
    clearProbe: () => {
      setSunProbePosition(null)
      setSunProbeActive(false)
    },
    sunExposure,
    heatmaps,
    heatmapGrids,
    selectedHeatmapId,
    gardenItemsOpacity,
    setGardenItemsOpacity,
    onAddHeatmap,
    onUpdateHeatmap,
    onDeleteHeatmap,
    onSelectHeatmap: selectHeatmap,
    showMeasurements,
    setShowMeasurements,
    measurementUnit,
    setMeasurementUnit,
    showGrid,
    setShowGrid,
    gridSpacing,
    setGridSpacing,
    gridCenterX,
    setGridCenterX,
    gridCenterZ,
    setGridCenterZ,
    gridWidth,
    setGridWidth,
    gridDepth,
    setGridDepth,
    moveMode,
    setMoveMode,
    hasSelection,
    beds,
    selectedBedId,
    bedAlerts,
    onSelectBed: selectBed,
    onAddBed,
    onUpdateBed,
    onDeleteBed,
    onResetBeds,
    structures,
    selectedStructureId: selectedId,
    onSelectStructure: selectStructure,
    onAddStructure,
    onUpdateStructure,
    onDeleteStructure,
    onResetStructures,
    getCurrentConfig,
    onLoadConfig: applyConfig,
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <StatusBar barStyle="light-content" />

          {/* 3D scene fills the screen */}
          <View style={styles.scene}>
            <GardenScene
              season={season}
              dayOfYear={dayOfYear}
              hour={hour}
              yardHeadingDeg={yardHeadingDeg}
              sunLocation={sunLocation}
              structures={structures}
              selectedId={selectedId}
              beds={beds}
              selectedBedId={selectedBedId}
              heatmaps={heatmaps}
              heatmapGrids={heatmapGrids}
              selectedHeatmapId={selectedHeatmapId}
              gardenItemsOpacity={gardenItemsOpacity}
              sunVizRadius={sunVizRadius}
              showGrid={showGrid}
              gridSpacing={gridSpacing}
              gridCenterX={gridCenterX}
              gridCenterZ={gridCenterZ}
              gridWidth={gridWidth}
              gridDepth={gridDepth}
              sunProbePosition={sunProbePosition}
              bridge={bridge}
              moveMode={moveMode}
              sunProbeActive={sunProbeActive}
              onPick={onPick}
              onDeselect={onDeselect}
              onProbePlace={onProbePlace}
              onMoveBed={onMoveBed}
              onMoveStructure={onMoveStructure}
            />
          </View>

          {/* Top HUD */}
          <SafeAreaView style={styles.hud} pointerEvents="box-none" edges={['top']}>
            <View style={styles.hudBox} pointerEvents="none">
              <Text style={styles.hudMain}>
                {sun.isAboveHorizon ? '☀' : '☾'} {formatTime(hour)} —{' '}
                {season[0].toUpperCase() + season.slice(1)}{' '}
                {sun.isAboveHorizon
                  ? `(alt ${sun.altitudeDeg.toFixed(0)}°)`
                  : '(below horizon)'}
              </Text>
              <Text style={styles.hudSub}>
                {degreesToCompass(yardHeadingDeg)} ({yardHeadingDeg.toFixed(0)}°)
                {errorCount > 0
                  ? `  ·  ⚠ ${errorCount} alert${errorCount > 1 ? 's' : ''}`
                  : ''}
              </Text>
            </View>
            {hasSelection && (
              <Pressable
                style={[styles.moveBtn, moveMode && styles.moveBtnOn]}
                onPress={() => setMoveMode((v) => !v)}
              >
                <Text style={[styles.moveText, moveMode && { color: '#0b0f17' }]}>
                  {moveMode ? '✓ Drag to move' : 'Move mode'}
                </Text>
              </Pressable>
            )}
          </SafeAreaView>

          {/* Bottom controls sheet */}
          {panelOpen && (
            <View style={styles.sheet}>
              <View style={styles.sheetGrip} />
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.sheetHeader}>
                  <Text style={styles.title}>Backyard Garden Planner</Text>
                  <Text style={styles.subtitle}>
                    24 × 10 ft · {city.name}
                    {city.country ? `, ${city.country}` : ''}
                  </Text>
                </View>
                <ControlsSheet m={model} />
              </ScrollView>
            </View>
          )}

          {/* Toggle FAB */}
          <Pressable style={styles.fab} onPress={() => setPanelOpen((v) => !v)}>
            <Text style={styles.fabText}>
              {panelOpen ? '▾ Hide' : '▴ Controls'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scene: { ...StyleSheet.absoluteFillObject },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, padding: 10 },
  hudBox: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hudMain: { color: '#fff', fontSize: 13, fontWeight: '700' },
  hudSub: { color: '#cbd5e1', fontSize: 11, marginTop: 2 },
  moveBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  moveBtnOn: { backgroundColor: C.amber, borderColor: C.amber },
  moveText: { color: C.text, fontSize: 12, fontWeight: '700' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '58%',
    backgroundColor: C.panel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 },
  title: { color: C.text, fontSize: 17, fontWeight: '800' },
  subtitle: { color: C.sub, fontSize: 12, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 14,
    bottom: '58%',
    marginBottom: 12,
    backgroundColor: C.emerald,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { color: '#0b0f17', fontWeight: '800', fontSize: 13 },
})
