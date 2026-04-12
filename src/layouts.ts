// Garden layout configurations
// Yard: 24ft (ENE-WSW) x 10ft (NNW-SSE)
// Scene coords: X = -12 to +12 (ENE=+X), Z = -5 to +5 (SSE=+Z)
// House wall at x=+12 (ENE), back fence at x=-12 (WSW)
// Side fence at z=-5 (NNW), open/shared at z=+5 (SSE)

import type { BedConfig, PanelConfig, PathConfig, LayoutConfig } from './types'
import { PLANT_PRESETS } from './types'
export type { BedConfig, PanelConfig, PathConfig, LayoutConfig } from './types'

// Plant colors
const COLORS = {
  tomato: '#C62828',
  pepper: '#E65100',
  cucumber: '#2E7D32',
  beans: '#1B5E20',
  peas: '#43A047',
  kale: '#004D40',
  broccoli: '#00695C',
  cauliflower: '#C8B88A',
  herbs: '#689F38',
  lettuce: '#9CCC65',
};

// ================================================================
// LAYOUT A: Row-Based Maximum Sun
// ================================================================
// Three rows running ENE-WSW (along X), stacked NNW to SSE (along Z)
// Tall trellis crops against NNW fence, full-sun crops on SSE open edge

const layoutA: LayoutConfig = {
  id: 'a',
  name: 'A: Row-Based',
  subtitle: 'Maximum Sun Exposure',
  description:
    'Three rows running along the yard. Tall trellis crops (beans, peas) against the NNW fence so they don\'t shade other plants. Shade-tolerant brassicas in the middle row. Full-sun crops (tomatoes, peppers, cucumbers) on the SSE open edge where they get the most direct sunlight. Panels lean against the house wall.',
  beds: [
    // NNW Row (against fence): z from -5 to -3, center z=-4
    {
      id: 'beans-a', name: 'Pole Beans', x: -4.5, z: -4, width: 13, depth: 2,
      color: COLORS.beans, sunNeeds: 'full', hasTrellis: true, trellisHeight: 6,
    },
    {
      id: 'peas-a', name: 'Peas', x: 7.75, z: -4, width: 7.5, depth: 2,
      color: COLORS.peas, sunNeeds: 'partial', hasTrellis: true, trellisHeight: 4,
    },
    // Middle Row: z from -1.5 to +1, center z=-0.25
    {
      id: 'kale-a', name: 'Kale', x: -9, z: -0.25, width: 5, depth: 2.5,
      color: COLORS.kale, sunNeeds: 'shade-tolerant',
    },
    {
      id: 'broccoli-a', name: 'Broccoli', x: -3.25, z: -0.25, width: 5.5, depth: 2.5,
      color: COLORS.broccoli, sunNeeds: 'shade-tolerant',
    },
    {
      id: 'cauliflower-a', name: 'Cauliflower', x: 3, z: -0.25, width: 5.5, depth: 2.5,
      color: COLORS.cauliflower, sunNeeds: 'shade-tolerant',
    },
    {
      id: 'herbs-a', name: 'Herbs', x: 8.75, z: -0.25, width: 5.5, depth: 2.5,
      color: COLORS.herbs, sunNeeds: 'partial',
    },
    // SSE Row (sunniest): z from +2.5 to +5, center z=+3.75
    {
      id: 'tomatoes-a', name: 'Tomatoes', x: -7.75, z: 3.75, width: 7.5, depth: 2.5,
      color: COLORS.tomato, sunNeeds: 'full',
    },
    {
      id: 'peppers-a', name: 'Peppers', x: 0, z: 3.75, width: 7, depth: 2.5,
      color: COLORS.pepper, sunNeeds: 'full',
    },
    {
      id: 'cucumbers-a', name: 'Cucumbers', x: 7.75, z: 3.75, width: 7.5, depth: 2.5,
      color: COLORS.cucumber, sunNeeds: 'full',
    },
  ],
  panels: [
    // 4 panels leaning against house wall (ENE, x=+12), facing SSW
    { x: 11.2, z: -3.5, tiltDeg: 55, facingAngle: Math.PI, widthFt: 1.8, heightFt: 3.5 },
    { x: 11.2, z: -1.7, tiltDeg: 55, facingAngle: Math.PI, widthFt: 1.8, heightFt: 3.5 },
    { x: 11.2, z: 0.1, tiltDeg: 55, facingAngle: Math.PI, widthFt: 1.8, heightFt: 3.5 },
    { x: 11.2, z: 1.9, tiltDeg: 55, facingAngle: Math.PI, widthFt: 1.8, heightFt: 3.5 },
  ],
  paths: [
    // Path between NNW row and middle row: z from -3 to -1.5
    { x: 0, z: -2.25, width: 24, depth: 1.5 },
    // Path between middle row and SSE row: z from +1 to +2.5
    { x: 0, z: 1.75, width: 24, depth: 1.5 },
  ],
};

