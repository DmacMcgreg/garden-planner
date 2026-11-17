import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Line, TransformControls, Grid, OrthographicCamera } from '@react-three/drei'
import { DoubleSide, BoxGeometry, Vector3, Vector2, Plane, Raycaster, DataTexture, RGBAFormat, UnsignedByteType, LinearFilter, ClampToEdgeWrapping, TOUCH, type Mesh, type Group, OrthographicCamera as ThreeOrthoCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl, TransformControls as TransformControlsImpl } from 'three-stdlib'
import {
  getSunPosition,
  degreesToCompass,
  type Season,
  type SunPosition,
  type SunLocation,
  type HeatmapGrid,
  type HeatmapMode,
  type HeatmapInstance,
} from './sun'
import { GardenSky, GardenGround, GardenBorder, StructureBody, PlantedBed } from './GardenLandscape'
import { gardenBounds, type GardenView, type YardSize } from './garden'
import type { BedConfig, Structure, MeasurementUnit, LayoutConfig, PanelConfig, PathConfig } from './types'

const DEG2RAD = Math.PI / 180

// Visual sun sphere + sun-arc sit on an imaginary dome of user-configurable
// radius (ft) — controlled via the sunVizRadius prop. The actual directional
// light source is at sun.ts distance=120 for accurate shadow angles; this is
// purely a viewing aid.

