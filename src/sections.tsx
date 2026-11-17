// Presentational sidebar sections, extracted from App.tsx so that both the
// desktop <aside> and the mobile bottom-sheet shell can render the same content
// without duplicating markup.
//
// Each component is a pure function of its props — no own state except trivial
// UI flags that are local to a single section. All app state stays in App.tsx.
//
// IMPORTANT: this file must not change any visible behavior. The desktop layout
// is diff-checked against a pre-refactor screenshot.

import type {
  MeasurementUnit,
} from './types'
import {
  formatTime,
  degreesToCompass,
  SEASON_DAYS,
  dayOfYearToLabel,
  todayDayOfYear,
  currentHour,
  type Season,
  type SunPosition,
  type SunExposureResult,
  type SunLocation,
  type HeatmapMode,
  type HeatmapGrid,
  type HeatmapInstance,
} from './sun'
import { CityPicker } from './CityPicker'
import type { CityRecord } from './cities'
import {
  SectionHeader,
  IconCalendar,
  IconClock,
  IconSun,
  IconSunRays,
  IconHeatGrid,
  IconCompassArrow,
  IconCompassRose,
  IconMapPin,
  IconRuler,
} from './SectionHeader'

export const SEASON_COLORS: Record<Season, string> = {
  spring: 'text-green-400',
  summer: 'text-amber-400',
  fall: 'text-orange-400',
  winter: 'text-blue-400',
}

export const HEATMAP_MODES: { value: HeatmapMode; label: string }[] = [
  { value: 'energyRating', label: 'Energy Rating' },
  { value: 'directSunHours', label: 'Direct Sun' },
  { value: 'peakSunHours', label: 'Peak Sun Hrs' },
  { value: 'peakIntensity', label: 'Peak Intensity' },
]

export type CompassMode = 'locked' | 'camera-following'

/* ------------------------------------------------------------------ */
/*  Date                                                               */
/* ------------------------------------------------------------------ */

export function DateSection({
  dayOfYear,
  season,
  setDayOfYear,
  setHour,
}: {
  dayOfYear: number
  season: Season
  setDayOfYear: (d: number) => void
  setHour: (h: number) => void
}) {
  return (
    <section id="section-season" className="px-4 py-3">
      <SectionHeader
        icon={<IconCalendar />}
        title="Date"
        right={
          <button
            onClick={() => {
              setDayOfYear(todayDayOfYear())
              setHour(Math.min(21, Math.max(5, Math.round(currentHour() * 4) / 4)))
            }}
            className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-[10px] text-gray-300 font-medium transition-colors"
          >
            Today
          </button>
        }
      />
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
  )
}

/* ------------------------------------------------------------------ */
/*  Time of Day                                                        */
/* ------------------------------------------------------------------ */

