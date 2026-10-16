import { bounds, offsetPolygon, type Piece, type Pt } from './geometry';

const f = (n: number) => Math.round(n * 100) / 100;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const path = (pts: Pt[], close = true) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ') + (close ? ' Z' : '');

/** SVG en milímetros reales (width/height en mm). Incluye un cuadrado de 100 mm para comprobar la escala al imprimir. */
export function piecesToSvg(pieces: Piece[], opts: { calibration?: boolean } = {}): string {
  const margin = 20, gap = 30;
  let x = margin, maxH = 0;
  const groups: string[] = [];
  for (const p of pieces) {
    const cut = p.allowance > 0 ? offsetPolygon(p.seam, p.allowance) : p.seam;
    const b = bounds(cut);
    const dx = x - b.minX, dy = margin - b.minY;
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    const mid = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    groups.push(`<g transform="translate(${f(dx)} ${f(dy)})">
  <path d="${path(cut)}" fill="none" stroke="#211438" stroke-width="0.6"/>
  <path d="${path(p.seam)}" fill="none" stroke="#6D28D9" stroke-width="0.4" stroke-dasharray="3 2"/>
  ${p.darts.map((d) => `<path d="${path([d.left, d.apex, d.right], false)}" fill="none" stroke="#6D28D9" stroke-width="0.4"/>`).join('')}
  ${p.notches.map((n) => `<circle cx="${f(n.x)}" cy="${f(n.y)}" r="1.5" fill="#211438"/>`).join('')}
  <path d="${path([p.grain.a, p.grain.b], false)}" stroke="#25212B" stroke-width="0.5" marker-start="url(#ah)" marker-end="url(#ah)"/>
  <text x="${f(mid.x + 12)}" y="${f(mid.y)}" font-size="6" font-family="sans-serif" fill="#25212B">${esc(p.name)} ×${p.cutQty}</text>
</g>`);
    x += w + gap;
    maxH = Math.max(maxH, h);
  }
  let width = x - gap + margin;
  let height = maxH + margin * 2;
  let cal = '';
  if (opts.calibration !== false) {
    const cx = width - margin + gap, cy = margin;
    cal = `<g><rect x="${cx}" y="${cy}" width="100" height="100" fill="none" stroke="#25212B" stroke-width="0.4"/>
<text x="${cx}" y="${cy + 108}" font-size="5" font-family="sans-serif" fill="#25212B">Cuadrado de prueba: 100 × 100 mm</text></g>`;
    width = cx + 100 + margin;
    height = Math.max(height, cy + 120);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}mm" height="${f(height)}mm" viewBox="0 0 ${f(width)} ${f(height)}">
<defs><marker id="ah" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 6 L3 0 L6 6" fill="none" stroke="#25212B" stroke-width="0.8"/></marker></defs>
${groups.join('\n')}
${cal}
</svg>`;
}
