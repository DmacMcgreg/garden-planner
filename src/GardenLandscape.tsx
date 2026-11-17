import { useLayoutEffect, useMemo, useRef, useEffect } from 'react'
import { useTexture, useGLTF, Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import {
  Box3,
  BoxGeometry,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { Texture } from 'three'
import type { BedConfig, Structure } from './types'
import { PLANT_PRESETS } from './types'
import { createCrop } from './cropGeometry'
import type { YardSize } from './garden'

function tiled(source: Texture, x: number, y: number, angle = 0) {
  const t = source.clone()
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(x, y)
  t.rotation = angle
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

function useTile(name: string, x: number, y: number, angle = 0) {
  const source = useTexture('/garden/' + name + '.webp')
  const map = useMemo(() => tiled(source, x, y, angle), [source, x, y, angle])
  useEffect(() => () => map.dispose(), [map])
  return map
}

export function GardenSky({ brightness }: { brightness: number }) {
  const { scene } = useThree()
  const sky = useTexture('/garden/horizon.webp')
  useLayoutEffect(() => {
    sky.colorSpace = SRGBColorSpace
    sky.mapping = EquirectangularReflectionMapping
    scene.background = sky
    scene.backgroundRotation.y = 1.8
    return () => {
      scene.background = null
    }
  }, [scene, sky])
  useLayoutEffect(() => {
    scene.backgroundIntensity = brightness
  }, [scene, brightness])
  return null
}

export function GardenGround({
  yard,
  planted,
  onProbe,
}: {
  yard: YardSize
  planted: boolean
  onProbe?: (x: number, z: number) => void
}) {
  const grass = useTile('grass', 24, 24)
  const gravel = useTile('gravel', yard.width / 3.5, yard.depth / 3.5)
  return (
    <group
      onClick={
        onProbe
          ? (e) => {
              e.stopPropagation()
              onProbe(Math.round(e.point.x * 2) / 2, Math.round(e.point.z * 2) / 2)
            }
          : undefined
      }
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position-y={-0.032} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial map={grass} color="#95ae68" roughness={1} />
      </mesh>
      {planted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position-y={-0.016} receiveShadow>
          <planeGeometry args={[yard.width, yard.depth]} />
          <meshStandardMaterial map={gravel} roughness={1} />
        </mesh>
      )}
    </group>
  )
}

// Give each board face UVs in feet so resizing a bed or fence preserves the grain.
function useTimberBox(w: number, h: number, d: number, vertical: boolean) {
  const geometry = useMemo(() => {
    const g = new BoxGeometry(w, h, d)
    const { position: p, normal: n, uv } = g.attributes
    for (let i = 0; i < uv.count; i++) {
      const along = Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)
      const across = Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) : p.getY(i)
      uv.setXY(i, (vertical ? along : across) / 6, (vertical ? across : along) / 6)
    }
    return g
  }, [w, h, d, vertical])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Timber({
  size: [w, h, d],
  at,
  color = '#e0ae7c',
  upright = false,
  opacity = 1,
  casts = true,
  receives = true,
}: {
  size: [number, number, number]
  at: [number, number, number]
  color?: string
  upright?: boolean
  opacity?: number
  casts?: boolean
  receives?: boolean
}) {
  const geometry = useTimberBox(w, h, d, upright)
  const map = useTexture('/garden/wood.webp')
  useMemo(() => {
    map.colorSpace = SRGBColorSpace
    map.wrapS = map.wrapT = RepeatWrapping
    map.anisotropy = 4
    map.needsUpdate = true
  }, [map])
  return (
    <mesh geometry={geometry} position={at} castShadow={casts && opacity >= 1} receiveShadow={receives}>
      <meshStandardMaterial
        map={map}
        color={color}
        roughness={0.88}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </mesh>
  )
}

function GardenTree({ structure }: { structure: Structure }) {
  const { scene } = useGLTF('/garden/tree.glb')
  const model = useMemo(() => {
    const object = scene.clone(true)
    const bounds = new Box3().setFromObject(object)
    const span = bounds.getSize(new Vector3()),
      center = bounds.getCenter(new Vector3())
    object.scale.set(1 / span.x, 1 / span.y, 1 / span.z)
    object.position.copy(center.multiply(object.scale).negate())
    return object
  }, [scene])
  useLayoutEffect(() => {
    model.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = structure.castShadow
        o.receiveShadow = structure.receiveShadow
      }
    })
  }, [model, structure.castShadow, structure.receiveShadow])
  return (
    <group scale={structure.size}>
      <primitive object={model} />
    </group>
  )
}

