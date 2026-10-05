export type Polygon = [number, number][];
// One micrometer in normalized meter-space queries covers GLB float32 quantization.
export const GEOMETRY_EPSILON = 1e-6;
export function signedArea(polygon: Polygon): number {
  return polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]!; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
}
export function onSegment(point: [number, number], a: [number, number], b: [number, number]): boolean {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
  return Math.abs(cross) <= GEOMETRY_EPSILON * length &&
    point[0] >= Math.min(a[0], b[0]) - GEOMETRY_EPSILON && point[0] <= Math.max(a[0], b[0]) + GEOMETRY_EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - GEOMETRY_EPSILON && point[1] <= Math.max(a[1], b[1]) + GEOMETRY_EPSILON;
}
function edgesIntersect(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const cross = (p: number[], q: number[], r: number[]) => (q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!);
  return onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b) ||
    (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0);
}
export function validPolygon(polygon: Polygon): boolean {
  if (polygon.length < 3 || polygon.some(p => p.some(v => !Number.isFinite(v))) || Math.abs(signedArea(polygon)) <= GEOMETRY_EPSILON) return false;
  if (new Set(polygon.map(p => JSON.stringify(p))).size !== polygon.length) return false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) <= GEOMETRY_EPSILON) return false;
    for (let j = i + 1; j < polygon.length; j++) {
      if (j === i + 1 || (i === 0 && j === polygon.length - 1)) continue;
      if (edgesIntersect(a, b, polygon[j]!, polygon[(j + 1) % polygon.length]!)) return false;
    }
  }
  return true;
}
export function containsPolygon(polygon: Polygon, point: [number, number]): 'inside' | 'boundary' | 'outside' {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if (onSegment(point, a, b)) return 'boundary';
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}
