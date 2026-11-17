import { useEffect, useRef, type ReactNode } from 'react'
import { useMediaQuery } from './useMediaQuery'
import { X } from 'lucide-react'

const sections = [
  ['section-beds', 'Garden beds'],
  ['section-library', 'Plant catalog'],
  ['section-layout', 'Garden layouts'],
  ['section-structures', 'Structures'],
  ['yard-photo', 'Yard & photo'],
  ['section-season', 'Date'],
  ['section-time', 'Time of day'],
  ['section-location', 'Location'],
  ['section-sun-position', 'Sun path'],
  ['section-sun-exposure', 'Sun probe'],
  ['section-heatmap', 'Heatmaps'],
  ['section-orientation', 'Yard orientation'],
  ['section-compass', 'Compass'],
  ['section-measurements', 'Measurements'],
  ['section-config', 'Save & load'],
]

export function PlannerTools({
  section,
  onSection,
  onClose,
  children,
}: {
  section: string | null
  onSection: (key: string) => void
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const docked = useMediaQuery('(min-width: 1024px)')
  const visible = !!section
  useEffect(() => {
    if (!visible) return
    const dialog = ref.current!
    if (docked) dialog.show()
    else dialog.showModal()
    return () => dialog.close()
  }, [docked, visible])
  return (
    <dialog
      ref={ref}
      className="planner-tools"
      aria-labelledby="tools-title"
      onCancel={onClose}
      onKeyDown={(e) => {
        if (docked && !e.defaultPrevented && e.key === 'Escape') onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect()
          if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)
            onClose()
        }
      }}
    >
      <header>
        <h2 id="tools-title">Garden tools</h2>
        <button className="icon-button" aria-label="Close garden tools" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <label className="tool-switch">
        <span>Tool</span>
        <select
          aria-label="Tool"
          value={section ?? 'section-beds'}
          onChange={(e) => onSection(e.target.value)}
        >
          {sections.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="tool-content" key={section}>
        {children}
      </div>
    </dialog>
  )
}
