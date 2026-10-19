/**
 * TypeScript motion tokens mirroring CSS motion variables in motion.css.
 * Use for JS/Recharts animations and canvas/SVG calculations.
 */
export const DUR = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 420,
  chart: 1100,
  count: 900,
} as const;

export const EASE = {
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const LIFT = {
  sm: -2,
  md: -4,
} as const;

export const SCALE = {
  hover: 1.04,
  press: 0.97,
} as const;

export const SHADOWS = {
  rest: "0 1px 2px rgba(43, 51, 36, 0.06)",
  hoverGreen: "0 8px 20px rgba(126, 155, 87, 0.28)",
  hoverPink: "0 8px 20px rgba(227, 143, 169, 0.30)",
  cardHover: "0 12px 28px rgba(43, 51, 36, 0.10)",
} as const;
