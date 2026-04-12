import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Line, TransformControls, Grid } from '@react-three/drei'
import { DoubleSide, BoxGeometry, Vector3, Vector2, Plane, Raycaster, DataTexture, RGBAFormat, UnsignedByteType, LinearFilter, ClampToEdgeWrapping, type Mesh } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  getSunPosition,
  degreesToCompass,
  type Season,
  type SunPosition,
  type HeatmapGrid,
  type HeatmapMode,
  type HeatmapInstance,
} from './sun'
import type { LayoutConfig, BedConfig, PathConfig, PanelConfig } from './layouts'
import { PLANT_PRESETS } from './types'
import type { Structure, MeasurementUnit } from './types'

const DEG2RAD = Math.PI / 180

// Visual sun sphere + sun-arc sit on an imaginary dome of this radius (ft).
// The actual directional light source is at sun.ts distance=120 for accurate
// shadow angles; this is purely a viewing aid.
const SUN_VIZ_RADIUS = 32

interface SceneProps {
  layout: LayoutConfig
  season: Season
  dayOfYear: number
  hour: number
  yardHeadingDeg: number
  structures: Structure[]
  selectedId: string | null
  beds: BedConfig[]
  selectedBedId: string | null
  onCameraAzimuthChange: (azimuth: number) => void
  onSelectStructure: (id: string | null) => void
  onStructureMove: (id: string, position: [number, number, number]) => void
  onSelectBed: (id: string | null) => void
  onBedMove: (id: string, x: number, z: number) => void
  onBedUpdate: (id: string, patch: Partial<BedConfig>) => void
  showMeasurements: boolean
  measurementUnit: MeasurementUnit
  sunProbeActive: boolean
  sunProbePosition: { x: number; z: number } | null
  onSunProbePlace: (x: number, z: number) => void
  heatmaps: HeatmapInstance[]
  heatmapGrids: Record<string, HeatmapGrid>
  selectedHeatmapId: string | null
  onSelectHeatmap: (id: string | null) => void
  onUpdateHeatmap: (id: string, patch: Partial<HeatmapInstance>) => void
  gardenItemsOpacity: number
  showGrid: boolean
  gridSpacing: number
  gridCenterX: number
  gridCenterZ: number
  gridWidth: number
  gridDepth: number
}

export default function GardenScene(props: SceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [-5, 28, 28], fov: 45, near: 0.1, far: 500 }}
      onPointerMissed={(e) => {
        // Only deselect if the click was on the canvas, not the sidebar
        if ((e.target as HTMLElement)?.closest?.('aside')) return
        if (!props.sunProbeActive) {
          props.onSelectStructure(null)
          props.onSelectBed(null)
          props.onSelectHeatmap(null)
        }
      }}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}

