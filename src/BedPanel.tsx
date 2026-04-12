import { useState, useEffect, useRef } from 'react'
import type { BedConfig, BedAlert, PlantType } from './types'
import { PLANT_PRESETS, PLANT_CATEGORIES } from './types'

const SUN_EMOJI: Record<BedConfig['sunNeeds'], string> = {
  full: '\u2600\uFE0F',
  partial: '\uD83C\uDF24\uFE0F',
  'shade-tolerant': '\u26C5',
}

const plantEntries = Object.entries(PLANT_PRESETS) as [PlantType, (typeof PLANT_PRESETS)[PlantType]][]

interface BedPanelProps {
  beds: BedConfig[]
  selectedBedId: string | null
  onSelect: (id: string | null) => void
  onAdd: (plantType: PlantType) => void
  onUpdate: (id: string, patch: Partial<BedConfig>) => void
  onDelete: (id: string) => void
  onReset: () => void
  alerts: BedAlert[]
}

export default function BedPanel({
  beds,
  selectedBedId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onReset,
  alerts,
}: BedPanelProps) {
  const selected = beds.find((b) => b.id === selectedBedId)
  const [addType, setAddType] = useState<PlantType>('tomatoes')
  const [flashId, setFlashId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedBedId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-bed-id="${selectedBedId}"]`)
    if (!el) return
    const section = el.closest('[id="section-beds"]')
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setFlashId(selectedBedId)
    const timer = setTimeout(() => setFlashId(null), 800)
    return () => clearTimeout(timer)
  }, [selectedBedId])

  function alertsForBed(id: string): BedAlert[] {
    return alerts.filter((a) => a.bedId === id)
  }

  return (
    <section className="px-4 py-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Garden Beds
      </h2>

      {/* Bed list */}
      <div ref={listRef} className="space-y-1 mb-3 max-h-40 overflow-y-auto">
        {beds.map((b) => {
          const bedAlerts = alertsForBed(b.id)
          return (
            <button
              key={b.id}
              data-bed-id={b.id}
              onClick={() => onSelect(b.id === selectedBedId ? null : b.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-all duration-300 flex items-center gap-2 ${
                b.id === selectedBedId
                  ? 'bg-emerald-800/50 border border-emerald-500/50'
                  : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
              } ${flashId === b.id ? 'ring-2 ring-emerald-400/70' : ''}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ background: b.color }}
              />
              <span className="font-medium truncate">{b.name}</span>
              {bedAlerts.length > 0 && (
                <span
                  className={`text-[10px] font-bold ml-auto flex-shrink-0 ${
                    bedAlerts.some((a) => a.severity === 'error')
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                  title={bedAlerts.map((a) => a.message).join('; ')}
                >
                  !
                </span>
              )}
              <span className={`${bedAlerts.length > 0 ? '' : 'ml-auto'} text-xs`}>
                {SUN_EMOJI[b.sunNeeds]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Add bed */}
      <div className="flex gap-1.5 mb-3">
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value as PlantType)}
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
        >
          {PLANT_CATEGORIES.map((cat) => (
            <optgroup key={cat.key} label={cat.label}>
              {plantEntries
                .filter(([, p]) => p.category === cat.key)
                .map(([key, p]) => (
                  <option key={key} value={key}>
                    {SUN_EMOJI[p.sunNeeds]} {p.name} (pH {p.phRange[0]}-{p.phRange[1]})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={() => onAdd(addType)}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded text-xs font-medium transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Selected bed editor */}
      {selected && (
        <div className="bg-gray-800/60 rounded-md p-2.5 space-y-2 border border-gray-700">
          <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
            Edit: {selected.name}
          </div>

          {/* Name */}
          <label className="block">
            <span className="text-[10px] text-gray-500">Name</span>
            <input
              type="text"
              value={selected.name}
              onChange={(e) => onUpdate(selected.id, { name: e.target.value })}
              className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs mt-0.5 focus:border-emerald-500 focus:outline-none"
            />
          </label>

          {/* Position */}
          <div>
            <span className="text-[10px] text-gray-500">Position (X, Z)</span>
            <div className="grid grid-cols-2 gap-1 mt-0.5">
              {(['X', 'Z'] as const).map((axis) => (
                <label key={axis} className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                    {axis}
                  </span>
                  <input
                    type="number"
                    step={0.5}
                    value={axis === 'X' ? selected.x : selected.z}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      onUpdate(selected.id, axis === 'X' ? { x: val } : { z: val })
                    }}
                    className="w-full bg-gray-900 border border-gray-600 rounded pl-5 pr-1 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Rotation */}
          <label className="block">
            <span className="text-[10px] text-gray-500">Rotation</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="number"
                step={45}
                value={selected.rotation ?? 0}
                onChange={(e) => onUpdate(selected.id, { rotation: Math.round((parseFloat(e.target.value) || 0) / 45) * 45 })}
                className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">deg</span>
            </div>
          </label>

          {/* Size */}
          <div>
            <span className="text-[10px] text-gray-500">Size (Width, Depth)</span>
            <div className="grid grid-cols-2 gap-1 mt-0.5">
              {(['W', 'D'] as const).map((label) => (
                <label key={label} className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                    {label}
                  </span>
                  <input
                    type="number"
                    step={0.5}
                    min={1}
                    value={label === 'W' ? selected.width : selected.depth}
                    onChange={(e) => {
                      const val = Math.max(1, parseFloat(e.target.value) || 1)
                      onUpdate(
                        selected.id,
                        label === 'W' ? { width: val } : { depth: val },
                      )
                    }}
                    className="w-full bg-gray-900 border border-gray-600 rounded pl-5 pr-1 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
            {/* Spacing info */}
            {selected.plantType && (() => {
              const preset = PLANT_PRESETS[selected.plantType]
              const spacingFt = preset.spacingInches / 12
              const cols = Math.floor(selected.width / spacingFt)
              const rows = Math.floor(selected.depth / spacingFt)
              return (
                <div className="text-[10px] text-gray-500 mt-1">
                  Spacing: {preset.spacingInches}" ({spacingFt.toFixed(1)} ft)
                  &middot; Fits: {cols} x {rows} = {cols * rows} plants
                  &middot; pH: {preset.phRange[0]}&ndash;{preset.phRange[1]}
                </div>
              )
            })()}
          </div>

          {/* Sun needs */}
          <div>
            <span className="text-[10px] text-gray-500">Sun Needs</span>
            <div className="flex gap-1 mt-0.5">
              {(['full', 'partial', 'shade-tolerant'] as const).map((sn) => (
                <button
                  key={sn}
                  onClick={() => onUpdate(selected.id, { sunNeeds: sn })}
                  className={`flex-1 px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                    selected.sunNeeds === sn
                      ? 'bg-amber-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                  }`}
                >
                  {sn === 'full' ? 'Full' : sn === 'partial' ? 'Partial' : 'Shade'}
                </button>
              ))}
            </div>
          </div>

          {/* Soil pH */}
          {selected.plantType && (() => {
            const preset = PLANT_PRESETS[selected.plantType]
            return (
              <div className="text-[10px] text-gray-400 bg-gray-900/40 rounded px-2 py-1.5">
                Optimal soil pH: <span className="font-medium text-gray-300">{preset.phRange[0]}&ndash;{preset.phRange[1]}</span>
              </div>
            )
          })()}

          {/* Trellis */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.hasTrellis ?? false}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    hasTrellis: e.target.checked,
                    trellisHeight: e.target.checked ? (selected.trellisHeight ?? 5) : undefined,
                  })
                }
                className="accent-emerald-500"
              />
              Trellis
            </label>
            {selected.hasTrellis && (
              <label className="relative flex-1">
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                  H
                </span>
                <input
                  type="number"
                  step={0.5}
                  min={2}
                  max={10}
                  value={selected.trellisHeight ?? 5}
                  onChange={(e) =>
                    onUpdate(selected.id, {
                      trellisHeight: Math.max(2, parseFloat(e.target.value) || 5),
                    })
                  }
                  className="w-full bg-gray-900 border border-gray-600 rounded pl-5 pr-1 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                />
              </label>
            )}
          </div>

          {/* Color */}
          <label className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Color</span>
            <input
              type="color"
              value={selected.color}
              onChange={(e) => onUpdate(selected.id, { color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border border-gray-600 bg-transparent"
            />
            <span className="text-[10px] text-gray-500 font-mono">
              {selected.color}
            </span>
          </label>

          {/* Alerts for selected bed */}
          {(() => {
            const selectedAlerts = alertsForBed(selected.id)
            if (selectedAlerts.length === 0) return null
            return (
              <div className="space-y-1">
                {selectedAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`text-[10px] px-2 py-1.5 rounded border ${
                      alert.severity === 'error'
                        ? 'bg-red-900/30 border-red-700/40 text-red-300'
                        : 'bg-amber-900/30 border-amber-700/40 text-amber-300'
                    }`}
                  >
                    {alert.type === 'sun-exposure' ? '\u2600' : '\u2194'} {alert.message}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Delete */}
          <button
            onClick={() => {
              onDelete(selected.id)
              onSelect(null)
            }}
            className="w-full px-2 py-1.5 bg-red-900/40 hover:bg-red-800/50 border border-red-700/40 rounded text-xs text-red-300 font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={onReset}
        className="mt-2 w-full px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-[10px] text-gray-400 transition-colors"
      >
        Reset to layout defaults
      </button>
    </section>
  )
}
