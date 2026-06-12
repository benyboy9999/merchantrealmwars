// Flat-top hexagonal grid — axial coordinate system (q, r)
// Based on: https://www.redblobgames.com/grids/hexagons/

export const SQRT3 = Math.sqrt(3);

/** Convert axial hex coords to world-space pixel center (flat-top orientation). */
export function hexToPixel(q: number, r: number, radius: number): [number, number] {
  return [
    radius * 1.5 * q,
    radius * SQRT3 * (r + 0.5 * q),
  ];
}

/** Convert world-space pixel position to fractional axial hex coords (flat-top). */
export function pixelToHex(x: number, y: number, radius: number): [number, number] {
  const q = (x * 2) / (3 * radius);
  const r = y / (radius * SQRT3) - x / (3 * radius);
  return [q, r];
}

/** Round fractional axial coords to the nearest hex. */
export function axialRound(q: number, r: number): [number, number] {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

/** Trace a flat-top hex path onto a canvas context (does not stroke/fill). */
export function hexPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Return all axial coords within `radius` rings of the origin. */
export function hexesInRange(radius: number): Array<[number, number]> {
  const results: Array<[number, number]> = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      results.push([q, r]);
    }
  }
  return results;
}

/** Chebyshev distance in axial coords. */
export function hexDistance(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(-q - r)) / 2;
}
