import { describe, expect, it } from 'vitest';
import { offsetPolygon, selfIntersects, signedArea, validatePiece } from './geometry';
import { buildSkirt, defaultParams, hasErrors, validateSkirt } from './skirts';
import { piecesToSvg } from './svg';

const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

describe('geometría', () => {
  it('calcula área y offset', () => {
    expect(Math.abs(signedArea(square))).toBe(10000);
    const o = offsetPolygon(square, 10);
    expect(Math.abs(signedArea(o))).toBeCloseTo(120 * 120, 3);
  });
  it('detecta auto-intersecciones', () => {
    expect(selfIntersects(square)).toBe(false);
    expect(selfIntersects([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(true);
  });
  it('rechaza contornos inválidos', () => {
    const base = buildSkirt(defaultParams)[0]!;
    expect(validatePiece({ ...base, seam: base.seam.slice(0, 2) }).some((i) => i.code === 'INVALID_OUTLINE')).toBe(true);
    expect(validatePiece({ ...base, allowance: -1 }).some((i) => i.code === 'NEGATIVE_ALLOWANCE')).toBe(true);
  });
});

describe('faldas', () => {
  it('la falda recta por defecto es geométricamente válida y las pinzas absorben la diferencia', () => {
    const pieces = buildSkirt(defaultParams);
    expect(hasErrors(validateSkirt(defaultParams, pieces))).toBe(false);
    const hipQ = (960 + 40) / 4, intake = hipQ - 700 / 4;
    expect(pieces[0]!.darts[0]!.right.x - pieces[0]!.darts[0]!.left.x).toBeCloseTo(intake);
  });
  it('rechaza cadera menor que cintura', () => {
    const p = { ...defaultParams, hip: 600 };
    expect(hasErrors(validateSkirt(p, buildSkirt(p)))).toBe(true);
  });
  it('la falda circular cierra la cintura: 2 mitades = circunferencia', () => {
    const p = { ...defaultParams, kind: 'circular' as const };
    const [half] = buildSkirt(p);
    expect(hasErrors(validateSkirt(p, [half!]))).toBe(false);
    const r = p.waist / (2 * Math.PI);
    const waistArc = Math.PI * r;
    expect(waistArc * 2).toBeCloseTo(p.waist, 5);
  });
  it('exporta SVG en milímetros con cuadrado de 100 mm', () => {
    const svg = piecesToSvg(buildSkirt(defaultParams));
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg).toContain('width="100" height="100"');
  });
});
