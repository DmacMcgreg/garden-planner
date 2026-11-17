export interface PhotoPoint {
  x: number
  y: number
}

// Recover the relative lengths of a rectangular ground patch from its planar
// homography. One measured edge establishes scale. With parallel vanishing
// directions, use an approximate 60° horizontal field of view.
export function estimateYardDepth(points: PhotoPoint[], aspect: number, width: number): number | null {
  if (points.length !== 4 || !(width > 0) || !(aspect > 0)) return null
  const p = points.map(({ x, y }) => ({ x: x - 0.5, y: (y - 0.5) / aspect }))
  const cross = p.map((a, i) => {
    const b = p[(i + 1) % 4],
      c = p[(i + 2) % 4]
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
  })
  if (!(cross.every((c) => c > 0.00001) || cross.every((c) => c < -0.00001))) return null
  const [a, b, c, d] = p
  const x1 = b.x - c.x,
    x2 = d.x - c.x,
    x3 = a.x - b.x + c.x - d.x
  const y1 = b.y - c.y,
    y2 = d.y - c.y,
    y3 = a.y - b.y + c.y - d.y
  const det = x1 * y2 - x2 * y1
  const g = (x3 * y2 - x2 * y3) / det,
    h = (x1 * y3 - x3 * y1) / det
  const u = [b.x - a.x + g * b.x, b.y - a.y + g * b.y]
  const v = [d.x - a.x + h * d.x, d.y - a.y + h * d.y]
  const focalSq = -(u[0] * v[0] + u[1] * v[1]) / (g * h)
  const f2 = Number.isFinite(focalSq) && focalSq > 0.02 && focalSq < 100 ? focalSq : 0.75
  const depth =
    width * Math.sqrt((v[0] ** 2 + v[1] ** 2 + f2 * h * h) / (u[0] ** 2 + u[1] ** 2 + f2 * g * g))
  return Number.isFinite(depth) && depth >= 2 && depth <= 200 ? depth : null
}
