import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei/native'
import {
  DoubleSide,
  BoxGeometry,
  DataTexture,
  RGBAFormat,
  UnsignedByteType,
  LinearFilter,
  ClampToEdgeWrapping,
  type Mesh,
  type Group,
} from 'three'
import {
  getSunPosition,
  type Season,
  type SunPosition,
  type SunLocation,
  type HeatmapGrid,
  type HeatmapMode,
  type HeatmapInstance,
} from '../sun'
import { PLANT_PRESETS } from '../types'
import type { BedConfig, Structure } from '../types'
import type { SceneBridge } from './sceneBridge'

const DEG2RAD = Math.PI / 180

export interface SceneContentProps {
  season: Season
  dayOfYear: number
  hour: number
  yardHeadingDeg: number
  sunLocation: SunLocation
  structures: Structure[]
  selectedId: string | null
  beds: BedConfig[]
  selectedBedId: string | null
  heatmaps: HeatmapInstance[]
  heatmapGrids: Record<string, HeatmapGrid>
  selectedHeatmapId: string | null
  gardenItemsOpacity: number
  sunVizRadius: number
  showGrid: boolean
  gridSpacing: number
  gridCenterX: number
  gridCenterZ: number
  gridWidth: number
  gridDepth: number
  sunProbePosition: { x: number; z: number } | null
  bridge: SceneBridge
  livePatchBedId: string | null
  livePatch: Partial<BedConfig> | null
  livePatchStructureId: string | null
  livePatchStructurePos: [number, number, number] | null
}

/* Captures camera/scene into the bridge and drives the orbit camera. */
function CameraRig({ bridge }: { bridge: SceneBridge }) {
  const { camera, scene } = useThree()

  useEffect(() => {
    bridge.camera = camera
    bridge.scene = scene
  }, [camera, scene, bridge])

  useFrame(() => {
    const { azimuth, polar, distance, target } = bridge.cam
    const sp = Math.sin(polar)
    camera.position.set(
      target.x + distance * sp * Math.sin(azimuth),
      target.y + distance * Math.cos(polar),
      target.z + distance * sp * Math.cos(azimuth),
    )
    camera.lookAt(target)
  })
  return null
}

