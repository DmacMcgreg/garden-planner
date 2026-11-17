# Garden Planner

3D backyard garden planner for a 24x10 ft yard in Ontario (~43.7N). Built with React, Three.js (react-three-fiber + drei), Vite, Tailwind CSS.

## Commands

```bash
bun run dev        # Start dev server
bun run build      # Type-check + production build
bun run preview    # Preview production build
bun run test       # Run the vitest suite (golden-value sun-math + batch equivalence)
bun run test:watch # vitest in watch mode
```

## Tests

`src/sun.test.ts` is a **golden-value regression suite** for the pure sun math.
The expected values were captured from the implementation *before* the
optimisation work, so any drift in solar geometry, shadow casting, or the
`calculateSunExposureBatch` optimisation is caught. **Keep these green when
touching `sun.ts`** — update expectations deliberately only if you
intentionally change the physics, and explain why in the commit.

When changing UI, also verify the desktop layout with a screenshot diff at
1440×900 against a known-good baseline — the refactor into `sections.tsx` was
verified pixel-identical that way.

## Architecture

Single-page app. All state lives in `App.tsx` and flows down as props.

### File Map

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component. All state (layout, season, hour, structures, beds, sun probe, heatmap). Renders desktop sidebar OR mobile shell based on viewport (see `useMediaQuery`). Lazy-loads `Scene`. |
| `src/Scene.tsx` | Three.js canvas and all 3D rendering. Orbit controls (touch: one-finger pan, two-finger dolly+rotate), lighting, ground plane, structures, garden beds, sun visualization, heatmap overlay, measurement labels, direction labels, sun probe marker. **Lazy-loaded** as its own chunk. |
| `src/sections.tsx` | Presentational sidebar sections (`DateSection`, `TimeSection`, `SunPositionSection`, …) shared by the desktop `<aside>` and the mobile bottom sheet. Pure functions of props — no app state. |
| `src/MobileShell.tsx` | Mobile-only layout: full-viewport canvas + floating icon rail + bottom-sheet-per-section (`role="dialog"`). Rendered below the `md` breakpoint. |
| `src/NavSidebarItems.tsx` | Shared nav-rail item list (id + label + icon) used by both desktop `NavSidebar` and `MobileShell`. |
| `src/useMediaQuery.ts` | `useMediaQuery(query)` hook for the desktop/mobile switch. |
| `src/types.ts` | All TypeScript interfaces (`BedConfig`, `Structure`, `LayoutConfig`, `PanelConfig`, `PathConfig`). Plant presets (`PLANT_PRESETS`). Default structures (`DEFAULT_STRUCTURES`). |
| `src/layouts.ts` | Three layout presets (A: Row-Based, B: Companion Zones, C: Raised Bed Grid). Plant color constants. Plant legend. Re-exports types from `types.ts`. |
| `src/sun.ts` | Sun position math (solar declination, altitude, azimuth). Sun exposure calculation (`calculateSunExposure`) + batch variant (`calculateSunExposureBatch` — output-equivalent, precomputes sun steps once). Heatmap grid generation. Season/time utilities. |
| `src/sun.test.ts` | Golden-value regression tests for `sun.ts` + batch/per-point equivalence proof. |
| `src/BedPanel.tsx` | Sidebar panel for garden bed CRUD (list, add by plant type, edit position/size/sun/trellis/color, delete, reset). |
| `src/StructurePanel.tsx` | Sidebar panel for structure CRUD (buildings + fences, edit position/size/color/shadow, delete, reset). |
| `src/ConfigPanel.tsx` | Sidebar panel for save/load configs. localStorage persistence, JSON export/import. |

### Scene Coordinate System

- **X axis**: -12 (back fence/WSW) to +12 (house wall/ENE)
- **Z axis**: -5 (side fence/NNW) to +5 (open/sunniest/SSE)
- **Y axis**: up
- Origin at yard center. Yard heading configurable (default 67.5deg = ENE).

### Key 3D Components in Scene.tsx

- `SelectedStructureGizmo` -- TransformControls wrapper for dragging structures. Position goes on the `<TransformControls>` element, not the child group.
- `SelectedBedGizmo` -- Same pattern for garden beds.
- `SunHeatmapOverlay` -- DataTexture-based heatmap rendered as a plane above ground.
- `GardenBed` -- Wooden frame + soil + plant surface + plant dot indicators + optional trellis + floating label.
- `StructureMesh` -- Simple box geometry for non-selected structures.

### State Flow

Objects are selected via `onSelectStructure`/`onSelectBed` (mutual exclusion). Selected objects render inside `TransformControls` gizmos instead of plain meshes. Drag-end writes snapped position back to state via `onStructureMove`/`onBedMove`.

### Sun/Shadow System

`sun.ts` computes sun position from day-of-year + hour + yard heading using solar geometry. Shadow detection uses ray-AABB intersection against all structures with `castShadow: true`. The heatmap grid precomputes exposure across the entire yard at configurable resolution.