interface SceneProps {
  layout?: LayoutConfig
  yardGuides: boolean
  view: GardenView
  yard: YardSize
  labels: boolean
  original: boolean
  landscape: boolean
  showSunPath: boolean
  season: Season
  dayOfYear: number
  hour: number
  yardHeadingDeg: number
  sunLocation: SunLocation
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
  sunVizRadius: number
  resetViewNonce: number
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
      frameloop="demand"
      dpr={[1, 1.6]}
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
  layout, yardGuides, view, yard, labels, original, landscape, showSunPath,
  season,
  dayOfYear,
  hour,
  yardHeadingDeg,
  sunLocation,
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
  sunVizRadius,
  resetViewNonce,
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

  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  const invalidate = useThree(s => s.invalidate)
  const contents = useRef({ beds, structures, heatmaps })
  useLayoutEffect(() => { contents.current = { beds, structures, heatmaps } }, [beds, structures, heatmaps])
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const orbit = controlsRef.current
    const fit = Math.max(yard.width / aspect, yard.depth * 0.8, yard.width * 0.55)
    const target = new Vector3(0, view === 'render' ? 1.65 : 1.35, -0.25)
    const { beds, structures, heatmaps } = contents.current
    const { left, right, back, front, top } = gardenBounds(yard, beds, structures, heatmaps)
    const w = right - left, d = front - back
    // A saved site can extend well beyond the original planting patch.
    const large = w > yard.width + 8 || d > yard.depth + 14 || top > Math.max(14, yard.width * 0.6)
    if (large) target.set((right + left) / 2, view === 'plan' ? 0 : top / 2, (back + front) / 2)
    if (view === 'plan') {
      camera.position.set(target.x, Math.max(100, top + 20), (large ? target.z : 0) + 0.001)
      if (camera instanceof ThreeOrthoCamera) {
        camera.zoom = Math.min(size.width / ((large ? w : yard.width) + 6), size.height / ((large ? d : yard.depth) + 6))
        camera.updateProjectionMatrix()
      }
    }
    else if (large) {
      // Look from the planting side of the tallest building.
      const tallest = structures.filter(s => s.type === 'building').sort((a, b) => b.size[1] - a.size[1])[0]
      const side = tallest && tallest.position[0] > target.x ? -1 : 1
      const direction = new Vector3(side, view === 'render' ? 0.58 : 1.3, 0.65).normalize()
      const horizontal = new Vector3().crossVectors(camera.up, direction).normalize()
      const vertical = new Vector3().crossVectors(direction, horizontal)
      const tanV = Math.tan(45 * DEG2RAD / 2)
      let distance = 0
      for (const x of [left, right]) for (const z of [back, front]) for (const y of [0, top]) {
        const corner = new Vector3(x, y, z).sub(target)
        const clearance = Math.max(Math.abs(corner.dot(horizontal)) / aspect, Math.abs(corner.dot(vertical))) / tanV
        distance = Math.max(distance, corner.dot(direction) + clearance * 1.1)
      }
      camera.position.copy(target).addScaledVector(direction, distance)
    }
    else if (view === 'render') camera.position.set(-fit * 0.18, 3.8 + fit * 0.16, yard.depth / 2 + fit * 1.12)
    else camera.position.set(fit * 0.42, fit * 0.93, fit * 1.21)
    camera.lookAt(target)
    if (orbit) { orbit.target.copy(target); orbit.update() }
    invalidate()
  }, [camera, size.width, size.height, view, yard.width, yard.depth, resetViewNonce, invalidate])

  // F2: Sun with dynamic heading
  const sun = useMemo(
    () => getSunPosition(dayOfYear, hour, yardHeadingDeg, sunLocation),
    [dayOfYear, hour, yardHeadingDeg, sunLocation],
  )

  const sunPathPoints = useMemo(() => {
    const doy = dayOfYear
    const pts: [number, number, number][] = []
    for (let h = 0; h <= 24; h += 0.25) {
      const s = getSunPosition(doy, h, yardHeadingDeg, sunLocation)
      if (s.altitudeDeg > 0) {
        const norm = Math.sqrt(s.sceneX * s.sceneX + s.sceneY * s.sceneY + s.sceneZ * s.sceneZ) || 1
        const k = sunVizRadius / norm
        pts.push([s.sceneX * k, s.sceneY * k, s.sceneZ * k])
      }
    }
    return pts
  }, [season, yardHeadingDeg, sunVizRadius, sunLocation, dayOfYear])



  const selectedStructure = structures.find((s) => s.id === selectedId)
  const selectedBed = beds.find((b) => b.id === selectedBedId)

  return (
    <>
      <GardenSky brightness={sun.isAboveHorizon ? 0.55 + sun.intensity * 0.32 : 0.035} />
      {view === 'plan' && <OrthographicCamera makeDefault position={[0, 100, 0.001]} near={0.1} far={500} zoom={Math.min(size.width / (yard.width + 6), size.height / (yard.depth + 6))} />}

      {/* Lighting */}
      <ambientLight intensity={sun.isAboveHorizon ? 0.48 : 0.12} />
      <hemisphereLight
        args={['#e7efff', '#a8a17b', sun.isAboveHorizon ? 1.08 : 0.15]}
      />

      {sun.isAboveHorizon && (
        <directionalLight
          position={[sun.sceneX, sun.sceneY, sun.sceneZ]}
          intensity={sun.intensity * 1.65}
          color={sun.altitudeDeg < 15 ? "#ffd19c" : "#fff1d8"}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={300}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-bias={-0.00024}
          shadow-normalBias={0.018}
        />
      )}

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={view === 'orbit'}
        enablePan={view !== 'render'}
        enableZoom={view !== 'render'}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={8}
        maxDistance={Math.max(250, yard.width * 4, yard.depth * 4)}
        enableDamping
        touches={{ ONE: TOUCH.PAN, TWO: view === 'orbit' ? TOUCH.DOLLY_ROTATE : TOUCH.DOLLY_PAN }}
      />

      {/* ---- Environment ---- */}

      <GardenGround yard={yard} planted={!original} onProbe={sunProbeActive ? onSunProbePlace : undefined} />
      {landscape && <GardenBorder yard={yard} />}

      {yardGuides && (
        <group>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.024, yard.depth]} receiveShadow>
            <planeGeometry args={[yard.width, yard.depth]} />
            <meshStandardMaterial color="#7e9866" transparent opacity={0.5} />
          </mesh>
          <Line points={[[-yard.width / 2, 0.055, yard.depth / 2], [yard.width / 2, 0.055, yard.depth / 2]]}
            color="#f7cc67" lineWidth={2} dashed dashSize={1} gapSize={0.5} />
        </group>
      )}
      {!original && layout?.paths.map((path, i) => <WalkingPath key={i} path={path} opacity={gardenItemsOpacity} />)}
      {!original && layout?.panels.map((panel, i) => <SolarPanel key={i} panel={panel} opacity={gardenItemsOpacity} />)}

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
        s.id === selectedId && !sunProbeActive ? null : (
          <StructureMesh
            key={s.id}
            structure={s}
            onSelect={() => onSelectStructure(s.id)}
            probing={sunProbeActive}
          />
        ),
      )}

      {selectedStructure && !sunProbeActive && (
        <SelectedStructureGizmo
          key={selectedStructure.id}
          structure={selectedStructure}
          onMove={onStructureMove}
        />
      )}

      {/* ---- Garden elements ---- */}
      {!original && beds.map((bed) =>
        bed.id === selectedBedId && !sunProbeActive ? null : (
          <group key={bed.id} position={[bed.x, 0, bed.z]} rotation={[0, (bed.rotation ?? 0) * DEG2RAD, 0]}>
            <GardenBed bed={bed} isSelected={false} onSelect={() => onSelectBed(bed.id)} opacity={gardenItemsOpacity} probing={sunProbeActive} label={labels ? bed.name : undefined} />
          </group>
        ),
      )}
      {!original && selectedBed && !sunProbeActive && (
        <SelectedBedGizmo
          key={selectedBed.id}
          bed={selectedBed}
          labels={labels}
          orbitControlsRef={controlsRef}
          onMove={onBedMove}
          onUpdate={onBedUpdate}
          opacity={gardenItemsOpacity}
        />
      )}

      {/* ---- Measurement labels ---- */}
      {!original && showMeasurements && (
        <MeasurementLabels beds={beds} paths={layout?.paths ?? []} panels={layout?.panels ?? []} unit={measurementUnit} />
      )}

      {/* ---- Sun probe marker ---- */}
      {sunProbePosition && (
        <SunProbeMarker x={sunProbePosition.x} z={sunProbePosition.z} />
      )}

      {/* ---- Sun visualization ---- */}
      {showSunPath && sun.isAboveHorizon && <SunSphere sun={sun} sunVizRadius={sunVizRadius} />}
      {showSunPath && sunPathPoints.length > 2 && (
        <Line points={sunPathPoints} color="#FFA000" lineWidth={1.5} />
      )}

      {/* ---- F2: Dynamic direction labels ---- */}
      {(yardGuides || showGrid) && <DirectionLabels yardHeadingDeg={yardHeadingDeg} yard={yard} />}
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
    <group position={structure.position} onClick={e => {
      if (probing || e.delta > 4) return
      e.stopPropagation()
      onSelect()
    }}>
      <StructureBody structure={structure} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  F3: Selected structure with TransformControls gizmo               */
