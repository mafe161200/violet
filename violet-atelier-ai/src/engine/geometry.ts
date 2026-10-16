export type Pt = { x: number; y: number };
export type Dart = { apex: Pt; left: Pt; right: Pt };
export type Piece = {
  id: string; name: string; unit: 'mm';
  seam: Pt[];            // línea de costura (contorno terminado)
  allowance: number;     // margen de costura en mm
  darts: Dart[]; notches: Pt[];
  grain: { a: Pt; b: Pt };
  cutQty: number; size: string; notes: string;
};
export type Issue = { level: 'error' | 'warning'; code: string; message: string };

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

export function signedArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const perimeter = (p: Pt[]) => p.reduce((s, a, i) => s + dist(a, p[(i + 1) % p.length]!), 0);

/** Desplaza el polígono hacia fuera `d` mm con esquinas en inglete. */
export function offsetPolygon(poly: Pt[], d: number): Pt[] {
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  const n = poly.length;
  const normal = (a: Pt, b: Pt): Pt => {
    const l = dist(a, b) || 1;
    return { x: (sign * (b.y - a.y)) / l, y: (-sign * (b.x - a.x)) / l };
  };
  return poly.map((p, i) => {
    const n1 = normal(poly[(i - 1 + n) % n]!, p);
    const n2 = normal(p, poly[(i + 1) % n]!);
    const k = 1 + n1.x * n2.x + n1.y * n2.y;
    const f = d / Math.max(k, 1e-6);
    return { x: p.x + (n1.x + n2.x) * f, y: p.y + (n1.y + n2.y) * f };
  });
}

const orient = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function selfIntersects(poly: Pt[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

export function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function bounds(pts: Pt[]) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Validaciones deterministas. Lo que no se puede comprobar aquí no se declara válido. */
export function validatePiece(piece: Piece): Issue[] {
  const out: Issue[] = [];
  const err = (code: string, message: string) => out.push({ level: 'error', code, message: `${piece.name}: ${message}` });
  const warn = (code: string, message: string) => out.push({ level: 'warning', code, message: `${piece.name}: ${message}` });

  if (piece.seam.length < 3 || piece.seam.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    err('INVALID_OUTLINE', 'el contorno necesita al menos 3 puntos con coordenadas válidas.');
    return out;
  }
  if (Math.abs(signedArea(piece.seam)) < 1) err('ZERO_AREA', 'el área de la pieza es nula.');
  if (selfIntersects(piece.seam)) err('SELF_INTERSECTION', 'el contorno se cruza consigo mismo.');
  if (piece.allowance < 0) err('NEGATIVE_ALLOWANCE', 'el margen de costura no puede ser negativo.');
  else if (piece.allowance > 0 && selfIntersects(offsetPolygon(piece.seam, piece.allowance)))
    err('ALLOWANCE_INVALID', 'el margen de costura genera una línea de corte inválida.');
  if (piece.allowance > 0 && piece.allowance < 5) warn('THIN_ALLOWANCE', 'margen menor de 5 mm.');
  if (piece.cutQty < 1) err('CUT_QTY', 'la cantidad de corte debe ser al menos 1.');
  for (const d of piece.darts) {
    if (![d.apex, d.left, d.right].every((p) => pointInPolygon(p, piece.seam) || onBoundary(p, piece.seam)))
      err('DART_OUTSIDE', 'una pinza queda fuera de la pieza.');
    if (dist(d.left, d.right) > 50) warn('WIDE_DART', 'pinza de más de 50 mm: conviene repartir en dos.');
  }
  if (!pointInPolygon(piece.grain.a, piece.seam) || !pointInPolygon(piece.grain.b, piece.seam))
    err('GRAIN_OUTSIDE', 'el hilo de tela debe quedar dentro de la pieza.');
  return out;
}

function onBoundary(p: Pt, poly: Pt[]): boolean {
  return poly.some((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    return Math.abs(orient(a, b, p)) < 1e-6 && p.x >= Math.min(a.x, b.x) - 1e-6 && p.x <= Math.max(a.x, b.x) + 1e-6 &&
      p.y >= Math.min(a.y, b.y) - 1e-6 && p.y <= Math.max(a.y, b.y) + 1e-6;
  });
}
