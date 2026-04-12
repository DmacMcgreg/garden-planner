import { useState, useRef, useEffect } from 'react'
import type { BedConfig, BedAlert } from './types'
import { PLANT_PRESETS } from './types'
import { SectionHeader, IconBell } from './SectionHeader'

interface AlertPanelProps {
  alerts: BedAlert[]
  dismissedCount: number
  beds: BedConfig[]
  onSelectBed: (id: string) => void
  onDismiss: (bedId: string, alertType: string) => void
  onTriggerSunHeatmap: () => void
}

export default function AlertPanel({
  alerts,
  dismissedCount,
  beds,
  onSelectBed,
  onDismiss,
  onTriggerSunHeatmap,
}: AlertPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside
  useEffect(() => {
    if (!expanded) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [expanded])

  if (alerts.length === 0 && dismissedCount === 0) return null

  const errorCount = alerts.filter((a) => a.severity === 'error').length
  const warningCount = alerts.length - errorCount
  const hasErrors = errorCount > 0

  function bedName(bedId: string): string {
    const bed = beds.find((b) => b.id === bedId)
    if (!bed) return bedId
    if (bed.plantType) return PLANT_PRESETS[bed.plantType].name
    return bed.name
  }

  function handleAlertClick(alert: BedAlert) {
    onSelectBed(alert.bedId)
    if (alert.type === 'sun-exposure') {
      onTriggerSunHeatmap()
    }
    setExpanded(false)
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Notification badge button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg backdrop-blur-sm text-sm font-medium transition-colors ${
          expanded
            ? 'bg-gray-900/90 text-white'
            : alerts.length === 0
              ? 'bg-gray-800/70 text-gray-400 hover:bg-gray-800/85'
              : hasErrors
                ? 'bg-red-900/70 text-red-200 hover:bg-red-900/85'
                : 'bg-amber-900/70 text-amber-200 hover:bg-amber-900/85'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <span>{alerts.length}</span>
        {alerts.length > 0 && errorCount > 0 && warningCount > 0 && (
          <span className="text-xs opacity-70">
            ({errorCount}err/{warningCount}warn)
          </span>
        )}
        {dismissedCount > 0 && (
          <span className="text-xs opacity-50">
            +{dismissedCount} dismissed
          </span>
        )}
      </button>

      {/* Expanded dropdown */}
      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-80 max-h-80 overflow-y-auto bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl">
          <div className="px-3 py-2 border-b border-gray-700">
            <SectionHeader icon={<IconBell />} title="Plant Alerts" />
          </div>
          <div className="py-1">
            {alerts.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-500 text-center">
                All alerts dismissed. Move a bed to re-check.
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div
                  key={`${alert.bedId}-${alert.type}-${i}`}
                  className={`flex items-start gap-2 px-3 py-2 text-xs transition-colors hover:bg-gray-800/80 ${
                    alert.severity === 'error'
                      ? 'text-red-300'
                      : 'text-amber-300'
                  }`}
                >
                  <button
                    onClick={() => handleAlertClick(alert)}
                    className="flex items-start gap-2 min-w-0 flex-1 text-left"
                  >
                    <span className="flex-shrink-0 mt-0.5">
                      {alert.type === 'sun-exposure' ? '\u2600' : '\u2194'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{bedName(alert.bedId)}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{alert.message}</div>
                      {alert.type === 'sun-exposure' && (
                        <div className="text-[9px] opacity-50 mt-0.5">
                          Click to show sun heatmap
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDismiss(alert.bedId, alert.type)
                    }}
                    className="flex-shrink-0 mt-0.5 p-0.5 rounded hover:bg-gray-700/60 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Dismiss until bed is moved"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
