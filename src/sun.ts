// Sun position calculations for Ontario, Canada (~43.7N latitude)
// Yard orientation: long axis runs ENE (67.5deg) to WSW (247.5deg)

const LATITUDE = 43.7;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export const DEFAULT_YARD_HEADING = 67.5;

export interface SunPosition {
  azimuthDeg: number;   // compass degrees (0=N, 90=E, 180=S, 270=W)
  altitudeDeg: number;  // degrees above horizon
  sceneX: number;       // Three.js X position
  sceneY: number;       // Three.js Y position
  sceneZ: number;       // Three.js Z position
  isAboveHorizon: boolean;
  intensity: number;    // light intensity 0-1.5
}

export function getSunPosition(dayOfYear: number, hour: number, yardHeadingDeg: number = DEFAULT_YARD_HEADING): SunPosition {
  const latRad = LATITUDE * DEG2RAD;

  // Solar declination (angle of sun relative to equatorial plane)
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (284 + dayOfYear));
  const decRad = declination * DEG2RAD;

  // Hour angle (15 degrees per hour from solar noon)
  const hourAngle = 15 * (hour - 12);
  const hourRad = hourAngle * DEG2RAD;

  // Solar altitude (elevation above horizon)
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourRad);
  const altitude = Math.asin(clamp(sinAlt, -1, 1));

  // Solar azimuth (compass bearing)
  const cosAlt = Math.cos(altitude);
  let azimuth = 0;
  if (cosAlt > 0.001) {
    const cosAz = (Math.sin(decRad) - Math.sin(altitude) * Math.sin(latRad)) /
      (cosAlt * Math.cos(latRad));
    azimuth = Math.acos(clamp(cosAz, -1, 1));
    if (hourAngle > 0) {
      azimuth = 2 * Math.PI - azimuth;
    }
  }

  const altDeg = altitude * RAD2DEG;
  const azDeg = azimuth * RAD2DEG;
  const isAboveHorizon = altDeg > 0;

  // Convert to scene coordinates
  // Scene: +X = yard heading, +Z = heading+90deg, Y = up
  const distance = 120;
  const yardHeadingRad = yardHeadingDeg * DEG2RAD;
  const sceneAngle = azimuth - yardHeadingRad;
  const horizontalDist = distance * Math.cos(Math.max(0, altitude));

  const sceneX = horizontalDist * Math.cos(sceneAngle);
  const sceneY = distance * Math.sin(Math.max(0, altitude));
  const sceneZ = horizontalDist * Math.sin(sceneAngle);

  // Intensity based on altitude (brighter at noon, dimmer near horizon)
  const intensity = isAboveHorizon
    ? Math.min(1.5, Math.max(0.1, Math.sin(altitude) * 2))
    : 0;

  return {
    azimuthDeg: azDeg,
    altitudeDeg: altDeg,
    sceneX,
    sceneY,
    sceneZ,
    isAboveHorizon,
    intensity,
  };
}

export function getDayOfYear(season: Season): number {
  switch (season) {
    case 'summer': return 172;   // June 21
    case 'winter': return 355;   // Dec 21
    case 'spring': return 80;    // March 21
    case 'fall': return 266;     // Sept 23
  }
}

export type Season = 'summer' | 'winter' | 'spring' | 'fall';

export function getSeasonLabel(season: Season): string {
  switch (season) {
    case 'summer': return 'Summer Solstice (Jun 21)';
    case 'winter': return 'Winter Solstice (Dec 21)';
    case 'spring': return 'Spring Equinox (Mar 21)';
    case 'fall': return 'Fall Equinox (Sep 23)';
  }
}

/** Season snap points (day-of-year) */
export const SEASON_DAYS = {
  spring: 80,   // Mar 21
  summer: 172,  // Jun 21
  fall: 266,    // Sep 23
  winter: 355,  // Dec 21
} as const

