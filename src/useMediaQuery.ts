import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query. Updates live as the viewport changes.
 *
 * Used to switch between the desktop sidebar layout and the mobile
 * bottom-sheet shell at the `md` (768px) breakpoint.
 *
 * Belt-and-suspenders: MediaQueryList's `change` event is the primary signal,
 * but some environments (headless automation, certain mobile browser quirks)
 * don't reliably emit it on viewport changes, so we also re-check on `resize`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    // Sync immediately in case the query result differs from the initial false.
    update()
    mql.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      mql.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [query])

  return matches
}
