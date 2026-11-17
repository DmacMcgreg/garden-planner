// Mobile layout shell: full-viewport 3D canvas + a floating icon rail whose
// taps open a single sidebar section as a bottom sheet.
//
// Rendered ONLY below the `md` breakpoint (App.tsx gates on useMediaQuery).
// The desktop <aside> path is completely untouched, so desktop behavior and
// pixels are unchanged (diff-verified).

import { useEffect, useRef, useState } from 'react'

// Reuse the exact nav item set the desktop rail uses, so both layouts expose
// the same sections in the same order.
import { NAV_ITEMS } from './NavSidebarItems'

interface MobileShellProps {
  /**
   * Render the section body for a given nav id. Returning null hides that
   * item from the rail (e.g. sections with nothing to show).
   */
  renderSection: (id: string) => React.ReactNode
  /** Optional extra content fixed to the top of the sheet (e.g. app title). */
  sheetHeader?: React.ReactNode
}

export default function MobileShell({ renderSection, sheetHeader }: MobileShellProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  // The element that had focus before the sheet opened — we restore to it on close.
  const lastFocused = useRef<HTMLElement | null>(null)

  const close = () => setActiveId(null)

  // Esc closes the sheet; matches the "dismiss" affordance users expect.
  useEffect(() => {
    if (!activeId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab') {
        // Focus trap: keep Tab cycling within the sheet so aria-modal is honest.
        const sheet = sheetRef.current
        if (!sheet) return
        const focusable = sheet.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId])

  // On open: remember the opener and move focus into the sheet. On close: restore.
  useEffect(() => {
    if (activeId) {
      lastFocused.current = document.activeElement as HTMLElement
      // Focus the close button once rendered; small delay lets it mount.
      const t = setTimeout(() => closeBtnRef.current?.focus(), 0)
      return () => clearTimeout(t)
    } else if (lastFocused.current) {
      lastFocused.current.focus?.()
      lastFocused.current = null
    }
  }, [activeId])

  // Lock body scroll while a sheet is open so the canvas behind stays put.
  useEffect(() => {
    if (activeId) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [activeId])

  return (
    <>
      {/* Floating icon rail — vertical, left side, thumb-reachable. */}
      <nav
        aria-label="Sections"
        className="md:hidden fixed left-2 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-0.5 bg-black/70 backdrop-blur-sm rounded-xl p-1 max-h-[80vh] overflow-y-auto"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveId(item.id === activeId ? null : item.id)}
            aria-label={item.label}
            aria-pressed={item.id === activeId}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              item.id === activeId
                ? 'bg-emerald-700 text-white'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {/* icon is 24px; shrink slightly to fit the 9x9 (36px) button */}
            <span className="scale-[0.7]">{item.icon}</span>
          </button>
        ))}
      </nav>

      {/* Backdrop */}
      {activeId && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Bottom sheet */}
      {activeId && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={NAV_ITEMS.find((n) => n.id === activeId)?.label ?? 'Section'}
          className="md:hidden fixed left-0 right-0 bottom-0 z-50 max-h-[80vh] flex flex-col rounded-t-2xl border-t border-gray-600 shadow-2xl"
          style={{ background: '#1e2330' }}
        >
          {/* Drag handle + header + close */}
          <div className="flex items-center justify-between px-4 pt-2 pb-1 flex-shrink-0">
            <div className="flex-1" />
            <div className="w-10 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
            <button
              ref={closeBtnRef}
              onClick={close}
              aria-label="Close"
              className="flex-1 flex justify-end text-gray-400 hover:text-white text-xl leading-none p-1"
            >
              ×
            </button>
          </div>
          {sheetHeader && <div className="px-4 pb-1 flex-shrink-0">{sheetHeader}</div>}
          {/* Scrollable section body */}
          <div className="overflow-y-auto overscroll-contain px-1 pb-6">
            {renderSection(activeId)}
          </div>
        </div>
      )}
    </>
  )
}