function SceneContent({
  layout,
  season,
  dayOfYear,
  hour,
  yardHeadingDeg,
  structures,
  selectedId,
  beds,
  selectedBedId,
  onCameraAzimuthChange,
  onSelectStructure,
  onStructureMove,
  onSelectBed,
  onBedMove,
  onBedUpdate,
  showMeasurements,
  measurementUnit,
  sunProbeActive,
  sunProbePosition,
  onSunProbePlace,
  heatmaps,
  heatmapGrids,
  selectedHeatmapId,
  onSelectHeatmap,
  onUpdateHeatmap,
  gardenItemsOpacity,
  showGrid,
  gridSpacing,
  gridCenterX,
  gridCenterZ,
  gridWidth,
  gridDepth,
}: SceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const lastAz = useRef(0)

  // F1: Report camera azimuth to parent (throttled)
  useFrame(() => {
    if (!controlsRef.current) return
    const az = controlsRef.current.getAzimuthalAngle()
    if (Math.abs(az - lastAz.current) > 0.01) {
      lastAz.current = az
      onCameraAzimuthChange(az)
    }
  })

  // F2: Sun with dynamic heading
  const sun = useMemo(
    () => getSunPosition(dayOfYear, hour, yardHeadingDeg),
    [dayOfYear, hour, yardHeadingDeg],
  )

  const sunPathPoints = useMemo(() => {
    const doy = dayOfYear
    const pts: [number, number, number][] = []
    for (let h = 4; h <= 22; h += 0.25) {
      const s = getSunPosition(doy, h, yardHeadingDeg)
      if (s.altitudeDeg > 0) {
        const norm = Math.sqrt(s.sceneX * s.sceneX + s.sceneY * s.sceneY + s.sceneZ * s.sceneZ) || 1
        const k = SUN_VIZ_RADIUS / norm
        pts.push([s.sceneX * k, s.sceneY * k, s.sceneZ * k])
      }
    }
    return pts
  }, [season, yardHeadingDeg])

  const skyColor = sun.isAboveHorizon ? '#b3d9f2' : '#111827'

  const selectedStructure = structures.find((s) => s.id === selectedId)
  const selectedBed = beds.find((b) => b.id === selectedBedId)

  return (
    <>
      <color attach="background" args={[skyColor]} />

      {/* Lighting */}
      <ambientLight intensity={sun.isAboveHorizon ? 0.35 : 0.08} />
      <hemisphereLight
        args={['#87CEEB', '#3a5a1c', sun.isAboveHorizon ? 0.25 : 0.03]}
      />

      {sun.isAboveHorizon && (
        <directionalLight
          position={[sun.sceneX, sun.sceneY, sun.sceneZ]}
          intensity={sun.intensity}
          color="#fff8e7"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={300}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-bias={-0.0005}
        />
      )}

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={8}
        maxDistance={250}
        enableDamping
      />

      {/* ---- Environment ---- */}

      {/* Ground (extends beyond yard) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
        onClick={sunProbeActive ? (e) => {
          e.stopPropagation()
          const p = e.point
          onSunProbePlace(
            Math.round(p.x * 2) / 2,
            Math.round(p.z * 2) / 2,
          )
        } : undefined}
      >
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#4a7c4a" />
      </mesh>

      {/* Yard area (24x10) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={sunProbeActive ? (e) => {
          e.stopPropagation()
          const p = e.point
          onSunProbePlace(
            Math.round(p.x * 2) / 2,
            Math.round(p.z * 2) / 2,
          )
        } : undefined}
      >
        <planeGeometry args={[24, 10]} />
        <meshStandardMaterial color="#5a8a50" />
      </mesh>

      {/* Shared space beyond yard (SSE side, z=5 to z=15) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 10]} receiveShadow>
        <planeGeometry args={[24, 10]} />
        <meshStandardMaterial color="#4e8248" />
      </mesh>

      {/* Property boundary line (z=+5, dashed) */}
      <Line
        points={[[-12, 0.05, 5], [12, 0.05, 5]]}
        color="#FFD700"
        lineWidth={2}
        dashed
        dashSize={1}
        gapSize={0.5}
      />

      {/* ---- Measurement grid overlay ---- */}
      {showGrid && (
        <Grid
          position={[gridCenterX, 0.015, gridCenterZ]}
          args={[gridWidth, gridDepth]}
          cellSize={gridSpacing}
          cellThickness={0.6}
          cellColor="#7a8a7a"
          sectionSize={gridSpacing * 5}
          sectionThickness={1.1}
          sectionColor="#c8e0c8"
          fadeDistance={Math.max(gridWidth, gridDepth) * 1.2}
          fadeStrength={1}
          infiniteGrid={false}
          followCamera={false}
          side={DoubleSide}
        />
      )}

      {/* ---- Sun heatmap overlays (multiple) ---- */}
      {heatmaps.map((h, i) => {
        const grid = heatmapGrids[h.id]
        const isSelected = h.id === selectedHeatmapId
        return (
          <group key={h.id}>
            {h.visible && grid && (
              <SunHeatmapOverlay
                grid={grid}
                mode={h.mode}
                opacity={h.opacity}
                yOffset={0.04 + i * 0.002}
              />
            )}
            <HeatmapGizmo
              heatmap={h}
              isSelected={isSelected}
              probing={sunProbeActive}
              orbitControlsRef={controlsRef}
              onSelect={onSelectHeatmap}
              onUpdate={onUpdateHeatmap}
            />
          </group>
        )
      })}

      {/* ---- F3: Data-driven structures ---- */}
      {structures.map((s) =>
        s.id === selectedId ? null : (
          <StructureMesh
            key={s.id}
            structure={s}
            onSelect={() => onSelectStructure(s.id)}
            probing={sunProbeActive}
          />
        ),
      )}

      {selectedStructure && (
        <SelectedStructureGizmo
          key={selectedStructure.id}
          structure={selectedStructure}
          orbitControlsRef={controlsRef}
          onMove={onStructureMove}
        />
      )}

      {/* ---- Garden elements ---- */}
      {beds.map((bed) =>
        bed.id === selectedBedId ? null : (
          <group key={bed.id} position={[bed.x, 0, bed.z]} rotation={[0, (bed.rotation ?? 0) * DEG2RAD, 0]}>
            <GardenBed bed={bed} isSelected={false} onSelect={() => onSelectBed(bed.id)} opacity={gardenItemsOpacity} probing={sunProbeActive} />
          </group>
        ),
      )}
      {selectedBed && (
        <SelectedBedGizmo
          key={selectedBed.id}
          bed={selectedBed}
          orbitControlsRef={controlsRef}
          onMove={onBedMove}
          onUpdate={onBedUpdate}
          opacity={gardenItemsOpacity}
        />
      )}
      {layout.paths.map((path, i) => (
        <WalkingPath key={`p${i}`} path={path} opacity={gardenItemsOpacity} />
      ))}
      {layout.panels.map((panel, i) => (
        <SolarPanel key={`sp${i}`} panel={panel} opacity={gardenItemsOpacity} />
      ))}

      {/* ---- Measurement labels ---- */}
      {showMeasurements && (
        <MeasurementLabels
          beds={beds}
          paths={layout.paths}
          panels={layout.panels}
          unit={measurementUnit}
        />
      )}

      {/* ---- Sun probe marker ---- */}
      {sunProbePosition && (
        <SunProbeMarker x={sunProbePosition.x} z={sunProbePosition.z} />
      )}

      {/* ---- Sun visualization ---- */}
      {sun.isAboveHorizon && <SunSphere sun={sun} />}
      {sunPathPoints.length > 2 && (
        <Line points={sunPathPoints} color="#FFA000" lineWidth={1.5} />
      )}

      {/* ---- F2: Dynamic direction labels ---- */}
      <DirectionLabels yardHeadingDeg={yardHeadingDeg} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  F3: Structure mesh (non-selected, clickable)                      */
/* ------------------------------------------------------------------ */

function StructureMesh({
  structure,
  onSelect,
  probing,
}: {
  structure: Structure
  onSelect: () => void
  probing: boolean
}) {
  return (
    <mesh
      position={structure.position}
      castShadow={structure.castShadow}
      receiveShadow={structure.receiveShadow}
      onClick={(e) => {
        if (probing) return
        e.stopPropagation()
        onSelect()
      }}
    >
      <boxGeometry args={structure.size} />
      <meshStandardMaterial color={structure.color} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  F3: Selected structure with TransformControls gizmo               */
/* ------------------------------------------------------------------ */

function SelectedStructureGizmo({
  structure,
  orbitControlsRef,
  onMove,
}: {
  structure: Structure
  orbitControlsRef: React.RefObject<OrbitControlsImpl | null>
  onMove: (id: string, position: [number, number, number]) => void
}) {
  const tcRef = useRef<{ addEventListener: Function; removeEventListener: Function; detach?: Function; dispose?: Function; object?: { position: Vector3 } } | null>(null)
  const isDragging = useRef(false)

  useEffect(() => {
    const tc = tcRef.current
    if (!tc) return
    const handler = (event: { value: boolean }) => {
      isDragging.current = event.value
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = !event.value
      }
      if (!event.value && tc.object) {
        const p = tc.object.position
        onMove(structure.id, [
          Math.round(p.x * 2) / 2,
          Math.round(p.y * 2) / 2,
          Math.round(p.z * 2) / 2,
        ])
      }
    }
    tc.addEventListener('dragging-changed', handler)
    return () => {
      tc.removeEventListener('dragging-changed', handler)
      tc.detach?.()
      tc.dispose?.()
    }
  }, [structure.id, onMove, orbitControlsRef])

  const edgesGeo = useMemo(
    () => new BoxGeometry(...structure.size),
    [structure.size[0], structure.size[1], structure.size[2]],
  )

  return (
    <TransformControls
      ref={tcRef as React.Ref<never>}
      mode="translate"
      translationSnap={0.5}
      position={structure.position}
    >
      <group>
        <mesh
          castShadow={structure.castShadow}
          receiveShadow={structure.receiveShadow}
          onClick={(e) => e.stopPropagation()}
        >
          <boxGeometry args={structure.size} />
          <meshStandardMaterial color={structure.color} />
        </mesh>
        {/* Selection highlight */}
        <lineSegments>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial color="#00ff88" />
        </lineSegments>
      </group>
    </TransformControls>
  )
}

/* ------------------------------------------------------------------ */
/*  Selected garden bed with TransformControls gizmo                  */
/* ------------------------------------------------------------------ */

type DragMode = 'translate' | 'resize' | 'rotate'
type ResizeEdge = 'x+' | 'x-' | 'z+' | 'z-'

interface DragState {
  mode: DragMode
  edge?: ResizeEdge
  startPoint: Vector3
  startX: number
  startZ: number
  startWidth: number
  startDepth: number
  startRotation: number
  startAngle: number
  lastPatch: Partial<BedConfig>
}

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0)

function SelectedBedGizmo({
  bed,
  orbitControlsRef,
  onMove,
  onUpdate,
  opacity,
}: {
  bed: BedConfig
  orbitControlsRef: React.RefObject<OrbitControlsImpl | null>
  onMove: (id: string, x: number, z: number) => void
  onUpdate: (id: string, patch: Partial<BedConfig>) => void
  opacity: number
}) {
  const { camera, gl } = useThree()
  const dragRef = useRef<DragState | null>(null)
  const [localPatch, setLocalPatch] = useState<Partial<BedConfig> | null>(null)
  const raycasterRef = useRef(new Raycaster())
  const [hovered, setHovered] = useState<string | null>(null)

  // Stable refs for callbacks used in window event listeners
  const bedRef = useRef(bed)
  bedRef.current = bed
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const displayBed = localPatch ? { ...bed, ...localPatch } : bed
  const rot = (displayBed.rotation ?? 0) * DEG2RAD
  const frameH = 0.5

  function groundPoint(e: PointerEvent): Vector3 | null {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycasterRef.current.setFromCamera(ndc, camera)
    const target = new Vector3()
    return raycasterRef.current.ray.intersectPlane(GROUND_PLANE, target) ? target : null
  }

  function startDrag(e: { stopPropagation: () => void; nativeEvent: PointerEvent; point: Vector3 }, mode: DragMode, edge?: ResizeEdge) {
    e.stopPropagation()
    // Stop the native DOM event to prevent OrbitControls from starting its own drag
    e.nativeEvent.stopImmediatePropagation()
    if (orbitControlsRef.current) orbitControlsRef.current.enabled = false
    // Use the R3F intersection point projected to ground (Y=0) for reliability
    const point = new Vector3(e.point.x, 0, e.point.z)
    const bedNow = bedRef.current
    dragRef.current = {
      mode,
      edge,
      startPoint: point.clone(),
      startX: bedNow.x,
      startZ: bedNow.z,
      startWidth: bedNow.width,
      startDepth: bedNow.depth,
      startRotation: bedNow.rotation ?? 0,
      startAngle: Math.atan2(point.z - bedNow.z, point.x - bedNow.x) * (180 / Math.PI),
      lastPatch: {},
    }
  }

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const ds = dragRef.current
      if (!ds) return
      const point = groundPoint(e)
      if (!point) return

      let patch: Partial<BedConfig> = {}

      if (ds.mode === 'translate') {
        const dx = point.x - ds.startPoint.x
        const dz = point.z - ds.startPoint.z
        patch = {
          x: Math.round((ds.startX + dx) * 2) / 2,
          z: Math.round((ds.startZ + dz) * 2) / 2,
        }
      } else if (ds.mode === 'resize' && ds.edge) {
        const rotRad = -ds.startRotation * DEG2RAD
        const wdx = point.x - ds.startPoint.x
        const wdz = point.z - ds.startPoint.z
        const ldx = wdx * Math.cos(rotRad) + wdz * Math.sin(rotRad)
        const ldz = -wdx * Math.sin(rotRad) + wdz * Math.cos(rotRad)

        // Work in local edge coordinates relative to the bed's starting center.
        // Only the dragged edge moves — the opposite edge stays fixed, which
        // keeps the non-dragged side anchored in place.
        let ePlusX = ds.startWidth / 2
        let eMinusX = -ds.startWidth / 2
        let ePlusZ = ds.startDepth / 2
        let eMinusZ = -ds.startDepth / 2

        if (ds.edge === 'x+') ePlusX += ldx
        else if (ds.edge === 'x-') eMinusX += ldx
        else if (ds.edge === 'z+') ePlusZ += ldz
        else if (ds.edge === 'z-') eMinusZ += ldz

        // Enforce minimum dimension of 1 ft on the dragged axis.
        if (ePlusX - eMinusX < 1) {
          if (ds.edge === 'x+') ePlusX = eMinusX + 1
          else if (ds.edge === 'x-') eMinusX = ePlusX - 1
        }
        if (ePlusZ - eMinusZ < 1) {
          if (ds.edge === 'z+') ePlusZ = eMinusZ + 1
          else if (ds.edge === 'z-') eMinusZ = ePlusZ - 1
        }

        const newWidth = ePlusX - eMinusX
        const newDepth = ePlusZ - eMinusZ
        const centerLocalX = (ePlusX + eMinusX) / 2
        const centerLocalZ = (ePlusZ + eMinusZ) / 2

        // Rotate the local center shift back into world space so the bed's
        // fixed edge stays put even when the bed is rotated.
        const cr = Math.cos(ds.startRotation * DEG2RAD)
        const sr = Math.sin(ds.startRotation * DEG2RAD)
        const shiftWorldX = cr * centerLocalX + sr * centerLocalZ
        const shiftWorldZ = -sr * centerLocalX + cr * centerLocalZ

        const snap = (v: number) => Math.round(v * 2) / 2
        patch = {
          width: snap(newWidth),
          depth: snap(newDepth),
          x: snap(ds.startX + shiftWorldX),
          z: snap(ds.startZ + shiftWorldZ),
        }
      } else if (ds.mode === 'rotate') {
        const bedNow = bedRef.current
        const currentAngle = Math.atan2(point.z - bedNow.z, point.x - bedNow.x) * (180 / Math.PI)
        const delta = currentAngle - ds.startAngle
        patch = { rotation: Math.round((ds.startRotation - delta) / 45) * 45 }
      }

      ds.lastPatch = patch
      setLocalPatch(patch)
    }

    const handleUp = () => {
      const ds = dragRef.current
      if (!ds) return
      const bedNow = bedRef.current
      const patch = ds.lastPatch

      if (patch.x !== undefined || patch.z !== undefined) {
        onMoveRef.current(bedNow.id, patch.x ?? bedNow.x, patch.z ?? bedNow.z)
      }
      const sizePatch: Partial<BedConfig> = {}
      if (patch.width !== undefined) sizePatch.width = patch.width
      if (patch.depth !== undefined) sizePatch.depth = patch.depth
      if (patch.rotation !== undefined) sizePatch.rotation = patch.rotation
      if (Object.keys(sizePatch).length > 0) {
        onUpdateRef.current(bedNow.id, sizePatch)
      }

      dragRef.current = null
      setLocalPatch(null)
      if (orbitControlsRef.current) orbitControlsRef.current.enabled = true
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, orbitControlsRef])

  const handleColor = (id: string, base: string) => hovered === id ? '#ffdd44' : base
  const handleCursor = (cursor: string) => ({
    onPointerEnter: () => { setHovered(cursor); gl.domElement.style.cursor = cursor === 'rotate' ? 'crosshair' : cursor === 'move' ? 'move' : 'ew-resize' },
    onPointerLeave: () => { setHovered(null); gl.domElement.style.cursor = 'auto' },
  })

  return (
    <group position={[displayBed.x, 0, displayBed.z]} rotation={[0, rot, 0]}>
      {/* Bed body - translate on drag */}
      <group
        onPointerDown={(e) => startDrag(e, 'translate')}
        {...handleCursor('move')}
      >
        <GardenBed bed={displayBed} isSelected onSelect={() => {}} opacity={opacity} probing={false} />
      </group>

      {/* Resize handles on edges */}
      {([
        ['x+', displayBed.width / 2, 0],
        ['x-', -displayBed.width / 2, 0],
        ['z+', 0, displayBed.depth / 2],
        ['z-', 0, -displayBed.depth / 2],
      ] as [ResizeEdge, number, number][]).map(([edge, hx, hz]) => {
        const isX = edge.startsWith('x')
        const barLen = Math.min(isX ? displayBed.depth * 0.5 : displayBed.width * 0.5, 2.0)
        return (
          <mesh
            key={edge}
            position={[hx, frameH + 0.25, hz]}
            onPointerDown={(e) => startDrag(e, 'resize', edge)}
            {...handleCursor(isX ? 'ew-resize' : 'ns-resize')}
          >
            <boxGeometry args={[
              isX ? 0.3 : barLen,
              0.3,
              isX ? barLen : 0.3,
            ]} />
            <meshStandardMaterial color={handleColor(edge, '#66bbff')} emissive={handleColor(edge, '#66bbff')} emissiveIntensity={0.5} transparent opacity={0.9} />
          </mesh>
        )
      })}

      {/* Rotate handle at corner */}
      <mesh
        position={[displayBed.width / 2, frameH + 0.25, -displayBed.depth / 2]}
        onPointerDown={(e) => startDrag(e, 'rotate')}
        {...handleCursor('rotate')}
      >
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color={handleColor('rotate', '#ff8800')} emissive={handleColor('rotate', '#ff8800')} emissiveIntensity={0.5} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Measurement labels (3D overlays)                                  */
/* ------------------------------------------------------------------ */

function MeasurementLabels({
  beds,
  paths,
  panels,
  unit,
}: {
  beds: BedConfig[]
  paths: PathConfig[]
  panels: PanelConfig[]
  unit: MeasurementUnit
}) {
  const fmt = (ft: number) => {
    const val = unit === 'ft' ? ft : ft * 0.3048
    const suffix = unit === 'ft' ? 'ft' : 'm'
    return `${val.toFixed(1)}${suffix}`
  }

  const labelStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.7)',
    color: '#67e8f9',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '9px',
    whiteSpace: 'nowrap',
    fontFamily: 'ui-monospace, monospace',
    fontWeight: 500,
    border: '1px solid rgba(103,232,249,0.4)',
  }

  return (
    <>
      {beds.map((bed) => {
        const rot = (bed.rotation ?? 0) * DEG2RAD
        const offsetX = -Math.sin(rot) * (bed.depth / 2 + 0.5)
        const offsetZ = Math.cos(rot) * (bed.depth / 2 + 0.5)
        return (
          <Html
            key={`m-${bed.id}`}
            position={[bed.x + offsetX, 0.02, bed.z + offsetZ]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div style={labelStyle}>
              {fmt(bed.width)} x {fmt(bed.depth)}
            </div>
          </Html>
        )
      })}
      {paths.map((path, i) => (
        <Html
          key={`mp-${i}`}
          position={[path.x, 0.02, path.z + path.depth / 2 + 0.4]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={labelStyle}>
            {fmt(path.width)} x {fmt(path.depth)}
          </div>
        </Html>
      ))}
      {panels.map((panel, i) => (
        <Html
          key={`msp-${i}`}
          position={[panel.x, 0.1, panel.z + panel.widthFt / 2 + 0.4]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={labelStyle}>
            {fmt(panel.widthFt)} x {fmt(panel.heightFt)}
          </div>
        </Html>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Garden Bed                                                        */
/* ------------------------------------------------------------------ */

function GardenBed({
  bed,
  isSelected,
  onSelect,
  opacity,
  probing,
}: {
  bed: BedConfig
  isSelected: boolean
  onSelect: () => void
  opacity: number
  probing: boolean
}) {
  const frameH = 0.5
  const frameW = bed.width + 0.12
  const frameD = bed.depth + 0.12
  const faded = opacity < 1
  // key forces Three.js to recreate the material when transparent toggles
  const matKey = faded ? 't' : 'o'

  const edgesGeo = useMemo(
    () => new BoxGeometry(frameW, frameH, frameD),
    [frameW, frameD],
  )

  return (
    <group>
      {/* Wooden frame (clickable) */}
      <mesh
        position={[0, frameH / 2, 0]}
        castShadow={!faded}
        receiveShadow
        onClick={(e) => {
          if (probing) return
          e.stopPropagation()
          onSelect()
        }}
      >
        <boxGeometry args={[frameW, frameH, frameD]} />
        <meshStandardMaterial key={matKey + 'f'} color="#6d4c2a" transparent={faded} opacity={opacity} depthWrite={!faded} />
      </mesh>

      {/* Selection highlight */}
      {isSelected && (
        <lineSegments position={[0, frameH / 2, 0]}>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial color="#00ff88" />
        </lineSegments>
      )}

      {/* Soil */}
      <mesh position={[0, frameH - 0.04, 0]} receiveShadow>
        <boxGeometry args={[bed.width - 0.04, 0.08, bed.depth - 0.04]} />
        <meshStandardMaterial key={matKey + 's'} color="#3e2723" transparent={faded} opacity={opacity} depthWrite={!faded} />
      </mesh>

      {/* Plant surface color */}
      <mesh position={[0, frameH + 0.01, 0]} receiveShadow castShadow={!faded}>
        <boxGeometry args={[bed.width - 0.1, 0.04, bed.depth - 0.1]} />
        <meshStandardMaterial key={matKey + 'p'} color={bed.color} transparent={faded} opacity={opacity} depthWrite={!faded} />
      </mesh>

      {/* Plant indicators (small spheres) */}
      <PlantDots bed={bed} baseY={frameH + 0.06} opacity={opacity} />

      {/* Trellis */}
      {bed.hasTrellis && (
        <Trellis
          width={bed.width}
          depth={bed.depth}
          height={bed.trellisHeight ?? 6}
          color={bed.color}
          opacity={opacity}
        />
      )}

      {/* Floating label */}
      <Html
        position={[0, bed.hasTrellis ? (bed.trellisHeight ?? 6) + 1 : 2, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.78)',
            color: '#fff',
            padding: '3px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 500,
            border: `2px solid ${isSelected ? '#00ff88' : bed.color}`,
          }}
        >
          {bed.sunNeeds === 'full' ? '\u2600\uFE0F ' : bed.sunNeeds === 'partial' ? '\uD83C\uDF24\uFE0F ' : '\u26C5 '}{bed.name}
          {isSelected && bed.plantType && (
            <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '1px' }}>
              pH {PLANT_PRESETS[bed.plantType].phRange[0]}&ndash;{PLANT_PRESETS[bed.plantType].phRange[1]} &middot; {PLANT_PRESETS[bed.plantType].minSunHours}+ PSH
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Plant dot indicators on beds                                      */
/* ------------------------------------------------------------------ */

function PlantDots({ bed, baseY, opacity }: { bed: BedConfig; baseY: number; opacity: number }) {
  const positions = useMemo(() => {
    const pts: [number, number, number][] = []
    const sp = bed.plantType
      ? Math.max(0.5, PLANT_PRESETS[bed.plantType].spacingInches / 12)
      : Math.max(0.8, Math.min(1.5, bed.width / 5))
    const cols = Math.max(1, Math.floor((bed.width - 0.4) / sp))
    const rows = Math.max(1, Math.floor((bed.depth - 0.3) / sp))
    const gx = bed.width / (cols + 1)
    const gz = bed.depth / (rows + 1)
    for (let c = 1; c <= cols; c++) {
      for (let r = 1; r <= rows; r++) {
        pts.push([
          -bed.width / 2 + c * gx,
          baseY,
          -bed.depth / 2 + r * gz,
        ])
      }
    }
    return pts
  }, [bed.width, bed.depth, bed.plantType, baseY])

  const radius = bed.sunNeeds === 'full' ? 0.22 : 0.17
  const col = lighten(bed.color, 25)
  const faded = opacity < 1
  const matKey = faded ? 't' : 'o'

  return (
    <>
      {positions.map((p, i) => (
        <mesh key={i} position={p} castShadow={!faded}>
          <sphereGeometry args={[radius, 6, 6]} />
          <meshStandardMaterial key={matKey} color={col} transparent={faded} opacity={opacity} depthWrite={!faded} />
        </mesh>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Trellis (for vine / climbing crops)                               */
/* ------------------------------------------------------------------ */

function Trellis({
  width,
  depth,
  height,
  color,
  opacity,
}: {
  width: number
  depth: number
  height: number
  color: string
  opacity: number
}) {
  const faded = opacity < 1
  const matKey = faded ? 't' : 'o'
  const posts = useMemo(() => {
    const n = Math.max(2, Math.ceil(width / 3))
    return Array.from({ length: n }, (_, i) =>
      -width / 2 + 0.15 + (i / (n - 1)) * (width - 0.3),
    )
  }, [width])

  return (
    <group position={[0, 0, -depth / 2 - 0.1]}>
      {/* Vertical posts */}
      {posts.map((x, i) => (
        <mesh key={i} position={[x, height / 2, 0]} castShadow={!faded}>
          <boxGeometry args={[0.08, height, 0.08]} />
          <meshStandardMaterial key={matKey} color="#5D4037" transparent={faded} opacity={opacity} depthWrite={!faded} />
        </mesh>
      ))}

      {/* Horizontal rails */}
      {[1, 2, 3, 4].map((n) => {
        const y = (n / 4) * (height - 0.5) + 0.5
        return y <= height ? (
          <mesh key={n} position={[0, y, 0]} castShadow={!faded}>
            <boxGeometry args={[width - 0.1, 0.05, 0.05]} />
            <meshStandardMaterial key={matKey} color="#795548" transparent={faded} opacity={opacity} depthWrite={!faded} />
          </mesh>
        ) : null
      })}

      {/* Vine foliage (semi-transparent plane) */}
      <mesh position={[0, height / 2, 0.06]}>
        <planeGeometry args={[width - 0.2, height - 0.6]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={Math.min(0.3, opacity)}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Walking path                                                      */
/* ------------------------------------------------------------------ */

function WalkingPath({ path, opacity }: { path: PathConfig; opacity: number }) {
  const faded = opacity < 1
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[path.x, 0.015, path.z]}
      receiveShadow
    >
      <planeGeometry args={[path.width, path.depth]} />
      <meshStandardMaterial key={faded ? 't' : 'o'} color="#c4a882" transparent={faded} opacity={opacity} depthWrite={!faded} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Solar panel                                                       */
/* ------------------------------------------------------------------ */

function SolarPanel({ panel, opacity }: { panel: PanelConfig; opacity: number }) {
  const tiltRad = panel.tiltDeg * DEG2RAD
  const faded = opacity < 1
  const matKey = faded ? 't' : 'o'

  return (
    <group position={[panel.x, 0, panel.z]}>
      <group rotation={[0, 0, -tiltRad]}>
        <mesh position={[0, panel.heightFt / 2, 0]}>
          <boxGeometry
            args={[0.1, panel.heightFt + 0.08, panel.widthFt + 0.08]}
          />
          <meshStandardMaterial key={matKey + 'f'} color="#37474f" transparent={faded} opacity={opacity} depthWrite={!faded} />
        </mesh>
        <mesh position={[0, panel.heightFt / 2, 0]} castShadow={!faded} receiveShadow>
          <boxGeometry args={[0.06, panel.heightFt, panel.widthFt]} />
          <meshStandardMaterial
            key={matKey + 'p'}
            color="#1a237e"
            metalness={0.8}
            roughness={0.2}
            transparent={faded}
            opacity={opacity}
            depthWrite={!faded}
          />
        </mesh>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Sun sphere (visual indicator in sky)                              */
/* ------------------------------------------------------------------ */

function SunSphere({ sun }: { sun: SunPosition }) {
  const meshRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const { camera } = useThree()

  // Project the light direction onto a fixed dome radius so the sphere is
  // always visible — decoupled from the far-away light source.
  const norm =
    Math.sqrt(sun.sceneX * sun.sceneX + sun.sceneY * sun.sceneY + sun.sceneZ * sun.sceneZ) || 1
  const k = SUN_VIZ_RADIUS / norm
  const pos: [number, number, number] = [sun.sceneX * k, sun.sceneY * k, sun.sceneZ * k]

  // Auto-scale to keep the sphere a roughly constant screen size regardless
  // of zoom. Base size 0.8 ft at ~40 ft away; grows linearly with distance.
  useFrame(() => {
    const core = meshRef.current
    if (!core) return
    const dist = camera.position.distanceTo(core.position)
    const scale = Math.max(0.45, dist * 0.022)
    core.scale.setScalar(scale)
    if (glowRef.current) glowRef.current.scale.setScalar(scale)
  })

  return (
    <group position={pos}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.8, 20, 20]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.6, 20, 20]} />
        <meshBasicMaterial color="#FFC947" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  F2: Dynamic direction labels at yard edges                        */
/* ------------------------------------------------------------------ */

function DirectionLabels({ yardHeadingDeg }: { yardHeadingDeg: number }) {
  const labels = useMemo(() => {
    const plusX = degreesToCompass(yardHeadingDeg)
    const minusX = degreesToCompass((yardHeadingDeg + 180) % 360)
    const minusZ = degreesToCompass((yardHeadingDeg + 270) % 360)
    const plusZ = degreesToCompass((yardHeadingDeg + 90) % 360)
    return [
      { text: `${plusX} - House (3-storey)`, pos: [15, 2, 0] as [number, number, number], color: '#ff8a80' },
      { text: `${minusX} - Back Fence`, pos: [-14, 2, 0] as [number, number, number], color: '#ffe082' },
      { text: `${minusZ} - Side Fence`, pos: [0, 2, -7.5] as [number, number, number], color: '#90caf9' },
      { text: `${plusZ} - Open / Sunniest`, pos: [0, 2, 8] as [number, number, number], color: '#c5e1a5' },
    ]
  }, [yardHeadingDeg])

  return (
    <>
      {labels.map(({ text, pos, color }) => (
        <Html key={text} position={pos} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              color,
              padding: '3px 10px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {text}
          </div>
        </Html>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Sun Heatmap Overlay                                               */
/* ------------------------------------------------------------------ */

/** 6-stop high-contrast gradient with distinct hue jumps */
const HEATMAP_COLORS: [number, number, number][] = [
  [0, 0, 0],        // black (0.0)
  [0, 0, 200],      // blue (0.2)
  [0, 200, 220],    // cyan (0.4)
  [0, 220, 0],      // green (0.6)
  [255, 255, 0],    // yellow (0.8)
  [255, 0, 0],      // bright red (1.0)
];

function sampleGradient(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const segments = HEATMAP_COLORS.length - 1;
  const segment = Math.min(Math.floor(clamped * segments), segments - 1);
  const local = (clamped * segments) - segment;
  const a = HEATMAP_COLORS[segment];
  const b = HEATMAP_COLORS[segment + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * local),
    Math.round(a[1] + (b[1] - a[1]) * local),
    Math.round(a[2] + (b[2] - a[2]) * local),
  ];
}

function SunHeatmapOverlay({
  grid,
  mode,
  opacity,
  yOffset = 0.04,
}: {
  grid: HeatmapGrid
  mode: HeatmapMode
  opacity: number
  yOffset?: number
}) {
  const texture = useMemo(() => {
    const { cols, rows } = grid;

    // Select the data array and max for the current mode
    let data: Float32Array;
    let maxVal: number;
    switch (mode) {
      case 'directSunHours':
        data = grid.directSunHours;
        maxVal = grid.maxDirectSunHours;
        break;
      case 'peakSunHours':
        data = grid.peakSunHours;
        maxVal = grid.maxPeakSunHours;
        break;
      case 'peakIntensity':
        data = grid.peakIntensity;
        maxVal = grid.maxPeakIntensity;
        break;
      case 'energyRating':
        data = grid.energyRating;
        maxVal = grid.maxEnergyRating;
        break;
    }

    if (maxVal === 0) maxVal = 1; // avoid division by zero

    const pixels = new Uint8Array(cols * rows * 4);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const srcIdx = row * cols + col;
        // Plane rotation (-PI/2 around X) maps texture V=0 to scene maxZ,
        // so flip rows: grid row 0 (minZ) must land at texture top (V=1).
        const dstIdx = ((rows - 1 - row) * cols + col) * 4;
        const normalized = data[srcIdx] / maxVal;
        const [r, g, b] = sampleGradient(normalized);
        pixels[dstIdx] = r;
        pixels[dstIdx + 1] = g;
        pixels[dstIdx + 2] = b;
        pixels[dstIdx + 3] = 200; // alpha baked into texture
      }
    }

    const tex = new DataTexture(pixels, cols, rows, RGBAFormat, UnsignedByteType);
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    tex.wrapS = ClampToEdgeWrapping;
    tex.wrapT = ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [grid, mode]);

  // Plane covers the grid area, positioned just above ground
  const width = grid.maxX - grid.minX;
  const depth = grid.maxZ - grid.minZ;
  const centerX = (grid.minX + grid.maxX) / 2;
  const centerZ = (grid.minZ + grid.maxZ) / 2;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[centerX, yOffset, centerZ]}
    >
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Heatmap Gizmo (click-to-select + drag move + edge resize)         */
/* ------------------------------------------------------------------ */

interface HeatmapDragState {
  mode: 'translate' | 'resize'
  edge?: ResizeEdge
  startPoint: Vector3
  startCenterX: number
  startCenterZ: number
  startWidth: number
  startDepth: number
  lastPatch: Partial<HeatmapInstance>
}

function HeatmapGizmo({
  heatmap,
  isSelected,
  probing,
  orbitControlsRef,
  onSelect,
  onUpdate,
}: {
  heatmap: HeatmapInstance
  isSelected: boolean
  probing: boolean
  orbitControlsRef: React.RefObject<OrbitControlsImpl | null>
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<HeatmapInstance>) => void
}) {
  const { camera, gl } = useThree()
  const dragRef = useRef<HeatmapDragState | null>(null)
  const [localPatch, setLocalPatch] = useState<Partial<HeatmapInstance> | null>(null)
  const raycasterRef = useRef(new Raycaster())
  const [hovered, setHovered] = useState<string | null>(null)

  const heatmapRef = useRef(heatmap)
  heatmapRef.current = heatmap
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const display = localPatch ? { ...heatmap, ...localPatch } : heatmap
  const { centerX, centerZ, width, depth } = display
  const minX = centerX - width / 2
  const maxX = centerX + width / 2
  const minZ = centerZ - depth / 2
  const maxZ = centerZ + depth / 2

  function groundPoint(e: PointerEvent): Vector3 | null {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycasterRef.current.setFromCamera(ndc, camera)
    const target = new Vector3()
    return raycasterRef.current.ray.intersectPlane(GROUND_PLANE, target) ? target : null
  }

  function startDrag(
    e: { stopPropagation: () => void; nativeEvent: PointerEvent; point: Vector3 },
    mode: 'translate' | 'resize',
    edge?: ResizeEdge,
  ) {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    if (orbitControlsRef.current) orbitControlsRef.current.enabled = false
    const point = new Vector3(e.point.x, 0, e.point.z)
    const h = heatmapRef.current
    dragRef.current = {
      mode,
      edge,
      startPoint: point.clone(),
      startCenterX: h.centerX,
      startCenterZ: h.centerZ,
      startWidth: h.width,
      startDepth: h.depth,
      lastPatch: {},
    }
  }

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const ds = dragRef.current
      if (!ds) return
      const point = groundPoint(e)
      if (!point) return

      const snap = (v: number) => Math.round(v * 2) / 2
      let patch: Partial<HeatmapInstance> = {}

      if (ds.mode === 'translate') {
        const dx = point.x - ds.startPoint.x
        const dz = point.z - ds.startPoint.z
        patch = {
          centerX: snap(ds.startCenterX + dx),
          centerZ: snap(ds.startCenterZ + dz),
        }
      } else if (ds.mode === 'resize' && ds.edge) {
        const dx = point.x - ds.startPoint.x
        const dz = point.z - ds.startPoint.z

        let ePlusX = ds.startCenterX + ds.startWidth / 2
        let eMinusX = ds.startCenterX - ds.startWidth / 2
        let ePlusZ = ds.startCenterZ + ds.startDepth / 2
        let eMinusZ = ds.startCenterZ - ds.startDepth / 2

        if (ds.edge === 'x+') ePlusX += dx
        else if (ds.edge === 'x-') eMinusX += dx
        else if (ds.edge === 'z+') ePlusZ += dz
        else if (ds.edge === 'z-') eMinusZ += dz

        if (ePlusX - eMinusX < 2) {
          if (ds.edge === 'x+') ePlusX = eMinusX + 2
          else if (ds.edge === 'x-') eMinusX = ePlusX - 2
        }
        if (ePlusZ - eMinusZ < 2) {
          if (ds.edge === 'z+') ePlusZ = eMinusZ + 2
          else if (ds.edge === 'z-') eMinusZ = ePlusZ - 2
        }

        patch = {
          width: snap(ePlusX - eMinusX),
          depth: snap(ePlusZ - eMinusZ),
          centerX: snap((ePlusX + eMinusX) / 2),
          centerZ: snap((ePlusZ + eMinusZ) / 2),
        }
      }

      ds.lastPatch = patch
      setLocalPatch(patch)
    }

    const handleUp = () => {
      const ds = dragRef.current
      if (!ds) return
      const patch = ds.lastPatch
      if (Object.keys(patch).length > 0) {
        onUpdateRef.current(heatmapRef.current.id, patch)
      }
      dragRef.current = null
      setLocalPatch(null)
      if (orbitControlsRef.current) orbitControlsRef.current.enabled = true
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, orbitControlsRef])

  const outlineColor = isSelected ? '#fbbf24' : '#38bdf8'
  const handleColor = (id: string, base: string) => hovered === id ? '#ffffff' : base
  const outlineY = 0.06
  const handleY = 0.12
  const outlinePoints: [number, number, number][] = [
    [minX, outlineY, minZ],
    [maxX, outlineY, minZ],
    [maxX, outlineY, maxZ],
    [minX, outlineY, maxZ],
    [minX, outlineY, minZ],
  ]

  return (
    <>
      {/* Dashed outline */}
      <Line
        points={outlinePoints}
        color={outlineColor}
        lineWidth={isSelected ? 2.5 : 1.5}
        dashed
        dashSize={0.6}
        gapSize={0.3}
      />

      {/* Invisible click/drag plane at bounds (for selection when not selected, for move when selected) */}
      {!probing && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[centerX, 0.03, centerZ]}
          onPointerDown={(e) => {
            if (!isSelected) {
              e.stopPropagation()
              onSelect(heatmap.id)
              return
            }
            startDrag(e, 'translate')
          }}
          onPointerEnter={() => {
            gl.domElement.style.cursor = isSelected ? 'move' : 'pointer'
          }}
          onPointerLeave={() => {
            gl.domElement.style.cursor = 'auto'
          }}
        >
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial
            color="#fbbf24"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Edge resize handles (only when selected) */}
      {isSelected && !probing && (
        <>
          {([
            ['x+', maxX, centerZ],
            ['x-', minX, centerZ],
            ['z+', centerX, maxZ],
            ['z-', centerX, minZ],
          ] as [ResizeEdge, number, number][]).map(([edge, hx, hz]) => {
            const isX = edge.startsWith('x')
            const barLen = Math.min(isX ? depth * 0.6 : width * 0.6, 2.5)
            return (
              <mesh
                key={edge}
                position={[hx, handleY, hz]}
                onPointerDown={(e) => startDrag(e, 'resize', edge)}
                onPointerEnter={() => {
                  setHovered(edge)
                  gl.domElement.style.cursor = isX ? 'ew-resize' : 'ns-resize'
                }}
                onPointerLeave={() => {
                  setHovered(null)
                  gl.domElement.style.cursor = 'auto'
                }}
              >
                <boxGeometry args={[isX ? 0.3 : barLen, 0.25, isX ? barLen : 0.3]} />
                <meshStandardMaterial
                  color={handleColor(edge, '#fbbf24')}
                  emissive={handleColor(edge, '#fbbf24')}
                  emissiveIntensity={0.6}
                  transparent
                  opacity={0.95}
                />
              </mesh>
            )
          })}

          {/* Center move indicator */}
          <mesh position={[centerX, handleY, centerZ]}>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#fbbf24"
              emissiveIntensity={0.6}
              transparent
              opacity={0.85}
            />
          </mesh>
        </>
      )}

      {/* Label */}
      <Html
        position={[centerX, 0.15, maxZ + 0.4]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.75)',
            color: isSelected ? '#fde68a' : '#7dd3fc',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            border: `1px solid ${isSelected ? 'rgba(253,224,71,0.6)' : 'rgba(125,211,252,0.5)'}`,
          }}
        >
          {heatmap.name} · {width.toFixed(1)} x {depth.toFixed(1)} ft
        </div>
      </Html>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Sun Probe Marker                                                  */
/* ------------------------------------------------------------------ */

function SunProbeMarker({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.35, 0.5, 24]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.7} />
      </mesh>

      {/* Vertical pin */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.0, 8]} />
        <meshStandardMaterial color="#FFD700" />
      </mesh>

      {/* Pin head */}
      <mesh position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFA000" emissiveIntensity={0.5} />
      </mesh>

      {/* Coordinate label */}
      <Html position={[0, 2.7, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(0,0,0,0.8)',
            color: '#FFD700',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255,215,0,0.5)',
          }}
        >
          ({x.toFixed(1)}, {z.toFixed(1)})
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function lighten(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(2.55 * pct))
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(2.55 * pct))
  const b = Math.min(255, (n & 0xff) + Math.round(2.55 * pct))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