// ================================================================
// LAYOUT B: Companion Zones
// ================================================================
// Grouped by plant families/companions. Vertical trellis on back fence (WSW).
// Nightshade family near SSE, brassicas middle, legumes on NNW fence.

const layoutB: LayoutConfig = {
  id: 'b',
  name: 'B: Companion Zones',
  subtitle: 'Family Groupings',
  description:
    'Plants grouped by companion families. Nightshade family (tomatoes, peppers) with herbs on the sunny SSE side. Brassicas (kale, broccoli, cauliflower) in the center. Legumes (beans, peas) on NNW fence trellis to fix nitrogen for neighbors. Cucumbers climb the WSW back fence. Panels ground-mounted at the shaded NNW corner.',
  beds: [
    // WSW back fence strip: cucumbers on trellis (vertical along back fence)
    {
      id: 'cukes-b', name: 'Cucumbers', x: -11, z: -0.5, width: 2, depth: 7,
      color: COLORS.cucumber, sunNeeds: 'full', hasTrellis: true, trellisHeight: 5,
    },
    // NNW fence row: legumes
    {
      id: 'beans-b', name: 'Pole Beans', x: -4, z: -4, width: 10, depth: 2,
      color: COLORS.beans, sunNeeds: 'full', hasTrellis: true, trellisHeight: 6,
    },
    {
      id: 'peas-b', name: 'Peas', x: 6, z: -4, width: 8, depth: 2,
      color: COLORS.peas, sunNeeds: 'partial', hasTrellis: true, trellisHeight: 4,
    },
    // Center zone: brassicas (z from -1.5 to +1.5)
    {
      id: 'kale-b', name: 'Kale', x: -6.5, z: 0, width: 5, depth: 3,
      color: COLORS.kale, sunNeeds: 'shade-tolerant',
    },
    {
      id: 'broccoli-b', name: 'Broccoli', x: -0.5, z: 0, width: 5, depth: 3,
      color: COLORS.broccoli, sunNeeds: 'shade-tolerant',
    },
    {
      id: 'cauliflower-b', name: 'Cauliflower', x: 5.5, z: 0, width: 5, depth: 3,
      color: COLORS.cauliflower, sunNeeds: 'shade-tolerant',
    },
    // SSE sunny strip: nightshades + herbs (z from +3 to +5)
    {
      id: 'tomatoes-b', name: 'Tomatoes', x: -7, z: 4, width: 6, depth: 2,
      color: COLORS.tomato, sunNeeds: 'full',
    },
    {
      id: 'peppers-b', name: 'Peppers', x: 0, z: 4, width: 6, depth: 2,
      color: COLORS.pepper, sunNeeds: 'full',
    },
    {
      id: 'herbs-b', name: 'Herbs', x: 6.5, z: 4, width: 5, depth: 2,
      color: COLORS.herbs, sunNeeds: 'partial',
    },
  ],
  panels: [
    // Ground-mounted at NNW corner (shaded area, angled toward S)
    { x: 10.5, z: -4, tiltDeg: 50, facingAngle: Math.PI * 0.75, widthFt: 1.8, heightFt: 3.5 },
    { x: 10.5, z: -2.2, tiltDeg: 50, facingAngle: Math.PI * 0.75, widthFt: 1.8, heightFt: 3.5 },
    { x: 10.5, z: -0.4, tiltDeg: 50, facingAngle: Math.PI * 0.75, widthFt: 1.8, heightFt: 3.5 },
    { x: 10.5, z: 1.4, tiltDeg: 50, facingAngle: Math.PI * 0.75, widthFt: 1.8, heightFt: 3.5 },
  ],
  paths: [
    // Horizontal path between NNW row and center zone
    { x: 2, z: -2.25, width: 22, depth: 1.5 },
    // Horizontal path between center zone and SSE strip
    { x: 0, z: 2.25, width: 24, depth: 1.5 },
    // Vertical path between cucumber strip and rest
    { x: -9.25, z: 0, width: 1.5, depth: 7 },
  ],
};