export function StructureBody({ structure: s }: { structure: Structure }) {
  const [w, h, d] = s.size
  if (s.type === 'tree') return <GardenTree structure={s} />
  if (s.type !== 'fence')
    return (
      <mesh castShadow={s.castShadow} receiveShadow={s.receiveShadow}>
        <boxGeometry args={s.size} />
        <meshStandardMaterial color={s.color} roughness={0.96} />
      </mesh>
    )
  const horizontal = w >= d,
    length = horizontal ? w : d,
    thick = horizontal ? d : w
  const postCount = Math.min(80, Math.max(2, Math.ceil(length / 5) + 1))
  return (
    <group rotation-y={horizontal ? 0 : Math.PI / 2}>
      <Timber
        size={[length, h, thick]}
        at={[0, 0, 0]}
        color={s.color}
        upright
        casts={s.castShadow}
        receives={s.receiveShadow}
      />
      {[-0.32, 0.32].map((y) => (
        <Timber
          key={y}
          size={[length, Math.min(0.2, h / 8), thick + 0.12]}
          at={[0, h * y, 0]}
          color={s.color}
          casts={s.castShadow}
          receives={s.receiveShadow}
        />
      ))}
      {Array.from({ length: postCount }, (_, i) => (
        <Timber
          key={i}
          size={[0.25, h, thick + 0.17]}
          at={[(i / (postCount - 1) - 0.5) * Math.max(0, length - 0.25), 0, 0]}
          upright
          color={s.color}
          casts={s.castShadow}
          receives={s.receiveShadow}
        />
      ))}
    </group>
  )
}

interface CropInstances {
  bed: BedConfig
  opacity: number
  variant: number
  plants: Matrix4[]
}

function CropGroup({ bed, opacity, variant, plants }: CropInstances) {
  const mesh = useRef<InstancedMesh>(null)
  const type = bed.plantType ?? 'herbs'
  const geometry = useMemo(() => createCrop(type, variant), [type, variant])
  useEffect(() => () => geometry.dispose(), [geometry])
  const detail = useTexture('/garden/leaf.webp')
  useLayoutEffect(() => {
    plants.forEach((matrix, i) => {
      mesh.current!.setMatrixAt(i, matrix)
      const tint = Math.sin(i * 4.7) * 0.065
      mesh.current!.setColorAt(i, new Color(0.95 + tint, 0.96 + tint, 0.89 + tint))
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [plants])
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, plants.length]}
      castShadow={opacity >= 1}
      receiveShadow
    >
      <meshStandardMaterial
        map={detail}
        vertexColors
        side={DoubleSide}
        roughness={0.83}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </instancedMesh>
  )
}

