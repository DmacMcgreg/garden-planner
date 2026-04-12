# Garden Planner

3D backyard garden planner for a 24x10 ft yard in Ontario (~43.7N). Built with React, Three.js (react-three-fiber + drei), Vite, Tailwind CSS.

## Commands

```bash
bun run dev      # Start dev server
bun run build    # Type-check + production build
bun run preview  # Preview production build
```

## Architecture

Single-page app. All state lives in `App.tsx` and flows down as props.

### File Map

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component. All state (layout, season, hour, structures, beds, sun probe, heatmap). Sidebar UI. Compass rose SVG. Sun exposure panel. |
| `src/Scene.tsx` | Three.js canvas and all 3D rendering. Orbit controls, lighting, ground plane, structures, garden beds, paths, solar panels, sun visualization, heatmap overlay, measurement labels, direction labels, sun probe marker. |
| `src/types.ts` | All TypeScript interfaces (`BedConfig`, `Structure`, `LayoutConfig`, `PanelConfig`, `PathConfig`). Plant presets (`PLANT_PRESETS`). Default structures (`DEFAULT_STRUCTURES`). |
| `src/layouts.ts` | Three layout presets (A: Row-Based, B: Companion Zones, C: Raised Bed Grid). Plant color constants. Plant legend. Re-exports types from `types.ts`. |
| `src/sun.ts` | Sun position math (solar declination, altitude, azimuth). Sun exposure calculation with ray-AABB shadow casting. Heatmap grid generation. Season/time utilities. |
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