// ================================================================
// LAYOUT C: Raised Bed Grid
// ================================================================
// Organized 3x3 grid of raised beds with cross-shaped paths.
// Sun-ordered: full sun at SSE, shade-tolerant at NNW.

const layoutC: LayoutConfig = {
  id: 'c',
  name: 'C: Raised Bed Grid',
  subtitle: 'Organized Grid',
  description:
    'Nine raised beds in a 3x3 grid with generous cross-shaped walking paths. Full-sun crops in the SSE row, partial-sun in center, shade-tolerant near NNW fence. Grid pattern allows easy access to every bed from all sides. Panels line the house wall.',
  beds: [
    // NNW row (z = -3.5): shade-tolerant
    {
      id: 'beans-c', name: 'Pole Beans', x: -7.75, z: -3.5, width: 6.5, depth: 3,
      color: COLORS.beans, sunNeeds: 'full', hasTrellis: true, trellisHeight: 6,
    },
    {
      id: 'peas-c', name: 'Peas', x: 0, z: -3.5, width: 6.5, depth: 3,
      color: COLORS.peas, sunNeeds: 'partial', hasTrellis: true, trellisHeight: 4,
    },
    {
      id: 'kale-c', name: 'Kale', x: 7.75, z: -3.5, width: 6.5, depth: 3,
      color: COLORS.kale, sunNeeds: 'shade-tolerant',
    },
    // Middle row (z = 0): partial sun
    {
      id: 'broccoli-c', name: 'Broccoli', x: -7.75, z: 0, width: 6.5, depth: 2.5,
      color: COLORS.broccoli, sunNeeds: 'shade-tolerant',
    },
    {
      id: 'cauliflower-c', name: 'Cauliflower', x: 0, z: 0, width: 6.5, depth: 2.5,
      color: COLORS.cauliflower, sunNeeds: 'shade-tolerant',
    },
    {
      id: 'herbs-c', name: 'Herbs', x: 7.75, z: 0, width: 6.5, depth: 2.5,
      color: COLORS.herbs, sunNeeds: 'partial',
    },
    // SSE row (z = +3.5): full sun
    {
      id: 'tomatoes-c', name: 'Tomatoes', x: -7.75, z: 3.5, width: 6.5, depth: 3,
      color: COLORS.tomato, sunNeeds: 'full',
    },
    {
      id: 'peppers-c', name: 'Peppers', x: 0, z: 3.5, width: 6.5, depth: 3,
      color: COLORS.pepper, sunNeeds: 'full',
    },
    {
      id: 'cucumbers-c', name: 'Cucumbers', x: 7.75, z: 3.5, width: 6.5, depth: 3,
      color: COLORS.cucumber, sunNeeds: 'full',
    },
  ],
  panels: [
    // Against house wall
    { x: 11.2, z: -3.5, tiltDeg: 55, facingAngle: Math.PI, widthFt: 1.8, heightFt: 3.5 },
    { x: 11.2, z: -1.7, tiltDeg: 55, facingAngle: Math.PI, widthFt: 1.8, heightFt: 3.5 },
    { x: 11.2, z: 0.1, tiltDeg: 55, facingAngle: Math.PI, widthFt: 1.8, heightFt: 3.5 },
    { x: 11.2, z: 1.9, tiltDeg: 55, facingAngle: Math.PI, widthFt: 1.8, heightFt: 3.5 },
  ],
  paths: [
    // Horizontal paths
    { x: 0, z: -1.625, width: 24, depth: 1.25 },
    { x: 0, z: 1.625, width: 24, depth: 1.25 },
    // Vertical paths
    { x: -3.875, z: 0, width: 1.25, depth: 10 },
    { x: 3.875, z: 0, width: 1.25, depth: 10 },
  ],
};

export const layouts: LayoutConfig[] = [layoutA, layoutB, layoutC];

export const plantLegend = Object.values(PLANT_PRESETS).map((p) => ({
  name: p.name,
  color: p.color,
  sun:
    p.sunNeeds === 'full'
      ? `Full Sun (${p.minSunHours}+ PSH)`
      : p.sunNeeds === 'partial'
        ? `Partial Sun (${p.minSunHours}+ PSH)`
        : `Shade Tolerant (${p.minSunHours}+ PSH)`,
}));
