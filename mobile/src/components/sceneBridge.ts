import { Camera, Raycaster, Scene, Vector2, Vector3, Plane } from 'three'

/**
 * Shared mutable state that lets the gesture layer (outside the Canvas) talk to
 * the renderer (inside the Canvas) without React re-renders. The Canvas writes
 * camera/scene refs in; gestures write the orbit target out.
 */
export interface CameraState {
  azimuth: number
  polar: number
  distance: number
  target: Vector3
}

export interface SceneBridge {
  camera: Camera | null
  scene: Scene | null
  layout: { width: number; height: number }
  cam: CameraState
  raycaster: Raycaster
}

export function createBridge(): SceneBridge {
  return {
    camera: null,
    scene: null,
    layout: { width: 1, height: 1 },
    cam: {
      azimuth: -0.177,
      polar: 0.804,
      distance: 40.4,
      target: new Vector3(0, 0, 0),
    },
    raycaster: new Raycaster(),
  }
}

export const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0)

const _ndc = new Vector2()

/** Set the bridge raycaster from a screen point (in layout dp). */
export function setRayFromScreen(bridge: SceneBridge, px: number, py: number): boolean {
  const { camera, layout } = bridge
  if (!camera) return false
  _ndc.set((px / layout.width) * 2 - 1, -(py / layout.height) * 2 + 1)
  bridge.raycaster.setFromCamera(_ndc, camera)
  return true
}

/** Raycast to the y=0 ground plane. Returns the hit point or null. */
export function raycastGround(bridge: SceneBridge, px: number, py: number): Vector3 | null {
  if (!setRayFromScreen(bridge, px, py)) return null
  const out = new Vector3()
  return bridge.raycaster.ray.intersectPlane(GROUND_PLANE, out) ? out : null
}

export interface PickHit {
  kind: 'bed' | 'structure' | 'heatmap'
  id: string
}

/** Raycast against pickable scene objects (tagged via userData.pickId). */
export function raycastPick(bridge: SceneBridge, px: number, py: number): PickHit | null {
  const { scene } = bridge
  if (!scene || !setRayFromScreen(bridge, px, py)) return null
  const hits = bridge.raycaster.intersectObjects(scene.children, true)
  for (const h of hits) {
    let o: any = h.object
    while (o) {
      if (o.userData && o.userData.pickId) {
        return { kind: o.userData.pickKind, id: o.userData.pickId }
      }
      o = o.parent
    }
  }
  return null
}