function CropRow({ bed, opacity }: { bed: BedConfig; opacity: number }) {
  const type = bed.plantType ?? 'herbs'
  const groups = useMemo(() => {
    const spacing = PLANT_PRESETS[type].spacingInches / 12
    // Keep field-size imports interactive while preserving the bed footprint.
    const cols = Math.min(24, Math.max(1, Math.floor(bed.width / spacing)))
    const rows = Math.min(Math.floor(128 / cols), Math.max(1, Math.floor(bed.depth / spacing)))
    const rootCrop = PLANT_PRESETS[type].category === 'root-vegetables'
    const variants: Matrix4[][] = [[], [], []],
      obj = new Object3D()
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const i = r * cols + c,
          variation = Math.sin(i * 43.37 + 3.7)
        obj.position.set(
          ((c + 0.5) / cols - 0.5) * (bed.width - 0.25),
          0.79,
          ((r + 0.5) / rows - 0.5) * (bed.depth - 0.25),
        )
        obj.rotation.y = i * 2.399 + variation * 0.35
        const scale =
          (1 + variation * 0.15) *
          Math.min(
            1,
            (bed.width - 0.1) / cols / (rootCrop ? 0.42 : 0.76),
            (bed.depth - 0.1) / rows / (rootCrop ? 0.42 : 0.76),
          )
        obj.scale.setScalar(Math.max(0.12, scale))
        obj.updateMatrix()
        const variant = type === 'lettuce' ? r % 3 : type === 'herbs' ? Math.floor((c * 3) / cols) : 0
        variants[variant].push(obj.matrix.clone())
      }
    return variants
  }, [type, bed.width, bed.depth])
  return (
    <>
      {groups.map(
        (plants, variant) =>
          plants.length > 0 && (
            <CropGroup key={variant} bed={bed} opacity={opacity} variant={variant} plants={plants} />
          ),
      )}
    </>
  )
}

export function PlantedBed({
  bed,
  opacity,
  selected,
  label,
}: {
  bed: BedConfig
  opacity: number
  selected: boolean
  label?: string
}) {
  const { width: w, depth: d } = bed
  const soil = useTile('soil', w / 2, d / 2)
  const trellis = bed.trellisHeight ?? 5
  return (
    <>
      <mesh position-y={0.39} receiveShadow>
        <boxGeometry args={[Math.max(0.1, w - 0.15), 0.78, Math.max(0.1, d - 0.15)]} />
        <meshStandardMaterial
          map={soil}
          color="#b29a80"
          roughness={1}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 1}
        />
      </mesh>
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <Timber size={[w, 0.88, 0.11]} at={[0, 0.44, sign * (d / 2 - 0.055)]} opacity={opacity} />
          <Timber
            size={[0.11, 0.88, Math.max(0.1, d - 0.22)]}
            at={[sign * (w / 2 - 0.055), 0.44, 0]}
            opacity={opacity}
          />
          {[-1, 1].map((side) => (
            <Timber
              key={side}
              size={[0.16, 0.91, 0.16]}
              at={[sign * (w / 2 - 0.18), 0.455, side * (d / 2 - 0.18)]}
              upright
              opacity={opacity}
            />
          ))}
        </group>
      ))}
      <mesh position={[0, 0.49, d / 2 + 0.006]}>
        <boxGeometry args={[Math.min(w * 0.6, 1.2), 0.18, 0.035]} />
        <meshStandardMaterial
          color={bed.color}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 1}
        />
      </mesh>
      {bed.plantType ? (
        <CropRow bed={bed} opacity={opacity} />
      ) : (
        <mesh position-y={0.79} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[Math.max(0.1, w - 0.24), Math.max(0.1, d - 0.24)]} />
          <meshStandardMaterial color={bed.color} transparent opacity={0.6 * opacity} depthWrite={false} />
        </mesh>
      )}
      {bed.hasTrellis && (
        <group position-z={-d / 2 + 0.18}>
          {[-1, 0, 1].map((s) => (
            <Timber
              key={s}
              size={[0.11, trellis, 0.11]}
              at={[s * (w / 2 - 0.18), trellis / 2, 0]}
              upright
              opacity={opacity}
            />
          ))}
          <Timber size={[w - 0.16, 0.12, 0.12]} at={[0, trellis, 0]} opacity={opacity} />
          {Array.from({ length: Math.min(60, Math.max(1, Math.ceil(w / 0.75))) }, (_, i) => (
            <mesh key={i} position={[-w / 2 + 0.34 + i * 0.75, (trellis + 0.78) / 2, 0]}>
              <cylinderGeometry args={[0.013, 0.013, Math.max(0.1, trellis - 0.78), 4]} />
              <meshStandardMaterial color="#a08a62" transparent={opacity < 1} opacity={opacity} />
            </mesh>
          ))}
        </group>
      )}
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
          <planeGeometry args={[w + 0.22, d + 0.22]} />
          <meshBasicMaterial color="#d6ee9f" />
        </mesh>
      )}
      {label && (
        <Html
          center
          zIndexRange={[4, 1]}
          position={[0, bed.hasTrellis ? trellis + 0.55 : bed.plantType === 'peppers' ? 3.0 : 1.9, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="bed-pin-group">
            <span className="bed-pin">
              <i style={{ backgroundColor: bed.color }} />
              {label}
            </span>
            {selected && bed.plantType && (
              <small>
                {bed.sunNeeds === 'full'
                  ? 'Full sun'
                  : bed.sunNeeds === 'partial'
                    ? 'Partial sun'
                    : 'Shade tolerant'}{' '}
                · pH {PLANT_PRESETS[bed.plantType].phRange.join('–')} ·{' '}
                {PLANT_PRESETS[bed.plantType].minSunHours}+ PSH
              </small>
            )}
          </span>
        </Html>
      )}
    </>
  )
}