/** Derive the nearest season name from an arbitrary day-of-year */
export function seasonFromDay(day: number): Season {
  const d = ((day - 1) % 365) + 1
  if (d < 80) return 'winter'
  if (d < 172) return 'spring'
  if (d < 266) return 'summer'
  if (d < 355) return 'fall'
  return 'winter'
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Convert day-of-year (1-365) to a short date string like "Mar 21" */
export function dayOfYearToLabel(day: number): string {
  const d = new Date(2026, 0, day)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
}

/** Get the current day-of-year from the real clock */
export function todayDayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

/** Get the current fractional hour from the real clock */
export function currentHour(): number {
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60
}

export function formatTime(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

export function degreesToCompass(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(((deg % 360 + 360) % 360) / 22.5) % 16;
  return dirs[idx];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/* ------------------------------------------------------------------ */
/*  Sun Exposure & Energy Calculation                                 */
/* ------------------------------------------------------------------ */

export interface HourlyExposure {
  hour: number;
  altitudeDeg: number;
  azimuthDeg: number;
  intensity: number;      // 0-1.5, matches getSunPosition intensity
  isObstructed: boolean;  // true if a structure blocks the sun at this hour
}

export interface SunExposureResult {
  /** Total hours the point receives direct (unobstructed) sunlight */
  directSunHours: number;
  /** Peak Sun Hours: integral of sin(altitude) over sunlit time.
   *  Represents equivalent hours of overhead sun — standard solar energy metric.
   *  Units: kWh/m^2 (assuming 1 kW/m^2 peak irradiance). */
  peakSunHours: number;
  /** Maximum intensity reached during the day (0-1.5) */
  peakIntensity: number;
  /** Hour at which peak intensity occurs */
  peakHour: number;
  /** Total energy score: 0-10 normalized rating for gardening suitability */
  energyRating: number;
  /** Per-hour breakdown */
  hourly: HourlyExposure[];
}

/** Axis-aligned bounding box for shadow intersection */
interface AABB {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

interface ShadowCaster {
  aabb: AABB;
}

/**
 * Build an AABB from a structure's position (center) and size.
 * Matches Three.js boxGeometry positioning.
 */
export function structureToAABB(position: [number, number, number], size: [number, number, number]): AABB {
  return {
    minX: position[0] - size[0] / 2,
    maxX: position[0] + size[0] / 2,
    minY: position[1] - size[1] / 2,
    maxY: position[1] + size[1] / 2,
    minZ: position[2] - size[2] / 2,
    maxZ: position[2] + size[2] / 2,
  };
}

/**
 * Ray-AABB intersection test (slab method).
 * Returns true if a ray from `origin` in `direction` intersects the box
 * at a positive t (i.e., the box is in front of the ray origin).
 */
function rayIntersectsAABB(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  box: AABB,
): boolean {
  let tmin = -Infinity;
  let tmax = Infinity;

  // X slab
  if (Math.abs(dx) > 1e-9) {
    const t1 = (box.minX - ox) / dx;
    const t2 = (box.maxX - ox) / dx;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  } else if (ox < box.minX || ox > box.maxX) {
    return false;
  }

  // Y slab
  if (Math.abs(dy) > 1e-9) {
    const t1 = (box.minY - oy) / dy;
    const t2 = (box.maxY - oy) / dy;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  } else if (oy < box.minY || oy > box.maxY) {
    return false;
  }

  // Z slab
  if (Math.abs(dz) > 1e-9) {
    const t1 = (box.minZ - oz) / dz;
    const t2 = (box.maxZ - oz) / dz;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  } else if (oz < box.minZ || oz > box.maxZ) {
    return false;
  }

  return tmax >= tmin && tmax > 0 && tmin < tmax;
}

/**
 * Check if a point on the ground is in shadow at a given sun position.
 * Casts a ray from the point toward the sun and tests against all shadow casters.
 */
function isPointInShadow(
  px: number, pz: number,
  sun: SunPosition,
  casters: ShadowCaster[],
): boolean {
  if (!sun.isAboveHorizon) return true;

  // Ray origin: slightly above ground to avoid self-intersection
  const oy = 0.1;

  // Direction toward the sun (scene coordinates)
  const dx = sun.sceneX - px;
  const dy = sun.sceneY - oy;
  const dz = sun.sceneZ - pz;

  for (const caster of casters) {
    if (rayIntersectsAABB(px, oy, pz, dx, dy, dz, caster.aabb)) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate total sun exposure and energy for a point in the garden.
 *
 * @param pointX  - X coordinate in scene space
 * @param pointZ  - Z coordinate in scene space
 * @param dayOfYear - Day of year (1-365)
 * @param yardHeadingDeg - Garden orientation in degrees
 * @param structures - Array of {position, size, castShadow} objects
 * @returns Full exposure analysis for the day
 */
export function calculateSunExposure(
  pointX: number,
  pointZ: number,
  dayOfYear: number,
  yardHeadingDeg: number,
  structures: { position: [number, number, number]; size: [number, number, number]; castShadow: boolean }[],
): SunExposureResult {
  const TIME_STEP = 0.25; // 15-minute increments
  const START_HOUR = 4;
  const END_HOUR = 22;

  // Build shadow casters from structures that cast shadows
  const casters: ShadowCaster[] = structures
    .filter((s) => s.castShadow)
    .map((s) => ({ aabb: structureToAABB(s.position, s.size) }));

  const hourly: HourlyExposure[] = [];
  let directSunHours = 0;
  let peakSunHours = 0;
  let peakIntensity = 0;
  let peakHour = 12;

  for (let h = START_HOUR; h <= END_HOUR; h += TIME_STEP) {
    const sun = getSunPosition(dayOfYear, h, yardHeadingDeg);

    if (!sun.isAboveHorizon) continue;

    const obstructed = isPointInShadow(pointX, pointZ, sun, casters);

    // Only record at whole/half hours for the breakdown to keep it manageable
    if (h % 0.5 === 0) {
      hourly.push({
        hour: h,
        altitudeDeg: sun.altitudeDeg,
        azimuthDeg: sun.azimuthDeg,
        intensity: sun.intensity,
        isObstructed: obstructed,
      });
    }

    if (!obstructed) {
      directSunHours += TIME_STEP;

      // Lambert's cosine law: energy on horizontal surface = sin(altitude)
      const sinAlt = Math.sin(sun.altitudeDeg * DEG2RAD);
      peakSunHours += sinAlt * TIME_STEP;

      if (sun.intensity > peakIntensity) {
        peakIntensity = sun.intensity;
        peakHour = h;
      }
    }
  }

  // Energy rating: 0-10 scale based on peak sun hours
  // Summer solstice at 43.7N with no obstructions yields ~7-8 PSH
  // Scale: 0 PSH = 0, 8+ PSH = 10
  const energyRating = Math.min(10, (peakSunHours / 8) * 10);

  return {
    directSunHours: Math.round(directSunHours * 100) / 100,
    peakSunHours: Math.round(peakSunHours * 100) / 100,
    peakIntensity: Math.round(peakIntensity * 100) / 100,
    peakHour,
    energyRating: Math.round(energyRating * 10) / 10,
    hourly,
  };
}

/* ------------------------------------------------------------------ */
/*  Heatmap Grid Calculation                                          */
/* ------------------------------------------------------------------ */

export type HeatmapMode = 'directSunHours' | 'peakSunHours' | 'peakIntensity' | 'energyRating';

export interface HeatmapGrid {
  /** Grid width (number of columns) */
  cols: number;
  /** Grid height (number of rows) */
  rows: number;
  /** World-space bounds */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Per-metric flat arrays, row-major (row 0 = minZ). Length = cols * rows. */
  directSunHours: Float32Array;
  peakSunHours: Float32Array;
  peakIntensity: Float32Array;
  energyRating: Float32Array;
  /** Max values for normalization */
  maxDirectSunHours: number;
  maxPeakSunHours: number;
  maxPeakIntensity: number;
  maxEnergyRating: number;
}

export interface HeatmapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_HEATMAP_BOUNDS: HeatmapBounds = {
  minX: -14,
  maxX: 14,
  minZ: -7,
  maxZ: 9,
};

export interface HeatmapInstance {
  id: string;
  name: string;
  visible: boolean;
  mode: HeatmapMode;
  opacity: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export function heatmapInstanceBounds(h: HeatmapInstance): HeatmapBounds {
  return {
    minX: h.centerX - h.width / 2,
    maxX: h.centerX + h.width / 2,
    minZ: h.centerZ - h.depth / 2,
    maxZ: h.centerZ + h.depth / 2,
  };
}

export function createDefaultHeatmap(id: string, name: string): HeatmapInstance {
  return {
    id,
    name,
    visible: true,
    mode: 'energyRating',
    opacity: 0.55,
    centerX: (DEFAULT_HEATMAP_BOUNDS.minX + DEFAULT_HEATMAP_BOUNDS.maxX) / 2,
    centerZ: (DEFAULT_HEATMAP_BOUNDS.minZ + DEFAULT_HEATMAP_BOUNDS.maxZ) / 2,
    width: DEFAULT_HEATMAP_BOUNDS.maxX - DEFAULT_HEATMAP_BOUNDS.minX,
    depth: DEFAULT_HEATMAP_BOUNDS.maxZ - DEFAULT_HEATMAP_BOUNDS.minZ,
  };
}

/**
 * Calculate a grid of sun exposure values across the yard area.
 * Optimized: precomputes sun positions and casters once, then iterates per cell.
 *
 * @param dayOfYear - Day of year (1-365)
 * @param yardHeadingDeg - Garden orientation
 * @param structures - Shadow-casting structures
 * @param resolution - Grid cell size in feet (default 1)
 * @param bounds - Optional world-space bounds (defaults to DEFAULT_HEATMAP_BOUNDS)
 * @returns Grid with per-metric arrays for heatmap rendering
 */
export function calculateHeatmapGrid(
  dayOfYear: number,
  yardHeadingDeg: number,
  structures: { position: [number, number, number]; size: [number, number, number]; castShadow: boolean }[],
  resolution: number = 1,
  bounds: HeatmapBounds = DEFAULT_HEATMAP_BOUNDS,
): HeatmapGrid {
  const { minX, maxX, minZ, maxZ } = bounds;

  const cols = Math.ceil((maxX - minX) / resolution) + 1;
  const rows = Math.ceil((maxZ - minZ) / resolution) + 1;
  const totalCells = cols * rows;

  const directSunHours = new Float32Array(totalCells);
  const peakSunHours = new Float32Array(totalCells);
  const peakIntensity = new Float32Array(totalCells);
  const energyRating = new Float32Array(totalCells);

  // Precompute shadow casters
  const casters: ShadowCaster[] = structures
    .filter((s) => s.castShadow)
    .map((s) => ({ aabb: structureToAABB(s.position, s.size) }));

  // Precompute sun positions for all daylight time steps
  const TIME_STEP = 0.5; // 30-min steps for heatmap (faster than probe's 15-min)
  const sunSteps: { sun: SunPosition; sinAlt: number }[] = [];
  for (let h = 4; h <= 22; h += TIME_STEP) {
    const sun = getSunPosition(dayOfYear, h, yardHeadingDeg);
    if (sun.isAboveHorizon) {
      sunSteps.push({
        sun,
        sinAlt: Math.sin(sun.altitudeDeg * DEG2RAD),
      });
    }
  }

  // Iterate each grid cell
  for (let row = 0; row < rows; row++) {
    const pz = minZ + row * resolution;
    for (let col = 0; col < cols; col++) {
      const px = minX + col * resolution;
      const idx = row * cols + col;

      let dsh = 0;
      let psh = 0;
      let pi = 0;

      for (let s = 0; s < sunSteps.length; s++) {
        const { sun, sinAlt } = sunSteps[s];
        if (!isPointInShadow(px, pz, sun, casters)) {
          dsh += TIME_STEP;
          psh += sinAlt * TIME_STEP;
          if (sun.intensity > pi) pi = sun.intensity;
        }
      }

      directSunHours[idx] = dsh;
      peakSunHours[idx] = psh;
      peakIntensity[idx] = pi;
      energyRating[idx] = Math.min(10, (psh / 8) * 10);
    }
  }

  // Find max values for normalization
  let maxDSH = 0, maxPSH = 0, maxPI = 0, maxER = 0;
  for (let i = 0; i < totalCells; i++) {
    if (directSunHours[i] > maxDSH) maxDSH = directSunHours[i];
    if (peakSunHours[i] > maxPSH) maxPSH = peakSunHours[i];
    if (peakIntensity[i] > maxPI) maxPI = peakIntensity[i];
    if (energyRating[i] > maxER) maxER = energyRating[i];
  }

  return {
    cols,
    rows,
    minX,
    maxX,
    minZ,
    maxZ,
    directSunHours,
    peakSunHours,
    peakIntensity,
    energyRating,
    maxDirectSunHours: maxDSH,
    maxPeakSunHours: maxPSH,
    maxPeakIntensity: maxPI,
    maxEnergyRating: maxER,
  };
}
