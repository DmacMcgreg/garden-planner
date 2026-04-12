import type { Structure, StructureType } from './types'
import { SectionHeader, IconHouse } from './SectionHeader'

interface StructurePanelProps {
  structures: Structure[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAdd: (type: StructureType) => void
  onUpdate: (id: string, patch: Partial<Structure>) => void
  onDelete: (id: string) => void
  onReset: () => void
}

export default function StructurePanel({
  structures,
  selectedId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onReset,
}: StructurePanelProps) {
  const selected = structures.find((s) => s.id === selectedId)

  return (
    <section className="px-4 py-3">
      <SectionHeader icon={<IconHouse />} title="Structures" />

      {/* Structure list */}
      <div className="space-y-1 mb-3">
        {structures.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id === selectedId ? null : s.id)}
            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
              s.id === selectedId
                ? 'bg-emerald-800/50 border border-emerald-500/50'
                : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: s.color }}
            />
            <span className="font-medium truncate">{s.name}</span>
            <span className="text-gray-500 ml-auto text-[10px]">
              {s.type === 'building' ? 'BLD' : 'FNC'}
            </span>
          </button>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => onAdd('building')}
          className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
        >
          + Building
        </button>
        <button
          onClick={() => onAdd('fence')}
          className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
        >
          + Fence
        </button>
      </div>

      {/* Selected structure editor */}
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
            <span className="text-[10px] text-gray-500">Position (X, Y, Z)</span>
            <div className="grid grid-cols-3 gap-1 mt-0.5">
              {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                <label key={axis} className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                    {axis}
                  </span>
                  <input
                    type="number"
                    step={0.5}
                    value={selected.position[i]}
                    onChange={(e) => {
                      const pos: [number, number, number] = [...selected.position]
                      pos[i] = parseFloat(e.target.value) || 0
                      onUpdate(selected.id, { position: pos })
                    }}
                    className="w-full bg-gray-900 border border-gray-600 rounded pl-5 pr-1 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <span className="text-[10px] text-gray-500">Size (W, H, D)</span>
            <div className="grid grid-cols-3 gap-1 mt-0.5">
              {(['W', 'H', 'D'] as const).map((label, i) => (
                <label key={label} className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">
                    {label}
                  </span>
                  <input
                    type="number"
                    step={0.5}
                    min={0.1}
                    value={selected.size[i]}
                    onChange={(e) => {
                      const size: [number, number, number] = [...selected.size]
                      size[i] = Math.max(0.1, parseFloat(e.target.value) || 0.1)
                      onUpdate(selected.id, { size })
                    }}
                    className="w-full bg-gray-900 border border-gray-600 rounded pl-5 pr-1 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
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

          {/* Shadow toggles */}
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.castShadow}
                onChange={(e) =>
                  onUpdate(selected.id, { castShadow: e.target.checked })
                }
                className="accent-emerald-500"
              />
              Cast shadow
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.receiveShadow}
                onChange={(e) =>
                  onUpdate(selected.id, { receiveShadow: e.target.checked })
                }
                className="accent-emerald-500"
              />
              Receive shadow
            </label>
          </div>

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
        Reset to defaults
      </button>
    </section>
  )
}
