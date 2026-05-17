import { View, Text, Pressable, StyleSheet } from 'react-native'
import {
  formatTime,
  degreesToCompass,
  dayOfYearToLabel,
  seasonFromDay,
  SEASON_DAYS,
  todayDayOfYear,
  currentHour,
  DEFAULT_YARD_HEADING,
  type Season,
  type SunPosition,
  type SunExposureResult,
  type HeatmapInstance,
  type HeatmapGrid,
  type HeatmapMode,
} from '../sun'
import type {
  BedConfig,
  BedAlert,
  GardenConfig,
  MeasurementUnit,
  PlantType,
  Structure,
  StructureType,
} from '../types'
import type { CityRecord } from '../cities'
import {
  C,
  Section,
  Row,
  Btn,
  SliderRow,
  Segmented,
  Toggle,
  NumField,
  Divider,
} from '../ui/components'
import { CityPicker } from './CityPicker'
import { BedPanel } from './BedPanel'
import { StructurePanel } from './StructurePanel'
import { ConfigPanel } from './ConfigPanel'

const HEATMAP_MODES: { value: HeatmapMode; label: string }[] = [
  { value: 'energyRating', label: 'Energy' },
  { value: 'directSunHours', label: 'Direct' },
  { value: 'peakSunHours', label: 'PSH' },
  { value: 'peakIntensity', label: 'Peak Int' },
]

export interface ControlsModel {
  dayOfYear: number
  setDayOfYear: (v: number) => void
  hour: number
  setHour: (v: number) => void
  yardHeadingDeg: number
  setYardHeadingDeg: (v: number) => void
  city: CityRecord
  setCity: (c: CityRecord) => void
  tzOffsetHours: number
  sun: SunPosition
  sunVizRadius: number
  setSunVizRadius: (v: number) => void
  sunProbeActive: boolean
  setSunProbeActive: (v: boolean) => void
  sunProbePosition: { x: number; z: number } | null
  clearProbe: () => void
  sunExposure: SunExposureResult | null
  heatmaps: HeatmapInstance[]
  heatmapGrids: Record<string, HeatmapGrid>
  selectedHeatmapId: string | null
  gardenItemsOpacity: number
  setGardenItemsOpacity: (v: number) => void
  onAddHeatmap: () => void
  onUpdateHeatmap: (id: string, patch: Partial<HeatmapInstance>) => void
  onDeleteHeatmap: (id: string) => void
  onSelectHeatmap: (id: string | null) => void
  showMeasurements: boolean
  setShowMeasurements: (v: boolean) => void
  measurementUnit: MeasurementUnit
  setMeasurementUnit: (v: MeasurementUnit) => void
  showGrid: boolean
  setShowGrid: (v: boolean) => void
  gridSpacing: number
  setGridSpacing: (v: number) => void
  gridCenterX: number
  setGridCenterX: (v: number) => void
  gridCenterZ: number
  setGridCenterZ: (v: number) => void
  gridWidth: number
  setGridWidth: (v: number) => void
  gridDepth: number
  setGridDepth: (v: number) => void
  moveMode: boolean
  setMoveMode: (v: boolean) => void
  hasSelection: boolean
  // bed / structure / config panels
  beds: BedConfig[]
  selectedBedId: string | null
  bedAlerts: BedAlert[]
  onSelectBed: (id: string | null) => void
  onAddBed: (t: PlantType) => void
  onUpdateBed: (id: string, patch: Partial<BedConfig>) => void
  onDeleteBed: (id: string) => void
  onResetBeds: () => void
  structures: Structure[]
  selectedStructureId: string | null
  onSelectStructure: (id: string | null) => void
  onAddStructure: (t: StructureType) => void
  onUpdateStructure: (id: string, patch: Partial<Structure>) => void
  onDeleteStructure: (id: string) => void
  onResetStructures: () => void
  getCurrentConfig: (name: string) => GardenConfig
  onLoadConfig: (c: GardenConfig) => void
}

const SEASON_COLOR: Record<Season, string> = {
  spring: '#4ade80',
  summer: '#fbbf24',
  fall: '#fb923c',
  winter: '#60a5fa',
}

