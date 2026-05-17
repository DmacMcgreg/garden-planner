import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Canvas } from '@react-three/fiber/native'
import { Vector3 } from 'three'
import SceneContent, { type SceneContentProps } from './SceneContent'
import { raycastGround, raycastPick, type SceneBridge } from './sceneBridge'
import { degreesToCompass, type HeatmapInstance } from '../sun'
import type { BedConfig, Structure } from '../types'

const SUN_FACE: Record<BedConfig['sunNeeds'], string> = {
  full: 'Full',
  partial: 'Part',
  'shade-tolerant': 'Shade',
}

type SceneProps = Omit<
  SceneContentProps,
  'livePatchBedId' | 'livePatch' | 'livePatchStructureId' | 'livePatchStructurePos'
> & {
  bridge: SceneBridge
  yardHeadingDeg: number
  moveMode: boolean
  sunProbeActive: boolean
  onPick: (kind: 'bed' | 'structure' | 'heatmap', id: string) => void
  onDeselect: () => void
  onProbePlace: (x: number, z: number) => void
  onMoveBed: (id: string, x: number, z: number) => void
  onMoveStructure: (id: string, pos: [number, number, number]) => void
}

interface LabelPos {
  key: string
  x: number
  y: number
  text: string
  color: string
  visible: boolean
}

const snap = (v: number) => Math.round(v * 2) / 2

