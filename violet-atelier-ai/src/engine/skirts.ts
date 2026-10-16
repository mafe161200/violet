import { dist, type Issue, type Piece, type Pt, validatePiece } from './geometry';

export type SkirtKind = 'straight' | 'circular';
export type SkirtParams = {
  kind: SkirtKind;
  waist: number;  // mm, contorno de cintura
  hip: number;    // mm, contorno de cadera (solo falda recta)
  length: number; // mm, desde la cintura
  ease: number;   // mm, holgura total en cadera (solo falda recta)
  allowance: number; // mm
};

export const defaultParams: SkirtParams = { kind: 'straight', waist: 700, hip: 960, length: 600, ease: 40, allowance: 10 };

export function validateParams(p: SkirtParams): Issue[] {
  const out: Issue[] = [];
  const bad = (m: string) => out.push({ level: 'error', code: 'PARAMS', message: m });
  if (!(p.waist >= 400 && p.waist <= 1500)) bad('La cintura debe estar entre 400 y 1500 mm.');
  if (!(p.length >= 150 && p.length <= 1200)) bad('El largo debe estar entre 150 y 1200 mm.');
  if (p.allowance < 0 || p.allowance > 30) bad('El margen de costura debe estar entre 0 y 30 mm.');
  if (p.kind === 'straight') {
    if (!(p.hip >= p.waist)) bad('La cadera debe ser mayor o igual que la cintura.');
    if (p.ease < 0 || p.ease > 200) bad('La holgura debe estar entre 0 y 200 mm.');
  }
  return out;
}

const P = (x: number, y: number): Pt => ({ x, y });

function dart(xc: number, width: number, len: number) {
  return { left: P(xc - width / 2, 0), right: P(xc + width / 2, 0), apex: P(xc, len) };
}

function straight(p: SkirtParams): Piece[] {
  const hipQ = (p.hip + p.ease) / 4;
  const intake = hipQ - p.waist / 4; // lo que absorben las pinzas por cuarto de falda
  const rect = [P(0, 0), P(hipQ, 0), P(hipQ, p.length), P(0, p.length)];
  const base = { unit: 'mm' as const, seam: rect, allowance: p.allowance, notches: [P(hipQ, 200)], cutQty: 2, size: 'a medida' };
  const grain = { a: P(hipQ / 2, p.length * 0.4), b: P(hipQ / 2, p.length * 0.85) };
  return [
    { ...base, id: 'front', name: 'Delantero (al doblez)', cutQty: 1, grain, darts: [dart(hipQ / 2, intake, 90)], notes: 'Cortar una vez al doblez de la tela; verificar el sentido del hilo.' },
    { ...base, id: 'back', name: 'Trasero (al doblez)', grain,
      darts: [dart(hipQ / 3, intake / 2, 110), dart((2 * hipQ) / 3, intake / 2, 110)],
      notes: 'Borde izquierdo al centro trasero; abertura/cierre a definir.' },
  ];
}

function circular(p: SkirtParams): Piece[] {
  const r = p.waist / (2 * Math.PI);        // radio de cintura: 2 mitades = circunferencia completa
  const R = r + p.length;
  const steps = 48;
  const arc = (rad: number, from: number, to: number) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const t = from + ((to - from) * i) / steps;
      return P(R + rad * Math.cos(t), rad * Math.sin(t));
    });
  const seam = [...arc(r, 0, Math.PI), ...arc(R, Math.PI, 0)];
  return [{
    id: 'half', name: 'Medio círculo', unit: 'mm', seam, allowance: p.allowance, darts: [],
    notches: [P(R + r * Math.cos(Math.PI / 2), r * Math.sin(Math.PI / 2))],
    grain: { a: P(R, r + 40), b: P(R, R - 40) }, cutQty: 2, size: 'a medida',
    notes: 'Cortar dos mitades; unir en costuras laterales. El largo del bajo puede necesitar nivelado tras colgarla.',
  }];
}

export function buildSkirt(p: SkirtParams): Piece[] {
  return p.kind === 'straight' ? straight(p) : circular(p);
}

export function validateSkirt(p: SkirtParams, pieces: Piece[]): Issue[] {
  const out = [...validateParams(p), ...pieces.flatMap(validatePiece)];
  if (p.kind === 'straight') {
    const [f, b] = pieces;
    if (f && b) {
      const sf = dist(f.seam[1]!, f.seam[2]!), sb = dist(b.seam[1]!, b.seam[2]!);
      if (Math.abs(sf - sb) > 1) out.push({ level: 'error', code: 'SEAM_MISMATCH', message: 'Las costuras laterales no miden lo mismo.' });
    }
  }
  return out;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === 'error');
