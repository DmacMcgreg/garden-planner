import { NAV_ITEMS } from './NavSidebarItems'

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
