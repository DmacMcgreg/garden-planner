import { useState } from 'react'
import { Plus } from 'lucide-react'
import { layouts } from './layouts'
import { PLANT_CATEGORIES, PLANT_PRESETS, type PlantType } from './types'

const plants = Object.keys(PLANT_PRESETS) as PlantType[]

export function PlantCatalog({ onAdd }: { onAdd: (type: PlantType) => void }) {
  const [query, setQuery] = useState('')
  const matches = plants.filter((type) =>
    PLANT_PRESETS[type].name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  return (
    <section className="plant-catalog">
      <label>
        Find a plant
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <p>Spacing is per plant. Sun requirements use peak sun hours (PSH) per day.</p>
      {!matches.length && <p>No matching plants.</p>}
      {PLANT_CATEGORIES.map(({ key, label }) => {
        const group = matches.filter((type) => PLANT_PRESETS[type].category === key)
        if (!group.length) return null
        return (
          <section key={key}>
            <h3>{label}</h3>
            {group.map((type) => {
              const p = PLANT_PRESETS[type]
              return (
                <button key={type} aria-label={'Add ' + p.name} onClick={() => onAdd(type)}>
                  <img src={'/garden/' + type + '.webp'} alt="" loading="lazy" />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sunNeeds === 'full'
                        ? 'Full sun'
                        : p.sunNeeds === 'partial'
                          ? 'Partial sun'
                          : 'Shade tolerant'}{' '}
                      · {p.minSunHours}+ PSH · {p.spacingInches} in · pH {p.phRange.join('–')}
                      {p.hasTrellis && ' · Trellis'}
                    </small>
                  </span>
                  <Plus size={16} />
                </button>
              )
            })}
          </section>
        )
      })}
    </section>
  )
}

export function LayoutPicker({
  current,
  hasBeds,
  onApply,
}: {
  current?: number
  hasBeds: boolean
  onApply: (idx: number) => void
}) {
  const [choice, setChoice] = useState(current ?? -2)
  const [message, setMessage] = useState('')
  const layout = layouts[choice]
  return (
    <section className="layout-picker">
      <label>
        Planting layout
        <select
          value={choice}
          onChange={(e) => {
            setChoice(Number(e.target.value))
            setMessage('')
          }}
        >
          <option value={-2}>Starter beds</option>
          {layouts.map((l, i) => (
            <option key={l.id} value={i}>
              {l.name}
            </option>
          ))}
          <option value={-1}>Empty layout</option>
        </select>
      </label>
      <p>
        {layout
          ? layout.description
          : choice === -2
            ? 'Plant cherry tomatoes, salad greens, sweet peppers and culinary herbs.'
            : 'Clear beds, walking paths and solar panels.'}
      </p>
      {layout && (
        <p>
          Designed for a 24 × 10 ft yard. Includes {layout.beds.length} beds, {layout.paths.length} paths and{' '}
          {layout.panels.length} solar panels.
        </p>
      )}
      <button
        className="tool-action"
        onClick={() => {
          if (
            (hasBeds || current !== undefined) &&
            !window.confirm('Replace the current beds, paths and solar panels?')
          )
            return
          onApply(choice)
          setMessage('Applied ' + (layout?.name ?? (choice === -2 ? 'starter beds' : 'empty layout')))
        }}
      >
        Apply layout
      </button>
      <p role="status">{message}</p>
    </section>
  )
}