/* ------------------------------------------------------------------ */

function SelectedStructureGizmo({
  structure,
  onMove,
}: {
  structure: Structure
  onMove: (id: string, position: [number, number, number]) => void
}) {
  const controls = useRef<TransformControlsImpl>(null)
  const object = useRef<Group>(null!)
  const canvas = useThree(state => state.gl.domElement)
  const camera = useThree(state => state.camera)
  useEffect(() => {
    const active = controls.current
    if (!active) return
    active.connect(canvas)
    return () => active.dispose()
  }, [camera, canvas])

  const edgesGeo = useMemo(
    () => new BoxGeometry(...structure.size),
    [structure.size[0], structure.size[1], structure.size[2]],
  )

  return (
    <>
      <group ref={object} position={structure.position}>
        <group onClick={e => e.stopPropagation()}><StructureBody structure={structure} /></group>
        <lineSegments>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial color="#00ff88" />
        </lineSegments>
      </group>
      <TransformControls ref={controls} object={object} domElement={canvas} mode="translate" translationSnap={0.5}
        onMouseUp={() => {
          const point = object.current?.position
          if (point) onMove(structure.id, [point.x, point.y, point.z])
        }}
      />
    </>
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
  bed, labels,
  orbitControlsRef,
  onMove,
  onUpdate,
  opacity,
}: {
  bed: BedConfig
  labels: boolean
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
  const frameH = 0.88

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
    // Use the same ground plane on press and move so tall plants do not offset the drag.
    const point = groundPoint(e.nativeEvent) ?? new Vector3(e.point.x, 0, e.point.z)
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
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      if (dragRef.current && orbitControlsRef.current) orbitControlsRef.current.enabled = true
      dragRef.current = null
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
        <GardenBed bed={displayBed} label={labels ? displayBed.name : undefined} isSelected onSelect={() => {}} opacity={opacity} probing={false} />
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

function GardenBed({ bed, isSelected, onSelect, opacity, probing, label }: {
  bed: BedConfig; isSelected: boolean; onSelect: () => void; opacity: number; probing: boolean; label?: string
}) {
  return <group onClick={e => {
    if (probing || e.delta > 4) return
    e.stopPropagation()
    onSelect()
  }}>
    <PlantedBed bed={bed} opacity={opacity} selected={isSelected} label={label} />
  </group>
}

/* ------------------------------------------------------------------ */
function WalkingPath({ path, opacity }: { path: PathConfig; opacity: number }) {
  const faded = opacity < 1
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[path.x, 0.005, path.z]}
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
    <group position={[panel.x, 0, panel.z]} rotation-y={panel.facingAngle - Math.PI}>
      <group rotation={[0, 0, -tiltRad]}>
        <mesh position={[0, panel.heightFt / 2, 0]}>
          <boxGeometry
            args={[0.1, panel.heightFt + 0.08, panel.widthFt + 0.08]}
          />
          <meshStandardMaterial key={matKey + 'f'} color="#37474f" transparent={faded} opacity={opacity} depthWrite={!faded} />
        </mesh>
        <mesh position={[0, panel.heightFt / 2, 0]} castShadow={!faded} receiveShadow>
          <boxGeometry args={[0.11, panel.heightFt, panel.widthFt]} />
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

function SunSphere({ sun, sunVizRadius }: { sun: SunPosition; sunVizRadius: number }) {
  const meshRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const { camera } = useThree()

  // Project the light direction onto the configured dome radius so the sphere
  // is always visible — decoupled from the far-away light source.
  const norm =
    Math.sqrt(sun.sceneX * sun.sceneX + sun.sceneY * sun.sceneY + sun.sceneZ * sun.sceneZ) || 1
  const k = sunVizRadius / norm
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

function DirectionLabels({ yardHeadingDeg, yard }: { yardHeadingDeg: number; yard: YardSize }) {
  const labels = useMemo(() => {
    const plusX = degreesToCompass(yardHeadingDeg)
    const minusX = degreesToCompass((yardHeadingDeg + 180) % 360)
    const minusZ = degreesToCompass((yardHeadingDeg + 270) % 360)
    const plusZ = degreesToCompass((yardHeadingDeg + 90) % 360)
    const color = '#c5e1a5'
    return [
      { text: plusX, pos: [yard.width / 2 + 2, 2, 0] as [number, number, number], color },
      { text: minusX, pos: [-yard.width / 2 - 2, 2, 0] as [number, number, number], color },
      { text: minusZ, pos: [0, 2, -yard.depth / 2 - 2] as [number, number, number], color },
      { text: plusZ, pos: [0, 2, yard.depth / 2 + 2] as [number, number, number], color },
    ]
  }, [yardHeadingDeg, yard])

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

  // Dispose of the previous GPU texture whenever a new one is created.
  // Without this, every grid/mode change leaks a DataTexture's worth of GPU
  // memory — noticeable after scrubbing the day slider for a while.
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

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
    const point = groundPoint(e.nativeEvent) ?? new Vector3(e.point.x, 0, e.point.z)
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
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      if (dragRef.current && orbitControlsRef.current) orbitControlsRef.current.enabled = true
      dragRef.current = null
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