export function ControlsSheet({ m }: { m: ControlsModel }) {
  const season = seasonFromDay(m.dayOfYear)

  return (
    <View>
      <ConfigPanel getCurrentConfig={m.getCurrentConfig} onLoadConfig={m.onLoadConfig} />
      <Divider />

      {/* Date */}
      <Section
        title="Date"
        right={
          <Btn
            label="Today"
            small
            onPress={() => {
              m.setDayOfYear(todayDayOfYear())
              m.setHour(Math.min(21, Math.max(5, Math.round(currentHour() * 4) / 4)))
            }}
          />
        }
      >
        <SliderRow
          label="Day of year"
          value={m.dayOfYear}
          min={1}
          max={365}
          step={1}
          onChange={(v) => m.setDayOfYear(Math.round(v))}
          display={`${dayOfYearToLabel(m.dayOfYear)} — ${season}`}
        />
        <Row>
          {(Object.entries(SEASON_DAYS) as [Season, number][]).map(([s, day]) => (
            <Btn
              key={s}
              label={s[0].toUpperCase() + s.slice(1)}
              flex
              small
              active={season === s}
              onPress={() => m.setDayOfYear(day)}
            />
          ))}
        </Row>
      </Section>
      <Divider />

      {/* Time */}
      <Section title="Time of Day">
        <SliderRow
          label="Hour"
          value={m.hour}
          min={5}
          max={21}
          step={0.25}
          onChange={m.setHour}
          display={formatTime(m.hour)}
        />
      </Section>
      <Divider />

      {/* Sun position */}
      <Section title="Sun Position">
        {m.sun.isAboveHorizon ? (
          <Row>
            <View style={styles.stat}>
              <Text style={styles.statLbl}>Altitude</Text>
              <Text style={styles.statVal}>{m.sun.altitudeDeg.toFixed(1)}°</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLbl}>Azimuth</Text>
              <Text style={styles.statVal}>{m.sun.azimuthDeg.toFixed(1)}°</Text>
            </View>
          </Row>
        ) : (
          <Text style={styles.muted}>Sun is below the horizon</Text>
        )}
        <View style={{ height: 10 }} />
        <SliderRow
          label="Sun Path Distance"
          value={m.sunVizRadius}
          min={20}
          max={120}
          step={1}
          onChange={m.setSunVizRadius}
          display={`${m.sunVizRadius.toFixed(0)} ft`}
        />
      </Section>
      <Divider />

      {/* Sun exposure probe */}
      <Section
        title="Sun Exposure"
        right={
          <Btn
            label={m.sunProbeActive ? 'Probing…' : 'Place Probe'}
            small
            tone="amber"
            active={m.sunProbeActive}
            onPress={() => {
              const next = !m.sunProbeActive
              m.setSunProbeActive(next)
              if (!next) m.clearProbe()
            }}
          />
        }
      >
        {m.sunProbeActive && !m.sunProbePosition && (
          <Text style={[styles.muted, { color: '#fcd34d' }]}>
            Tap anywhere on the ground to analyze sun exposure.
          </Text>
        )}
        {m.sunProbePosition && m.sunExposure && (
          <ExposureView
            pos={m.sunProbePosition}
            ex={m.sunExposure}
            onClear={m.clearProbe}
          />
        )}
      </Section>
      <Divider />

      {/* Heatmaps */}
      <Section
        title="Sun Heatmaps"
        right={<Btn label="+ Add" small tone="amber" onPress={m.onAddHeatmap} />}
      >
        <SliderRow
          label="Garden Items Opacity"
          value={m.gardenItemsOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={m.setGardenItemsOpacity}
          display={`${Math.round(m.gardenItemsOpacity * 100)}%`}
        />
        {m.heatmaps.length === 0 && (
          <Text style={styles.empty}>No heatmaps. Tap “+ Add”.</Text>
        )}
        {m.heatmaps.map((h) => {
          const on = h.id === m.selectedHeatmapId
          const grid = m.heatmapGrids[h.id]
          return (
            <View
              key={h.id}
              style={[styles.hmCard, on && { borderColor: C.amber }]}
            >
              <View style={styles.hmHead}>
                <Toggle
                  label=""
                  value={h.visible}
                  onChange={(v) => m.onUpdateHeatmap(h.id, { visible: v })}
                />
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => m.onSelectHeatmap(on ? null : h.id)}
                >
                  <Text style={styles.hmName}>{h.name}</Text>
                </Pressable>
                <Pressable onPress={() => m.onDeleteHeatmap(h.id)}>
                  <Text style={styles.hmDel}>✕</Text>
                </Pressable>
              </View>
              {on && (
                <View style={{ gap: 6, marginTop: 6 }}>
                  <Row>
                    {HEATMAP_MODES.map((md) => (
                      <Btn
                        key={md.value}
                        label={md.label}
                        flex
                        small
                        active={h.mode === md.value}
                        tone="amber"
                        onPress={() => m.onUpdateHeatmap(h.id, { mode: md.value })}
                      />
                    ))}
                  </Row>
                  <SliderRow
                    label="Opacity"
                    value={h.opacity}
                    min={0.1}
                    max={1}
                    step={0.05}
                    onChange={(v) => m.onUpdateHeatmap(h.id, { opacity: v })}
                    display={`${Math.round(h.opacity * 100)}%`}
                  />
                  <Row>
                    <NumField
                      label="cX"
                      value={h.centerX}
                      onCommit={(v) => m.onUpdateHeatmap(h.id, { centerX: v })}
                    />
                    <NumField
                      label="cZ"
                      value={h.centerZ}
                      onCommit={(v) => m.onUpdateHeatmap(h.id, { centerZ: v })}
                    />
                  </Row>
                  <Row>
                    <NumField
                      label="W"
                      value={h.width}
                      onCommit={(v) =>
                        m.onUpdateHeatmap(h.id, { width: Math.max(2, v) })
                      }
                    />
                    <NumField
                      label="D"
                      value={h.depth}
                      onCommit={(v) =>
                        m.onUpdateHeatmap(h.id, { depth: Math.max(2, v) })
                      }
                    />
                  </Row>
                  {h.visible && <HeatLegend mode={h.mode} grid={grid ?? null} />}
                </View>
              )}
            </View>
          )
        })}
      </Section>
      <Divider />

      {/* Location */}
      <Section title="Location">
        <CityPicker value={m.city} onChange={m.setCity} />
        <Text style={styles.coords}>
          {Math.abs(m.city.lat).toFixed(2)}°{m.city.lat >= 0 ? 'N' : 'S'},{' '}
          {Math.abs(m.city.lon).toFixed(2)}°{m.city.lon >= 0 ? 'E' : 'W'}
          {m.city.tz ? ` · ${m.city.tz}` : ''} · UTC
          {m.tzOffsetHours >= 0 ? '+' : ''}
          {m.tzOffsetHours}
        </Text>
      </Section>
      <Divider />

      {/* Orientation */}
      <Section title="Garden Orientation">
        <SliderRow
          label="Heading"
          value={m.yardHeadingDeg}
          min={0}
          max={360}
          step={0.5}
          onChange={m.setYardHeadingDeg}
          display={`${m.yardHeadingDeg.toFixed(1)}° — ${degreesToCompass(m.yardHeadingDeg)}`}
        />
        <Compass
          sunAz={m.sun.isAboveHorizon ? m.sun.azimuthDeg : -1}
          heading={m.yardHeadingDeg}
        />
        {m.yardHeadingDeg !== DEFAULT_YARD_HEADING && (
          <Btn
            label={`Reset to ${DEFAULT_YARD_HEADING}° (${degreesToCompass(DEFAULT_YARD_HEADING)})`}
            small
            onPress={() => m.setYardHeadingDeg(DEFAULT_YARD_HEADING)}
          />
        )}
      </Section>
      <Divider />

      {/* Measurements */}
      <Section
        title="Measurements"
        right={
          <Toggle
            label="Labels"
            value={m.showMeasurements}
            onChange={m.setShowMeasurements}
          />
        }
      >
        {m.showMeasurements && (
          <View style={{ marginBottom: 8 }}>
            <Segmented
              value={m.measurementUnit}
              onChange={m.setMeasurementUnit}
              options={[
                { value: 'ft', label: 'Feet' },
                { value: 'm', label: 'Metres' },
              ]}
            />
          </View>
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.muted}>Ground Grid</Text>
          <Toggle label="Show" value={m.showGrid} onChange={m.setShowGrid} />
        </Row>
        {m.showGrid && (
          <View style={{ marginTop: 8, gap: 6 }}>
            <Row>
              {[0.5, 1, 2, 5].map((s) => (
                <Btn
                  key={s}
                  label={s < 1 ? `${s * 12}"` : `${s}'`}
                  flex
                  small
                  active={m.gridSpacing === s}
                  onPress={() => m.setGridSpacing(s)}
                />
              ))}
            </Row>
            <Row>
              <NumField label="cX" value={m.gridCenterX} onCommit={m.setGridCenterX} />
              <NumField label="cZ" value={m.gridCenterZ} onCommit={m.setGridCenterZ} />
            </Row>
            <Row>
              <NumField
                label="W"
                value={m.gridWidth}
                onCommit={(v) => m.setGridWidth(Math.min(400, Math.max(5, v)))}
              />
              <NumField
                label="D"
                value={m.gridDepth}
                onCommit={(v) => m.setGridDepth(Math.min(400, Math.max(5, v)))}
              />
            </Row>
            <Row>
              {[20, 40, 60, 120].map((s) => (
                <Btn
                  key={s}
                  label={`${s}'`}
                  flex
                  small
                  active={m.gridWidth === s && m.gridDepth === s}
                  onPress={() => {
                    m.setGridWidth(s)
                    m.setGridDepth(s)
                  }}
                />
              ))}
            </Row>
          </View>
        )}
      </Section>
      <Divider />

      <BedPanel
        beds={m.beds}
        selectedBedId={m.selectedBedId}
        alerts={m.bedAlerts}
        onSelect={m.onSelectBed}
        onAdd={m.onAddBed}
        onUpdate={m.onUpdateBed}
        onDelete={m.onDeleteBed}
        onReset={m.onResetBeds}
      />
      <Divider />

      <StructurePanel
        structures={m.structures}
        selectedId={m.selectedStructureId}
        onSelect={m.onSelectStructure}
        onAdd={m.onAddStructure}
        onUpdate={m.onUpdateStructure}
        onDelete={m.onDeleteStructure}
        onReset={m.onResetStructures}
      />
      <View style={{ height: 40 }} />
    </View>
  )
}

