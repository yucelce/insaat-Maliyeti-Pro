import { Point } from '../types';

export function getPolygonAreaAndPerimeter(points: Point[]) {
  let area = 0;
  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
    perimeter += Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
  }
  area = Math.abs(area) / 2;
  return { area, perimeter };
}

export function isPointInPolygon(point: Point, vs: Point[]) {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(p: Point, v: Point, w: Point) {
  const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

export const floodFillRoom = (ctx: CanvasRenderingContext2D, startX: number, startY: number, width: number, height: number): Point[] | null => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixelStack = [[Math.round(startX), Math.round(startY)]];
  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx+1], data[idx+2]];
  };
  const startColor = getPixel(startX, startY);
  const isWall = (r: number, g: number, b: number) => (r + g + b) / 3 < 120; 
  if (isWall(startColor[0], startColor[1], startColor[2])) return null;

  const visited = new Int8Array(width * height);
  let minX = width, maxX = 0, minY = height, maxY = 0;

  while (pixelStack.length) {
    const newPos = pixelStack.pop()!;
    const x = newPos[0], y = newPos[1];
    const idx = y * width + x;
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) continue;
    const [r, g, b] = getPixel(x, y);
    if (!isWall(r, g, b)) {
      visited[idx] = 1;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      pixelStack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  const points: Point[] = [];
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const rayCount = 36;
  for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let cx = centerX, cy = centerY;
      while (true) {
          const nx = Math.round(cx + dx * 2);
          const ny = Math.round(cy + dy * 2);
          const idx = ny * width + nx;
          if (nx < minX || nx > maxX || ny < minY || ny > maxY || !visited[idx]) {
              points.push({x: cx, y: cy});
              break;
          }
          cx = nx; cy = ny;
      }
  }
  return points;
};