function BorderPlants({ yard, name, offset }: { yard: YardSize; name: string; offset: number }) {
  const { scene } = useGLTF('/garden/' + name + '.glb')
  const sample = useMemo(() => {
    let mesh!: Mesh
    scene.traverse((o) => {
      if (o instanceof Mesh) mesh = o
    })
    return mesh
  }, [scene])
  const transforms = useMemo(() => {
    sample.geometry.computeBoundingBox()
    const bounds = sample.geometry.boundingBox!,
      height = Math.max(0.01, bounds.max.y - bounds.min.y)
    const list: Matrix4[] = [],
      obj = new Object3D()
    function add(x: number, z: number) {
      const i = list.length
      const scale = (1.02 + Math.sin(i * 3.5 + offset) * 0.28) / height
      obj.scale.setScalar(scale)
      obj.rotation.y = i * 2.4
      obj.position.set(x, -bounds.min.y * scale, z)
      obj.updateMatrix()
      list.push(obj.matrix.clone())
    }
    for (let x = -yard.width / 2 - 0.7 + offset; x < yard.width / 2 + 1; x += 2.65)
      add(x, -yard.depth / 2 - 1.22)
    for (const side of [-1, 1])
      for (let z = -yard.depth / 2 + offset; z < yard.depth / 2 + 0.5; z += 2.7)
        add(side * (yard.width / 2 + 1.22), z)
    return list
  }, [sample, yard, offset])
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    transforms.forEach((m, i) => ref.current!.setMatrixAt(i, m))
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.computeBoundingSphere()
  }, [transforms])
  return (
    <instancedMesh ref={ref} args={[sample.geometry, sample.material, transforms.length]} receiveShadow />
  )
}

export function GardenBorder({ yard }: { yard: YardSize }) {
  const dirt = useTile('soil', 4, 1)
  return (
    <group>
      {[-1, 1].map((dir) => (
        <mesh
          key={dir}
          position={[dir * (yard.width / 2 + 1.22), -0.016, 0]}
          rotation-x={-Math.PI / 2}
          receiveShadow
        >
          <planeGeometry args={[1.36, yard.depth + 3.4]} />
          <meshStandardMaterial map={dirt} color="#745841" />
        </mesh>
      ))}
      <mesh position={[0, -0.017, -yard.depth / 2 - 1.25]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[yard.width + 2, 1.35]} />
        <meshStandardMaterial map={dirt} color="#745841" />
      </mesh>
      <BorderPlants yard={yard} name="fern_02" offset={0} />
      <BorderPlants yard={yard} name="shrub_02" offset={1.3} />
    </group>
  )
}