export function TimeSection({
  hour,
  setHour,
}: {
  hour: number
  setHour: (h: number) => void
}) {
  return (
    <section id="section-time" className="px-4 py-3">
      <SectionHeader icon={<IconClock />} title="Time of Day" />
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
        <span className="text-amber-400 font-semibold">{formatTime(hour)}</span>
        <span>9 PM</span>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Sun Position                                                       */
/* ------------------------------------------------------------------ */

export function SunPositionSection({
  sun,
  sunVizRadius,
  setSunVizRadius,
}: {
  sun: SunPosition
  sunVizRadius: number
  setSunVizRadius: (r: number) => void
}) {
  return (
    <section id="section-sun-position" className="px-4 py-3">
      <SectionHeader icon={<IconSun />} title="Sun Position" />
      {sun.isAboveHorizon ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-800 rounded px-3 py-2">
            <div className="text-xs text-gray-300">Altitude</div>
            <div className="font-mono font-semibold text-amber-400">
              {sun.altitudeDeg.toFixed(1)}&deg;
            </div>
          </div>
          <div className="bg-gray-800 rounded px-3 py-2">
            <div className="text-xs text-gray-300">Azimuth</div>
            <div className="font-mono font-semibold text-amber-400">
              {sun.azimuthDeg.toFixed(1)}&deg;
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Sun is below the horizon</p>
      )}

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Sun Path Distance</span>
          <span className="font-mono">{sunVizRadius.toFixed(0)} ft</span>
        </div>
        <input
          type="range"
          min={20}
          max={120}
          step={1}
          value={sunVizRadius}
          onChange={(e) => setSunVizRadius(parseFloat(e.target.value))}
          className="w-full accent-amber-500"
        />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Sun Exposure Probe                                                 */
/* ------------------------------------------------------------------ */

export function SunExposureSection({
  sunProbeActive,
  sunProbePosition,
  sunExposure,
  season,
  setSunProbeActive,
  setSunProbePosition,
}: {
  sunProbeActive: boolean
  sunProbePosition: { x: number; z: number } | null
  sunExposure: SunExposureResult | null
  season: Season
  setSunProbeActive: (v: boolean) => void
  setSunProbePosition: (v: { x: number; z: number } | null) => void
}) {
  return (
    <section id="section-sun-exposure" className="px-4 py-3">
      <SectionHeader
        icon={<IconSunRays />}
        title="Sun Exposure"
        right={
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
        }
      />

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
  )
}

/* ------------------------------------------------------------------ */
/*  Sun Heatmaps                                                       */
/* ------------------------------------------------------------------ */

export function HeatmapSection({
  heatmaps,
  heatmapGrids,
  selectedHeatmapId,
  gardenItemsOpacity,
  selectHeatmap,
  handleAddHeatmap,
  handleUpdateHeatmap,
  handleDeleteHeatmap,
  setGardenItemsOpacity,
}: {
  heatmaps: HeatmapInstance[]
  heatmapGrids: Record<string, HeatmapGrid>
  selectedHeatmapId: string | null
  gardenItemsOpacity: number
  selectHeatmap: (id: string | null) => void
  handleAddHeatmap: () => void
  handleUpdateHeatmap: (id: string, patch: Partial<HeatmapInstance>) => void
  handleDeleteHeatmap: (id: string) => void
  setGardenItemsOpacity: (v: number) => void
}) {
  return (
    <section id="section-heatmap" className="px-4 py-3">
      <SectionHeader
        icon={<IconHeatGrid />}
        title="Sun Heatmaps"
        right={
          <button
            onClick={handleAddHeatmap}
            className="text-[10px] px-2 py-0.5 rounded bg-amber-700/70 hover:bg-amber-600 text-white font-medium transition-colors"
            title="Add new heatmap"
          >
            + Add
          </button>
        }
      />

      {/* Garden items opacity (global) */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
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
        <div className="text-[10px] text-gray-400 italic py-2">
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
                onChange={(e) => handleUpdateHeatmap(h.id, { visible: e.target.checked })}
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
                aria-label={`Delete ${h.name}`}
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
                  onChange={(e) => handleUpdateHeatmap(h.id, { name: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] focus:border-amber-500 focus:outline-none"
                />

                {/* Mode */}
                <div className="grid grid-cols-2 gap-1">
                  {HEATMAP_MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => handleUpdateHeatmap(h.id, { mode: m.value })}
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
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
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
                      handleUpdateHeatmap(h.id, { opacity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Area */}
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">
                      cX
                    </span>
                    <input
                      type="number"
                      step={0.5}
                      value={h.centerX}
                      onChange={(e) =>
                        handleUpdateHeatmap(h.id, { centerX: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded pl-7 pr-1 py-1 text-[10px] font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  <label className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">
                      cZ
                    </span>
                    <input
                      type="number"
                      step={0.5}
                      value={h.centerZ}
                      onChange={(e) =>
                        handleUpdateHeatmap(h.id, { centerZ: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-gray-900 border border-gray-700 rounded pl-7 pr-1 py-1 text-[10px] font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">
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
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">
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
  )
}

/* ------------------------------------------------------------------ */
/*  Location                                                           */
/* ------------------------------------------------------------------ */

export function LocationSection({
  city,
  sunLocation,
  setCity,
}: {
  city: CityRecord
  sunLocation: SunLocation
  setCity: (c: CityRecord) => void
}) {
  return (
    <section id="section-location" className="px-4 py-3">
      <SectionHeader icon={<IconMapPin />} title="Location" />
      <CityPicker value={city} onChange={setCity} />
      <div className="mt-1.5 text-[10px] text-gray-500 font-mono">
        {Math.abs(city.lat).toFixed(2)}&deg;{city.lat >= 0 ? 'N' : 'S'},{' '}
        {Math.abs(city.lon).toFixed(2)}&deg;{city.lon >= 0 ? 'E' : 'W'}
        {city.tz ? ` · ${city.tz}` : ''}
        {' · UTC'}
        {sunLocation.tzOffsetHours >= 0 ? '+' : ''}
        {sunLocation.tzOffsetHours}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Orientation                                                        */
/* ------------------------------------------------------------------ */

export function OrientationSection({
  yardHeadingDeg,
  setYardHeadingDeg,
  DEFAULT_YARD_HEADING,
}: {
  yardHeadingDeg: number
  setYardHeadingDeg: (v: number) => void
  DEFAULT_YARD_HEADING: number
}) {
  return (
    <section id="section-orientation" className="px-4 py-3">
      <SectionHeader icon={<IconCompassArrow />} title="Garden Orientation" />
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
          {yardHeadingDeg.toFixed(1)}&deg; &mdash; {degreesToCompass(yardHeadingDeg)}
        </span>
        <span className="text-gray-500">360&deg;</span>
      </div>
      {yardHeadingDeg !== DEFAULT_YARD_HEADING && (
        <button
          onClick={() => setYardHeadingDeg(DEFAULT_YARD_HEADING)}
          className="mt-1.5 text-[10px] text-gray-400 hover:text-white transition-colors"
        >
          Reset to {DEFAULT_YARD_HEADING}&deg; ({degreesToCompass(DEFAULT_YARD_HEADING)})
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Compass                                                            */
/* ------------------------------------------------------------------ */

export function CompassSection({
  sun,
  yardHeadingDeg,
  compassMode,
  cameraAzimuth,
  setCompassMode,
  setResetViewNonce,
}: {
  sun: SunPosition
  yardHeadingDeg: number
  compassMode: CompassMode
  cameraAzimuth: number
  setCompassMode: (m: CompassMode) => void
  setResetViewNonce: (fn: (n: number) => number) => void
}) {
  return (
    <section id="section-compass" className="px-4 py-3 flex flex-col items-center">
      <div className="w-full">
        <SectionHeader
          icon={<IconCompassRose />}
          title="Compass"
          right={
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
          }
        />
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
      <button
        onClick={() => setResetViewNonce((n) => n + 1)}
        className="mt-3 px-2 py-0.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-[10px] text-gray-300 font-medium transition-colors"
      >
        Reset View
      </button>
      <span className="text-[10px] text-gray-500 mt-1">Right-click drag to pan</span>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Measurements + Ground Grid                                         */
/* ------------------------------------------------------------------ */

export function MeasurementsSection({
  showMeasurements,
  measurementUnit,
  showGrid,
  gridSpacing,
  gridCenterX,
  gridCenterZ,
  gridWidth,
  gridDepth,
  defaultGridWidth,
  defaultGridDepth,
  setShowMeasurements,
  setMeasurementUnit,
  setShowGrid,
  setGridSpacing,
  setGridCenterX,
  setGridCenterZ,
  setGridWidth,
  setGridDepth,
}: {
  showMeasurements: boolean
  measurementUnit: MeasurementUnit
  showGrid: boolean
  gridSpacing: number
  gridCenterX: number
  gridCenterZ: number
  gridWidth: number
  gridDepth: number
  defaultGridWidth: number
  defaultGridDepth: number
  setShowMeasurements: (v: boolean) => void
  setMeasurementUnit: (u: MeasurementUnit) => void
  setShowGrid: (v: boolean) => void
  setGridSpacing: (v: number) => void
  setGridCenterX: (v: number) => void
  setGridCenterZ: (v: number) => void
  setGridWidth: (v: number) => void
  setGridDepth: (v: number) => void
}) {
  return (
    <section id="section-measurements" className="px-4 py-3">
      <SectionHeader
        icon={<IconRuler />}
        title="Measurements"
        right={
          <label className="flex items-center gap-1.5 text-[10px] text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showMeasurements}
              onChange={(e) => setShowMeasurements(e.target.checked)}
              className="accent-cyan-500"
            />
            Labels
          </label>
        }
      />
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
        <span className="text-[10px] text-gray-300 uppercase tracking-wider">Ground Grid</span>
        <label className="flex items-center gap-1.5 text-[10px] text-gray-300 cursor-pointer">
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
          <div className="flex items-center justify-between text-[10px] text-gray-300 mb-0.5">
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
          <p className="text-[9px] text-gray-400 mt-1 leading-tight">
            Major lines every {(gridSpacing * 5).toFixed(gridSpacing * 5 % 1 === 0 ? 0 : 1)} ft
          </p>

          {/* Grid center + size */}
          <div className="mt-2 pt-2 border-t border-gray-700/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-300 uppercase tracking-wider">Area</span>
              <button
                onClick={() => {
                  setGridCenterX(0)
                  setGridCenterZ(0)
                  setGridWidth(defaultGridWidth)
                  setGridDepth(defaultGridDepth)
                }}
                className="text-[9px] text-gray-400 hover:text-white transition-colors"
                title="Reset grid to default center and size"
              >
                Reset
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              <label className="relative">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">
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
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">
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
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">
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
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">
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
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers shared by sections (moved verbatim from App.tsx)           */
/* ------------------------------------------------------------------ */

function HeatmapLegend({ mode, grid }: { mode: HeatmapMode; grid: HeatmapGrid | null }) {
  let maxLabel: string
  let unit: string
  if (!grid) {
    maxLabel = '...'
    unit = ''
  } else {
    switch (mode) {
      case 'directSunHours':
        maxLabel = grid.maxDirectSunHours.toFixed(1)
        unit = 'h'
        break
      case 'peakSunHours':
        maxLabel = grid.maxPeakSunHours.toFixed(1)
        unit = ' PSH'
        break
      case 'peakIntensity':
        maxLabel = grid.maxPeakIntensity.toFixed(2)
        unit = ''
        break
      case 'energyRating':
        maxLabel = grid.maxEnergyRating.toFixed(1)
        unit = '/10'
        break
    }
  }

  return (
    <div className="bg-gray-800 rounded px-2.5 py-2">
      <div
        className="h-2.5 rounded-full mb-1"
        style={{
          background:
            'linear-gradient(90deg, rgb(0,0,0), rgb(0,0,200), rgb(0,200,220), rgb(0,220,0), rgb(255,255,0), rgb(255,0,0))',
        }}
      />
      <div className="flex justify-between text-[9px] text-gray-500 font-mono">
        <span>0{unit}</span>
        <span>
          {maxLabel}
          {unit}
        </span>
      </div>
    </div>
  )
}

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
  const ratingColor =
    exposure.energyRating >= 7
      ? '#22c55e'
      : exposure.energyRating >= 4
        ? '#eab308'
        : '#ef4444'

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
          <span className="text-xs font-bold" style={{ color: ratingColor }}>
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
            const barH = h.altitudeDeg > 0 ? Math.max(2, (h.intensity / 1.5) * 100) : 0
            return (
              <div
                key={h.hour}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${barH}%`,
                  backgroundColor: h.isObstructed
                    ? '#374151'
                    : h.intensity > 1
                      ? '#f59e0b'
                      : h.intensity > 0.5
                        ? '#d97706'
                        : '#92400e',
                  opacity: h.isObstructed ? 0.5 : 1,
                }}
                title={`${formatTime(h.hour)}: ${h.altitudeDeg.toFixed(1)} alt, ${h.isObstructed ? 'shadowed' : 'direct'}`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
          <span>
            {exposure.hourly.length > 0 ? formatTime(exposure.hourly[0].hour) : ''}
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

function CompassRose({
  sunAzimuth,
  yardHeadingDeg,
  compassMode,
  cameraAzimuth,
}: {
  sunAzimuth: number
  yardHeadingDeg: number
  compassMode: CompassMode
  cameraAzimuth: number
}) {
  // In camera-following mode, rotate the compass content to match the camera view.
  const rotationOffset =
    compassMode === 'camera-following' ? -cameraAzimuth * (180 / Math.PI) : 0

  return (
    <svg viewBox="-55 -55 110 110" className="w-36 h-36">
      <circle
        cx="0"
        cy="0"
        r="50"
        fill="#111827"
        stroke={compassMode === 'camera-following' ? '#059669' : '#374151'}
        strokeWidth={compassMode === 'camera-following' ? 1.5 : 1}
      />
      <g transform={`rotate(${rotationOffset})`}>
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
        <text x="0" y="-38" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="bold">
          N
        </text>
        <text x="38" y="3.5" textAnchor="middle" fill="#d1d5db" fontSize="8" fontWeight="bold">
          E
        </text>
        <text x="0" y="44" textAnchor="middle" fill="#d1d5db" fontSize="8" fontWeight="bold">
          S
        </text>
        <text x="-38" y="3.5" textAnchor="middle" fill="#d1d5db" fontSize="8" fontWeight="bold">
          W
        </text>
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