export default function GardenScene(props: SceneProps) {
  const {
    bridge,
    moveMode,
    sunProbeActive,
    onPick,
    onDeselect,
    onProbePlace,
    onMoveBed,
    onMoveStructure,
    beds,
    structures,
    heatmaps,
    selectedBedId,
    selectedId,
    sunProbePosition,
    yardHeadingDeg,
  } = props

  // Live drag preview (avoids committing expensive state on every frame)
  const [bedPatch, setBedPatch] = useState<{ id: string; x: number; z: number } | null>(null)
  const [structPatch, setStructPatch] = useState<{
    id: string
    pos: [number, number, number]
  } | null>(null)
  const dragKind = useRef<'orbit' | 'move-bed' | 'move-struct' | null>(null)
  const camStart = useRef({ az: 0, pol: 0 })
  const distStart = useRef(0)
  const targetStart = useRef(new Vector3())

  const layout = useRef({ width: 1, height: 1 })

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout
      layout.current = { width, height }
      bridge.layout = { width, height }
    },
    [bridge],
  )

  /* ---- Tap: select / probe / deselect ---- */
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((e) => {
          if (sunProbeActive) {
            const p = raycastGround(bridge, e.x, e.y)
            if (p) onProbePlace(snap(p.x), snap(p.z))
            return
          }
          const hit = raycastPick(bridge, e.x, e.y)
          if (hit) onPick(hit.kind, hit.id)
          else onDeselect()
        })
        .runOnJS(true),
    [bridge, sunProbeActive, onPick, onDeselect, onProbePlace],
  )

  /* ---- Pan: orbit, or move selected object in move mode ---- */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .onStart((e) => {
          if (moveMode && selectedBedId) {
            dragKind.current = 'move-bed'
          } else if (moveMode && selectedId) {
            dragKind.current = 'move-struct'
          } else {
            dragKind.current = 'orbit'
            camStart.current = { az: bridge.cam.azimuth, pol: bridge.cam.polar }
          }
          if (dragKind.current === 'move-struct') {
            const s = structures.find((x) => x.id === selectedId)
            if (s) setStructPatch({ id: s.id, pos: [...s.position] })
          }
        })
        .onUpdate((e) => {
          if (dragKind.current === 'orbit') {
            bridge.cam.azimuth = camStart.current.az - e.translationX * 0.006
            let pol = camStart.current.pol - e.translationY * 0.006
            pol = Math.max(0.05, Math.min(Math.PI / 2.05, pol))
            bridge.cam.polar = pol
          } else if (dragKind.current === 'move-bed' && selectedBedId) {
            const p = raycastGround(bridge, e.x, e.y)
            if (p) setBedPatch({ id: selectedBedId, x: snap(p.x), z: snap(p.z) })
          } else if (dragKind.current === 'move-struct' && selectedId) {
            const p = raycastGround(bridge, e.x, e.y)
            const s = structures.find((x) => x.id === selectedId)
            if (p && s)
              setStructPatch({
                id: selectedId,
                pos: [snap(p.x), s.position[1], snap(p.z)],
              })
          }
        })
        .onEnd(() => {
          if (dragKind.current === 'move-bed' && bedPatch) {
            onMoveBed(bedPatch.id, bedPatch.x, bedPatch.z)
          } else if (dragKind.current === 'move-struct' && structPatch) {
            onMoveStructure(structPatch.id, structPatch.pos)
          }
          dragKind.current = null
          setBedPatch(null)
          setStructPatch(null)
        })
        .runOnJS(true),
    [
      bridge,
      moveMode,
      selectedBedId,
      selectedId,
      structures,
      bedPatch,
      structPatch,
      onMoveBed,
      onMoveStructure,
    ],
  )

  /* ---- Pinch: dolly ---- */
  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          distStart.current = bridge.cam.distance
        })
        .onUpdate((e) => {
          const d = distStart.current / Math.max(0.2, e.scale)
          bridge.cam.distance = Math.max(8, Math.min(250, d))
        })
        .runOnJS(true),
    [bridge],
  )

  /* ---- Two-finger pan: move orbit target ---- */
  const panTarget = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(2)
        .onStart(() => {
          targetStart.current.copy(bridge.cam.target)
        })
        .onUpdate((e) => {
          const az = bridge.cam.azimuth
          const k = bridge.cam.distance * 0.0016
          const fx = -Math.cos(az)
          const fz = Math.sin(az)
          bridge.cam.target.set(
            targetStart.current.x +
              (-e.translationX * Math.sin(az) - e.translationY * fx) * k,
            0,
            targetStart.current.z +
              (-e.translationX * Math.cos(az) - e.translationY * fz) * k,
          )
        })
        .runOnJS(true),
    [bridge],
  )

  const gesture = useMemo(
    () => Gesture.Simultaneous(Gesture.Race(panTarget, pan), pinch, tap),
    [panTarget, pan, pinch, tap],
  )

  /* ---- Projected text labels overlay ---- */
  const labelAnchors = useMemo(() => {
    const a: { key: string; pos: Vector3; text: string; color: string }[] = []
    for (const bed of beds) {
      const dx = bedPatch && bedPatch.id === bed.id ? bedPatch.x : bed.x
      const dz = bedPatch && bedPatch.id === bed.id ? bedPatch.z : bed.z
      const y = bed.hasTrellis ? (bed.trellisHeight ?? 6) + 1 : 2
      a.push({
        key: `bed-${bed.id}`,
        pos: new Vector3(dx, y, dz),
        text: `${SUN_FACE[bed.sunNeeds]} · ${bed.name}`,
        color: bed.id === selectedBedId ? '#00ff88' : '#ffffff',
      })
    }
    for (const h of heatmaps) {
      a.push({
        key: `hm-${h.id}`,
        pos: new Vector3(h.centerX, 0.15, h.centerZ + h.depth / 2 + 0.4),
        text: `${h.name} · ${h.width.toFixed(0)}x${h.depth.toFixed(0)}ft`,
        color: '#7dd3fc',
      })
    }
    if (sunProbePosition) {
      a.push({
        key: 'probe',
        pos: new Vector3(sunProbePosition.x, 2.7, sunProbePosition.z),
        text: `(${sunProbePosition.x.toFixed(1)}, ${sunProbePosition.z.toFixed(1)})`,
        color: '#FFD700',
      })
    }
    const dir = (deg: number) => degreesToCompass(((deg % 360) + 360) % 360)
    a.push({
      key: 'd+x',
      pos: new Vector3(13, 2, 0),
      text: dir(yardHeadingDeg),
      color: '#c5e1a5',
    })
    a.push({
      key: 'd-x',
      pos: new Vector3(-13, 2, 0),
      text: dir(yardHeadingDeg + 180),
      color: '#c5e1a5',
    })
    a.push({
      key: 'd+z',
      pos: new Vector3(0, 2, 7),
      text: dir(yardHeadingDeg + 90),
      color: '#c5e1a5',
    })
    a.push({
      key: 'd-z',
      pos: new Vector3(0, 2, -6.5),
      text: dir(yardHeadingDeg + 270),
      color: '#c5e1a5',
    })
    return a
  }, [beds, heatmaps, sunProbePosition, selectedBedId, yardHeadingDeg, bedPatch])

  const [labels, setLabels] = useState<LabelPos[]>([])
  const rafRef = useRef<number | null>(null)
  const anchorsRef = useRef(labelAnchors)
  anchorsRef.current = labelAnchors

  useEffect(() => {
    const _v = new Vector3()
    const tick = () => {
      const cam = bridge.camera
      const { width, height } = layout.current
      if (cam) {
        const out: LabelPos[] = []
        for (const an of anchorsRef.current) {
          _v.copy(an.pos).project(cam as any)
          const visible = _v.z < 1
          out.push({
            key: an.key,
            text: an.text,
            color: an.color,
            visible,
            x: ((_v.x + 1) / 2) * width,
            y: ((1 - _v.y) / 2) * height,
          })
        }
        setLabels(out)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [bridge])

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill}>
          <Canvas
            shadows
            gl={{ antialias: true }}
            camera={{ position: [-5, 28, 28], fov: 45, near: 0.1, far: 500 }}
          >
            <SceneContent
              {...props}
              livePatchBedId={bedPatch ? bedPatch.id : null}
              livePatch={bedPatch ? { x: bedPatch.x, z: bedPatch.z } : null}
              livePatchStructureId={structPatch ? structPatch.id : null}
              livePatchStructurePos={structPatch ? structPatch.pos : null}
            />
          </Canvas>
        </View>
      </GestureDetector>

      {/* Floating labels (projected from 3D) */}
      <View style={styles.overlay} pointerEvents="none">
        {labels.map((l) =>
          l.visible ? (
            <View
              key={l.key}
              style={[
                styles.label,
                { left: l.x, top: l.y, borderColor: l.color },
              ]}
            >
              <Text style={[styles.labelText, { color: l.color }]} numberOfLines={1}>
                {l.text}
              </Text>
            </View>
          ) : null,
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  label: {
    position: 'absolute',
    transform: [{ translateX: -40 }, { translateY: -10 }],
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 140,
  },
  labelText: { fontSize: 10, fontWeight: '600' },
})