function ExposureView({
  pos,
  ex,
  onClear,
}: {
  pos: { x: number; z: number }
  ex: SunExposureResult
  onClear: () => void
}) {
  const ratingColor =
    ex.energyRating >= 7 ? '#22c55e' : ex.energyRating >= 4 ? '#eab308' : '#ef4444'
  const ratingLabel =
    ex.energyRating >= 7 ? 'Full Sun' : ex.energyRating >= 4 ? 'Partial Sun' : 'Shade'
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={styles.mono}>
          Point ({pos.x.toFixed(1)}, {pos.z.toFixed(1)})
        </Text>
        <Pressable onPress={onClear}>
          <Text style={{ color: C.faint, fontSize: 11 }}>Clear</Text>
        </Pressable>
      </Row>
      <View style={styles.exCard}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.statLbl}>Energy Rating</Text>
          <Text style={{ color: ratingColor, fontWeight: '700', fontSize: 12 }}>
            {ex.energyRating.toFixed(1)}/10 — {ratingLabel}
          </Text>
        </Row>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${ex.energyRating * 10}%`, backgroundColor: ratingColor },
            ]}
          />
        </View>
      </View>
      <Row>
        <Metric label="Direct Sun" value={`${ex.directSunHours.toFixed(1)}h`} />
        <Metric label="Peak Sun Hrs" value={`${ex.peakSunHours.toFixed(1)}`} />
      </Row>
      <Row>
        <Metric label="Peak Intensity" value={ex.peakIntensity.toFixed(2)} />
        <Metric label="Peak At" value={formatTime(ex.peakHour)} />
      </Row>
      <View style={styles.exCard}>
        <Text style={styles.statLbl}>Hourly Exposure</Text>
        <View style={styles.bars}>
          {ex.hourly.map((h) => {
            const bh = h.altitudeDeg > 0 ? Math.max(2, (h.intensity / 1.5) * 100) : 0
            return (
              <View
                key={h.hour}
                style={{
                  flex: 1,
                  height: `${bh}%`,
                  backgroundColor: h.isObstructed
                    ? '#374151'
                    : h.intensity > 1
                      ? '#f59e0b'
                      : h.intensity > 0.5
                        ? '#d97706'
                        : '#92400e',
                  opacity: h.isObstructed ? 0.5 : 1,
                  borderRadius: 1,
                }}
              />
            )
          })}
        </View>
        <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={styles.tiny}>
            {ex.hourly.length ? formatTime(ex.hourly[0].hour) : ''}
          </Text>
          <Text style={styles.tiny}>
            {ex.hourly.length
              ? formatTime(ex.hourly[ex.hourly.length - 1].hour)
              : ''}
          </Text>
        </Row>
      </View>
    </View>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLbl}>{label}</Text>
      <Text style={styles.statVal}>{value}</Text>
    </View>
  )
}

function HeatLegend({
  mode,
  grid,
}: {
  mode: HeatmapMode
  grid: HeatmapGrid | null
}) {
  let max = '...'
  let unit = ''
  if (grid) {
    if (mode === 'directSunHours') {
      max = grid.maxDirectSunHours.toFixed(1)
      unit = 'h'
    } else if (mode === 'peakSunHours') {
      max = grid.maxPeakSunHours.toFixed(1)
      unit = ' PSH'
    } else if (mode === 'peakIntensity') {
      max = grid.maxPeakIntensity.toFixed(2)
    } else {
      max = grid.maxEnergyRating.toFixed(1)
      unit = '/10'
    }
  }
  const stops = ['#000000', '#0000c8', '#00c8dc', '#00dc00', '#ffff00', '#ff0000']
  return (
    <View style={styles.exCard}>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' }}>
        {stops.map((c) => (
          <View key={c} style={{ flex: 1, backgroundColor: c }} />
        ))}
      </View>
      <Row style={{ justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={styles.tiny}>0{unit}</Text>
        <Text style={styles.tiny}>
          {max}
          {unit}
        </Text>
      </Row>
    </View>
  )
}

function Compass({ sunAz, heading }: { sunAz: number; heading: number }) {
  const size = 130
  const r = size / 2
  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: '#0f1623',
          borderWidth: 1,
          borderColor: C.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[styles.cDir, { top: 6, color: C.red }]}>N</Text>
        <Text style={[styles.cDir, { bottom: 6 }]}>S</Text>
        <Text style={[styles.cDir, { left: 8 }]}>W</Text>
        <Text style={[styles.cDir, { right: 8 }]}>E</Text>
        {/* heading arrow */}
        <View
          style={{
            position: 'absolute',
            width: 2,
            height: r - 16,
            backgroundColor: C.emerald,
            top: 16,
            transform: [
              { translateY: (r - 16) / 2 },
              { rotate: `${heading}deg` },
              { translateY: -(r - 16) / 2 },
            ],
          }}
        />
        {sunAz >= 0 && (
          <View
            style={{
              position: 'absolute',
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: '#FFD700',
              top: 10,
              transform: [
                { translateY: r - 16 },
                { rotate: `${sunAz}deg` },
                { translateY: -(r - 16) },
              ],
            }}
          />
        )}
      </View>
      <Text style={[styles.tiny, { marginTop: 4 }]}>
        Sun {sunAz >= 0 ? `${sunAz.toFixed(0)}°` : 'below horizon'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statLbl: { color: C.sub, fontSize: 10 },
  statVal: { color: C.amber, fontSize: 14, fontWeight: '700', marginTop: 2 },
  muted: { color: C.sub, fontSize: 12 },
  empty: { color: C.faint, fontSize: 11, fontStyle: 'italic', marginVertical: 4 },
  coords: { color: C.faint, fontSize: 10, marginTop: 6 },
  hmCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  hmHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hmName: { color: C.text, fontSize: 12, fontWeight: '600' },
  hmDel: { color: C.faint, fontSize: 14, paddingHorizontal: 4 },
  mono: { color: C.faint, fontSize: 11 },
  exCard: { backgroundColor: C.card, borderRadius: 6, padding: 10 },
  barTrack: {
    height: 8,
    backgroundColor: C.border,
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    height: 50,
    marginTop: 6,
  },
  tiny: { color: C.faint, fontSize: 9 },
  cDir: { position: 'absolute', color: C.sub, fontSize: 11, fontWeight: '700' },
})