export default function SceneContent(props: SceneContentProps) {
  const {
    dayOfYear,
    hour,
    yardHeadingDeg,
    sunLocation,
    structures,
    selectedId,
    beds,
    selectedBedId,
    heatmaps,
    heatmapGrids,
    gardenItemsOpacity,
    sunVizRadius,
    showGrid,
    gridSpacing,
    gridCenterX,
    gridCenterZ,
    gridWidth,
    gridDepth,
    sunProbePosition,
    bridge,
    livePatchBedId,
    livePatch,
    livePatchStructureId,
    livePatchStructurePos,
  } = props

  const sun = useMemo(
    () => getSunPosition(dayOfYear, hour, yardHeadingDeg, sunLocation),
    [dayOfYear, hour, yardHeadingDeg, sunLocation],
  )

  const sunPathPoints = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let h = 4; h <= 22; h += 0.25) {
      const s = getSunPosition(dayOfYear, h, yardHeadingDeg, sunLocation)
      if (s.altitudeDeg > 0) {
        const norm =
          Math.sqrt(s.sceneX * s.sceneX + s.sceneY * s.sceneY + s.sceneZ * s.sceneZ) || 1
        const k = sunVizRadius / norm
        pts.push([s.sceneX * k, s.sceneY * k, s.sceneZ * k])
      }
    }
    return pts
  }, [yardHeadingDeg, sunVizRadius, sunLocation, dayOfYear])

  const skyColor = sun.isAboveHorizon ? '#b3d9f2' : '#111827'

  return (
    <>
      <CameraRig bridge={bridge} />
      <color attach="background" args={[skyColor]} />

      <ambientLight intensity={sun.isAboveHorizon ? 0.45 : 0.1} />
      <hemisphereLight
        args={['#87CEEB', '#3a5a1c', sun.isAboveHorizon ? 0.3 : 0.04]}
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

      {/* Ground (extends beyond yard) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#4a7c4a" />
      </mesh>

      {/* Yard area (24x10) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[24, 10]} />
        <meshStandardMaterial color="#5a8a50" />
      </mesh>

      {/* Shared space beyond yard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 10]} receiveShadow>
        <planeGeometry args={[24, 10]} />
        <meshStandardMaterial color="#4e8248" />
      </mesh>

      {/* Property boundary line */}
      <Line
        points={[
          [-12, 0.05, 5],
          [12, 0.05, 5],
        ]}
        color="#FFD700"
        lineWidth={2}
        dashed
        dashSize={1}
        gapSize={0.5}
      />

      {showGrid && (
        <GroundGrid
          spacing={gridSpacing}
          centerX={gridCenterX}
          centerZ={gridCenterZ}
          width={gridWidth}
          depth={gridDepth}
        />
      )}

      {/* Heatmap overlays */}
      {heatmaps.map((h, i) => {
        const grid = heatmapGrids[h.id]
        return h.visible && grid ? (
          <SunHeatmapOverlay
            key={h.id}
            grid={grid}
            mode={h.mode}
            opacity={h.opacity}
            yOffset={0.04 + i * 0.002}
          />
        ) : null
      })}
      {heatmaps.map((h) => (
        <HeatmapOutline
          key={`o-${h.id}`}
          heatmap={h}
          selected={h.id === props.selectedHeatmapId}
        />
      ))}

      {/* Structures */}
      {structures.map((s) => {
        const ds =
          livePatchStructureId === s.id && livePatchStructurePos
            ? { ...s, position: livePatchStructurePos }
            : s
        return <StructureMesh key={s.id} structure={ds} selected={s.id === selectedId} />
      })}

      {/* Beds */}
      {beds.map((bed) => {
        const display =
          livePatchBedId === bed.id && livePatch ? { ...bed, ...livePatch } : bed
        return (
          <group
            key={bed.id}
            position={[display.x, 0, display.z]}
            rotation={[0, (display.rotation ?? 0) * DEG2RAD, 0]}
          >
            <GardenBed
              bed={display}
              isSelected={bed.id === selectedBedId}
              opacity={gardenItemsOpacity}
            />
          </group>
        )
      })}

      {sunProbePosition && (
        <SunProbeMarker x={sunProbePosition.x} z={sunProbePosition.z} />
      )}

      {sun.isAboveHorizon && <SunSphere sun={sun} sunVizRadius={sunVizRadius} />}
      {sunPathPoints.length > 2 && (
        <Line points={sunPathPoints} color="#FFA000" lineWidth={1.5} />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Ground grid (simple line segments)                                */
/* ------------------------------------------------------------------ */

function GroundGrid({
  spacing,
  centerX,
  centerZ,
  width,
  depth,
}: {
  spacing: number
  centerX: number
  centerZ: number
  width: number
  depth: number
}) {
  const minor: [number, number, number][][] = []
  const major: [number, number, number][][] = []
  const halfW = width / 2
  const halfD = depth / 2
  const x0 = centerX - halfW
  const x1 = centerX + halfW
  const z0 = centerZ - halfD
  const z1 = centerZ + halfD
  const major5 = spacing * 5
  for (let x = 0; x <= halfW + 1e-6; x += spacing) {
    for (const sx of x === 0 ? [centerX] : [centerX - x, centerX + x]) {
      const seg: [number, number, number][] = [
        [sx, 0.016, z0],
        [sx, 0.016, z1],
      ]
      ;(Math.abs((sx - centerX) % major5) < 1e-6 ? major : minor).push(seg)
    }
  }
  for (let z = 0; z <= halfD + 1e-6; z += spacing) {
    for (const sz of z === 0 ? [centerZ] : [centerZ - z, centerZ + z]) {
      const seg: [number, number, number][] = [
        [x0, 0.016, sz],
        [x1, 0.016, sz],
      ]
      ;(Math.abs((sz - centerZ) % major5) < 1e-6 ? major : minor).push(seg)
    }
  }
  return (
    <group>
      {minor.map((p, i) => (
        <Line key={`mi${i}`} points={p} color="#7a8a7a" lineWidth={0.8} />
      ))}
      {major.map((p, i) => (
        <Line key={`ma${i}`} points={p} color="#c8e0c8" lineWidth={1.4} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Structure                                                         */
/* ------------------------------------------------------------------ */

function StructureMesh({
  structure,
  selected,
}: {
  structure: Structure
  selected: boolean
}) {
  const edgesGeo = useMemo(
    () => new BoxGeometry(...structure.size),
    [structure.size[0], structure.size[1], structure.size[2]],
  )
  return (
    <group
      position={structure.position}
      userData={{ pickId: structure.id, pickKind: 'structure' }}
    >
      <mesh castShadow={structure.castShadow} receiveShadow={structure.receiveShadow}>
        <boxGeometry args={structure.size} />
        <meshStandardMaterial color={structure.color} />
      </mesh>
      {selected && (
        <lineSegments>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial color="#00ff88" />
        </lineSegments>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Garden bed                                                        */
/* ------------------------------------------------------------------ */

function GardenBed({
  bed,
  isSelected,
  opacity,
}: {
  bed: BedConfig
  isSelected: boolean
  opacity: number
}) {
  const frameH = 0.5
  const frameW = bed.width + 0.12
  const frameD = bed.depth + 0.12
  const faded = opacity < 1
  const matKey = faded ? 't' : 'o'
  const edgesGeo = useMemo(
    () => new BoxGeometry(frameW, frameH, frameD),
    [frameW, frameD],
  )
  return (
    <group userData={{ pickId: bed.id, pickKind: 'bed' }}>
      <mesh position={[0, frameH / 2, 0]} castShadow={!faded} receiveShadow>
        <boxGeometry args={[frameW, frameH, frameD]} />
        <meshStandardMaterial
          key={matKey + 'f'}
          color="#6d4c2a"
          transparent={faded}
          opacity={opacity}
          depthWrite={!faded}
        />
      </mesh>
      {isSelected && (
        <lineSegments position={[0, frameH / 2, 0]}>
          <edgesGeometry args={[edgesGeo]} />
          <lineBasicMaterial color="#00ff88" />
        </lineSegments>
      )}
      <mesh position={[0, frameH - 0.04, 0]} receiveShadow>
        <boxGeometry args={[bed.width - 0.04, 0.08, bed.depth - 0.04]} />
        <meshStandardMaterial
          key={matKey + 's'}
          color="#3e2723"
          transparent={faded}
          opacity={opacity}
          depthWrite={!faded}
        />
      </mesh>
      <mesh position={[0, frameH + 0.01, 0]} receiveShadow castShadow={!faded}>
        <boxGeometry args={[bed.width - 0.1, 0.04, bed.depth - 0.1]} />
        <meshStandardMaterial
          key={matKey + 'p'}
          color={bed.color}
          transparent={faded}
          opacity={opacity}
          depthWrite={!faded}
        />
      </mesh>
      <PlantDots bed={bed} baseY={frameH + 0.06} opacity={opacity} />
      {bed.hasTrellis && (
        <Trellis
          width={bed.width}
          depth={bed.depth}
          height={bed.trellisHeight ?? 6}
          color={bed.color}
          opacity={opacity}
        />
      )}
    </group>
  )
}

function PlantDots({
  bed,
  baseY,
  opacity,
}: {
  bed: BedConfig
  baseY: number
  opacity: number
}) {
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
        pts.push([-bed.width / 2 + c * gx, baseY, -bed.depth / 2 + r * gz])
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
          <meshStandardMaterial
            key={matKey}
            color={col}
            transparent={faded}
            opacity={opacity}
            depthWrite={!faded}
          />
        </mesh>
      ))}
    </>
  )
}

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
    return Array.from({ length: n }, (_, i) => -width / 2 + 0.15 + (i / (n - 1)) * (width - 0.3))
  }, [width])
  return (
    <group position={[0, 0, -depth / 2 - 0.1]}>
      {posts.map((x, i) => (
        <mesh key={i} position={[x, height / 2, 0]} castShadow={!faded}>
          <boxGeometry args={[0.08, height, 0.08]} />
          <meshStandardMaterial
            key={matKey}
            color="#5D4037"
            transparent={faded}
            opacity={opacity}
            depthWrite={!faded}
          />
        </mesh>
      ))}
      {[1, 2, 3, 4].map((n) => {
        const y = (n / 4) * (height - 0.5) + 0.5
        return y <= height ? (
          <mesh key={n} position={[0, y, 0]} castShadow={!faded}>
            <boxGeometry args={[width - 0.1, 0.05, 0.05]} />
            <meshStandardMaterial
              key={matKey}
              color="#795548"
              transparent={faded}
              opacity={opacity}
              depthWrite={!faded}
            />
          </mesh>
        ) : null
      })}
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
/*  Sun sphere                                                        */
/* ------------------------------------------------------------------ */

function SunSphere({
  sun,
  sunVizRadius,
}: {
  sun: SunPosition
  sunVizRadius: number
}) {
  const meshRef = useRef<Mesh>(null)
  const glowRef = useRef<Mesh>(null)
  const { camera } = useThree()
  const norm =
    Math.sqrt(sun.sceneX * sun.sceneX + sun.sceneY * sun.sceneY + sun.sceneZ * sun.sceneZ) || 1
  const k = sunVizRadius / norm
  const pos: [number, number, number] = [sun.sceneX * k, sun.sceneY * k, sun.sceneZ * k]
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
/*  Heatmap overlay                                                   */
/* ------------------------------------------------------------------ */

const HEATMAP_COLORS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 200],
  [0, 200, 220],
  [0, 220, 0],
  [255, 255, 0],
  [255, 0, 0],
]

function sampleGradient(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t))
  const segments = HEATMAP_COLORS.length - 1
  const segment = Math.min(Math.floor(clamped * segments), segments - 1)
  const local = clamped * segments - segment
  const a = HEATMAP_COLORS[segment]
  const b = HEATMAP_COLORS[segment + 1]
  return [
    Math.round(a[0] + (b[0] - a[0]) * local),
    Math.round(a[1] + (b[1] - a[1]) * local),
    Math.round(a[2] + (b[2] - a[2]) * local),
  ]
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
    const { cols, rows } = grid
    let data: Float32Array
    let maxVal: number
    switch (mode) {
      case 'directSunHours':
        data = grid.directSunHours
        maxVal = grid.maxDirectSunHours
        break
      case 'peakSunHours':
        data = grid.peakSunHours
        maxVal = grid.maxPeakSunHours
        break
      case 'peakIntensity':
        data = grid.peakIntensity
        maxVal = grid.maxPeakIntensity
        break
      case 'energyRating':
        data = grid.energyRating
        maxVal = grid.maxEnergyRating
        break
    }
    if (maxVal === 0) maxVal = 1
    const pixels = new Uint8Array(cols * rows * 4)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const srcIdx = row * cols + col
        const dstIdx = ((rows - 1 - row) * cols + col) * 4
        const [r, g, b] = sampleGradient(data[srcIdx] / maxVal)
        pixels[dstIdx] = r
        pixels[dstIdx + 1] = g
        pixels[dstIdx + 2] = b
        pixels[dstIdx + 3] = 200
      }
    }
    const tex = new DataTexture(pixels, cols, rows, RGBAFormat, UnsignedByteType)
    tex.magFilter = LinearFilter
    tex.minFilter = LinearFilter
    tex.wrapS = ClampToEdgeWrapping
    tex.wrapT = ClampToEdgeWrapping
    tex.needsUpdate = true
    return tex
  }, [grid, mode])

  const width = grid.maxX - grid.minX
  const depth = grid.maxZ - grid.minZ
  const centerX = (grid.minX + grid.maxX) / 2
  const centerZ = (grid.minZ + grid.maxZ) / 2
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, yOffset, centerZ]}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function HeatmapOutline({
  heatmap,
  selected,
}: {
  heatmap: HeatmapInstance
  selected: boolean
}) {
  const { centerX, centerZ, width, depth } = heatmap
  const minX = centerX - width / 2
  const maxX = centerX + width / 2
  const minZ = centerZ - depth / 2
  const maxZ = centerZ + depth / 2
  const y = 0.06
  return (
    <group userData={{ pickId: heatmap.id, pickKind: 'heatmap' }}>
      <Line
        points={[
          [minX, y, minZ],
          [maxX, y, minZ],
          [maxX, y, maxZ],
          [minX, y, maxZ],
          [minX, y, minZ],
        ]}
        color={selected ? '#fbbf24' : '#38bdf8'}
        lineWidth={selected ? 2.5 : 1.5}
        dashed
        dashSize={0.6}
        gapSize={0.3}
      />
      {/* invisible pick plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.03, centerZ]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Sun probe marker                                                  */
/* ------------------------------------------------------------------ */

function SunProbeMarker({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.35, 0.5, 24]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.7} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 2.0, 8]} />
        <meshStandardMaterial color="#FFD700" />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFA000" emissiveIntensity={0.5} />
      </mesh>
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

export type { Group }
