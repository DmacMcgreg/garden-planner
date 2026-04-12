import type { ReactNode } from 'react'

type SectionHeaderProps = {
  icon: ReactNode
  title: string
  right?: ReactNode
}

export function SectionHeader({ icon, title, right }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">
        {icon}
        {title}
      </h2>
      {right}
    </div>
  )
}

const iconWrapperClass = 'inline-flex w-4 h-4 flex-shrink-0'
const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'w-4 h-4',
}

export function IconCalendar() {
  return (
    <span className={`${iconWrapperClass} text-amber-300`}>
      <svg {...svgProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
      </svg>
    </span>
  )
}

export function IconClock() {
  return (
    <span className={`${iconWrapperClass} text-sky-300`}>
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    </span>
  )
}

export function IconSun() {
  return (
    <span className={`${iconWrapperClass} text-yellow-300`}>
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.9" y1="4.9" x2="7" y2="7" />
        <line x1="17" y1="17" x2="19.1" y2="19.1" />
        <line x1="4.9" y1="19.1" x2="7" y2="17" />
        <line x1="17" y1="7" x2="19.1" y2="4.9" />
      </svg>
    </span>
  )
}

export function IconSunRays() {
  return (
    <span className={`${iconWrapperClass} text-orange-300`}>
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3 L12 6" />
        <path d="M21 12 L18 12" />
        <path d="M12 21 L12 18" />
        <path d="M3 12 L6 12" />
        <path d="M18.36 5.64 L16.24 7.76" />
        <path d="M18.36 18.36 L16.24 16.24" />
        <path d="M5.64 18.36 L7.76 16.24" />
        <path d="M5.64 5.64 L7.76 7.76" />
      </svg>
    </span>
  )
}

export function IconHeatGrid() {
  return (
    <span className={`${iconWrapperClass} text-rose-300`}>
      <svg {...svgProps}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
    </span>
  )
}

export function IconCompassArrow() {
  return (
    <span className={`${iconWrapperClass} text-cyan-300`}>
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="9" />
        <polygon points="16 8 12 17 11 13 7 12 16 8" />
      </svg>
    </span>
  )
}

export function IconCompassRose() {
  return (
    <span className={`${iconWrapperClass} text-cyan-300`}>
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="9" />
        <polygon points="12 4 14 12 12 20 10 12 12 4" />
        <polygon points="4 12 12 10 20 12 12 14 4 12" />
      </svg>
    </span>
  )
}

export function IconRuler() {
  return (
    <span className={`${iconWrapperClass} text-teal-300`}>
      <svg {...svgProps}>
        <path d="M2 16 L16 2 L22 8 L8 22 Z" />
        <line x1="6" y1="12" x2="8" y2="14" />
        <line x1="9" y1="9" x2="12" y2="12" />
        <line x1="12" y1="6" x2="14" y2="8" />
        <line x1="15" y1="3" x2="17" y2="5" />
      </svg>
    </span>
  )
}

export function IconSprout() {
  return (
    <span className={`${iconWrapperClass} text-green-300`}>
      <svg {...svgProps}>
        <path d="M12 21 L12 11" />
        <path d="M12 11 C 12 7, 15 4, 20 4 C 20 9, 17 12, 12 12" />
        <path d="M12 13 C 12 10, 9 7, 4 7 C 4 11, 7 14, 12 14" />
      </svg>
    </span>
  )
}

export function IconHouse() {
  return (
    <span className={`${iconWrapperClass} text-slate-300`}>
      <svg {...svgProps}>
        <path d="M3 11 L12 3 L21 11" />
        <path d="M5 10 L5 21 L19 21 L19 10" />
        <rect x="10" y="14" width="4" height="7" />
      </svg>
    </span>
  )
}

export function IconSave() {
  return (
    <span className={`${iconWrapperClass} text-indigo-300`}>
      <svg {...svgProps}>
        <path d="M5 3 L17 3 L21 7 L21 21 L3 21 L3 3 Z" />
        <rect x="7" y="3" width="10" height="6" />
        <rect x="7" y="13" width="10" height="8" />
      </svg>
    </span>
  )
}

export function IconBell() {
  return (
    <span className={`${iconWrapperClass} text-red-300`}>
      <svg {...svgProps}>
        <path d="M6 9 C 6 5.5, 8.7 3, 12 3 C 15.3 3, 18 5.5, 18 9 L 18 14 L 20 17 L 4 17 L 6 14 Z" />
        <path d="M10 20 C 10 21.1, 10.9 22, 12 22 C 13.1 22, 14 21.1, 14 20" />
      </svg>
    </span>
  )
}

export function IconMapPin() {
  return (
    <span className={`${iconWrapperClass} text-emerald-300`}>
      <svg {...svgProps}>
        <path d="M12 22 C 12 22, 5 14.5, 5 9.5 C 5 5.9, 8.1 3, 12 3 C 15.9 3, 19 5.9, 19 9.5 C 19 14.5, 12 22, 12 22 Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    </span>
  )
}
