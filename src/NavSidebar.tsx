interface NavItem {
  id: string
  label: string
  icon: JSX.Element
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'section-config',
    label: 'Config',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    ),
  },
  {
    id: 'section-season',
    label: 'Season',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M11 20A7 7 0 019.8 6.9C15.5 4.9 17 2 17 2c0 6 2 8 2 12a7 7 0 01-8 6z" />
        <path d="M11 20c0-3 1.5-5 3-6.5" />
      </svg>
    ),
  },
  {
    id: 'section-time',
    label: 'Time',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'section-sun-position',
    label: 'Sun',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
  {
    id: 'section-sun-exposure',
    label: 'Probe',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    id: 'section-heatmap',
    label: 'Heatmap',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 15h18" />
        <path d="M3 9h18" />
        <path d="M9 3v18" />
        <path d="M15 3v18" />
      </svg>
    ),
  },
  {
    id: 'section-orientation',
    label: 'Orient',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 12a9 9 0 11-6.2-8.6" />
        <polyline points="22 4 12 12 17 12" />
      </svg>
    ),
  },
  {
    id: 'section-compass',
    label: 'Compass',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    id: 'section-measurements',
    label: 'Measure',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M2 20L20 2" />
        <path d="M6.5 17.5l2-2" />
        <path d="M10.5 13.5l2-2" />
        <path d="M14.5 9.5l2-2" />
      </svg>
    ),
  },
  {
    id: 'section-beds',
    label: 'Beds',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M7 20l4-16" />
        <path d="M17 20l-4-16" />
        <path d="M12 8c-3 0-4 1-4 2s1 2 4 2 4 1 4 2-1 2-4 2" />
      </svg>
    ),
  },
  {
    id: 'section-structures',
    label: 'Structs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="4" y="10" width="16" height="11" rx="1" />
        <path d="M12 3L3 10h18L12 3z" />
        <rect x="9" y="15" width="6" height="6" />
      </svg>
    ),
  },
]

interface NavSidebarProps {
  sidebarRef: React.RefObject<HTMLElement | null>
}

export default function NavSidebar({ sidebarRef }: NavSidebarProps) {
  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (!el || !sidebarRef.current) return
    const sidebar = sidebarRef.current
    const elTop = el.offsetTop - sidebar.offsetTop
    sidebar.scrollTo({ top: elTop - 8, behavior: 'smooth' })
  }

  return (
    <nav
      className="flex-shrink-0 flex flex-col items-center py-2 gap-0.5 overflow-y-auto border-r border-gray-700"
      style={{ background: '#171b26', width: 64 }}
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollTo(item.id)}
          className="flex flex-col items-center justify-center w-14 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/60 transition-colors"
          title={item.label}
        >
          {item.icon}
          <span className="text-[9px] mt-0.5 leading-tight">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
