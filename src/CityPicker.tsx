import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import { WORLD_CITIES, type CityRecord } from './cities'

export interface CityPickerProps {
  value: CityRecord
  onChange: (city: CityRecord) => void
  placeholder?: string
  className?: string
}

const MAX_RESULTS = 50

function formatCityLabel(c: CityRecord): string {
  return c.admin ? `${c.name}, ${c.admin}, ${c.country}` : `${c.name}, ${c.country}`
}

export function CityPicker({ value, onChange, placeholder, className }: CityPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo<CityRecord[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return WORLD_CITIES.slice(0, MAX_RESULTS)
    const out: CityRecord[] = []
    for (const c of WORLD_CITIES) {
      const hay = formatCityLabel(c).toLowerCase()
      if (hay.includes(q)) {
        out.push(c)
        if (out.length >= MAX_RESULTS) break
      }
    }
    return out
  }, [query])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const commit = useCallback(
    (c: CityRecord) => {
      onChange(c)
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    },
    [onChange],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(results.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = results[highlight]
      if (pick) commit(pick)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  const displayValue = open ? query : formatCityLabel(value)

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder={placeholder ?? 'Search city…'}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        className="w-full px-2 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
      />
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded border border-gray-700 bg-gray-900 shadow-lg"
        >
          {results.map((c, i) => {
            const active = i === highlight
            return (
              <li
                key={`${c.name}|${c.admin}|${c.country}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(c)
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-2 py-1.5 text-xs cursor-pointer ${
                  active ? 'bg-emerald-600/30 text-white' : 'text-gray-200 hover:bg-gray-800'
                }`}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-gray-400 text-[10px]">
                  {c.admin ? `${c.admin}, ` : ''}
                  {c.country} · {c.lat.toFixed(2)}°{c.lat >= 0 ? 'N' : 'S'},{' '}
                  {Math.abs(c.lon).toFixed(2)}°{c.lon >= 0 ? 'E' : 'W'}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
