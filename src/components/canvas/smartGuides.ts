import type { CompositionElement } from '../../types';
import { FALLBACK_BBOX } from './render';

export interface Measurement {
  x1: number; y1: number; x2: number; y2: number;
  value: number; kind: 'spacing' | 'equal';
}

interface GroupAABB { x: number; y: number; width: number; height: number; cx: number; cy: number; }

export interface MoveSnapParams {
  /** Position souris déjà corrigée du décalage de saisie (pos - dragOffset). */
  mouseX: number;
  mouseY: number;
  singleSelected: boolean;
  el: CompositionElement | null | undefined;
  activeId: string;
  groupAABB: GroupAABB | null;
  elements: CompositionElement[];
  bboxes: { [key: string]: DOMRect };
  selectedIds: string[];
  width: number;
  height: number;
  guides?: { x: number[]; y: number[] };
  snapToGrid?: boolean;
  gridSize: number;
}

export interface MoveSnapResult {
  guidesX: number[];
  guidesY: number[];
  measurements: Measurement[];
  /** Déplacement à appliquer à la sélection (déjà arrondi). */
  dx: number;
  dy: number;
}

/**
 * Calcule l'aimantation « smart guides » (type Figma/Canva) pour un déplacement en
 * sélection unique : aimantation d'alignement, espacement égal par chaîne, voisins,
 * et mesures à dessiner. Fonction PURE : ne touche à aucun état React — le composant
 * applique le résultat (guides + mesures + nudge). Voir CLAUDE.md « Smart guides ».
 */
export function computeMoveSnap(p: MoveSnapParams): MoveSnapResult | null {
  const {
    mouseX, mouseY, singleSelected, el, activeId, groupAABB,
    elements, bboxes, selectedIds, width, height, guides, snapToGrid, gridSize,
  } = p;
  const SNAP_DISTANCE = 8;

  // Référentiel de l'élément (ou du groupe) déplacé
  const currentBbox = singleSelected ? (bboxes[activeId] || FALLBACK_BBOX) : groupAABB;
  if (!currentBbox) return null;
  const halfW = (currentBbox.width / 2) * (singleSelected ? el?.scaleX || 1 : 1);
  const halfH = (currentBbox.height / 2) * (singleSelected ? el?.scaleY || 1 : 1);
  const currentX = singleSelected ? el!.x : groupAABB!.cx;
  const currentY = singleSelected ? el!.y : groupAABB!.cy;

  // Décalage entre l'origine (x,y) et le CENTRE VISUEL de la boîte.
  // ≈ 0 pour les formes / le texte centré et pour les groupes ; non nul pour un texte
  // ancré à gauche/droite (textAlign start/end), afin que l'aimantation reste juste.
  const cxOff = singleSelected ? (currentBbox.x + currentBbox.width / 2) * (el?.scaleX || 1) : 0;
  const cyOff = singleSelected ? (currentBbox.y + currentBbox.height / 2) * (el?.scaleY || 1) : 0;
  const currentCx = currentX + cxOff;
  const currentCy = currentY + cyOff;
  const mouseCx = mouseX + cxOff;
  const mouseCy = mouseY + cyOff;

  let newCx = mouseCx;
  let newCy = mouseCy;

  // Aimantation à la grille : on cale le bord haut-gauche de la boîte sur la grille
  // (prioritaire sur les smart guides, qui sont désactivés dans ce mode).
  if (snapToGrid && gridSize > 0) {
    const gLeft = Math.round((mouseCx - halfW) / gridSize) * gridSize;
    const gTop = Math.round((mouseCy - halfH) / gridSize) * gridSize;
    return {
      guidesX: [], guidesY: [], measurements: [],
      dx: Math.round(gLeft + halfW - currentCx),
      dy: Math.round(gTop + halfH - currentCy),
    };
  }

  // Boîtes absolues des autres éléments (non sélectionnés), en tenant compte de leur ancre
  const selectedSet = new Set(selectedIds);
  const others = elements
    .filter((o) => !selectedSet.has(o.id))
    .map((o) => {
      const ob = bboxes[o.id] || FALLBACK_BBOX;
      const left = o.x + ob.x * o.scaleX;
      const right = left + ob.width * o.scaleX;
      const top = o.y + ob.y * o.scaleY;
      const bottom = top + ob.height * o.scaleY;
      return { left, right, cx: (left + right) / 2, top, bottom, cy: (top + bottom) / 2 };
    });

  // --- 1. Aimantation d'alignement ---
  const xTargets = [0, width / 2, width, ...(guides?.x ?? []), ...others.flatMap((o) => [o.left, o.cx, o.right])];
  const yTargets = [0, height / 2, height, ...(guides?.y ?? []), ...others.flatMap((o) => [o.top, o.cy, o.bottom])];

  let bestX = SNAP_DISTANCE;
  for (const t of xTargets) {
    for (const anchor of [-halfW, 0, halfW]) {
      const d = Math.abs(mouseCx + anchor - t);
      if (d < bestX) { bestX = d; newCx = t - anchor; }
    }
  }
  let bestY = SNAP_DISTANCE;
  for (const t of yTargets) {
    for (const anchor of [-halfH, 0, halfH]) {
      const d = Math.abs(mouseCy + anchor - t);
      if (d < bestY) { bestY = d; newCy = t - anchor; }
    }
  }
  const xSnapped = bestX < SNAP_DISTANCE;
  const ySnapped = bestY < SNAP_DISTANCE;

  const box = () => ({ left: newCx - halfW, right: newCx + halfW, cx: newCx, top: newCy - halfH, bottom: newCy + halfH, cy: newCy });
  let D = box();
  const EQ = SNAP_DISTANCE * 1.5;

  // --- 2. Espacement égal HORIZONTAL ---
  let equalH = false;
  const equalSegH: { a: number; b: number }[] = [];
  let valueH = 0;
  {
    const hOverlap = others.filter((o) => o.top < D.bottom && o.bottom > D.top);
    const row = [
      ...hOverlap.map((o) => ({ left: o.left, right: o.right, cx: o.cx, isD: false })),
      { left: D.left, right: D.right, cx: D.cx, isD: true },
    ].sort((a, b) => a.cx - b.cx);
    const di = row.findIndex((r) => r.isD);
    const L = row[di - 1], R = row[di + 1], LL = row[di - 2], RR = row[di + 2];
    const gL = L ? D.left - L.right : Infinity;
    const gR = R ? R.left - D.right : Infinity;

    if (!xSnapped && L && R && gL > 0 && gR > 0 && Math.abs(gL - gR) <= EQ) {
      newCx = (L.right + R.left) / 2; D = box();
      valueH = Math.round(D.left - L.right);
      equalSegH.push({ a: L.right, b: D.left }, { a: D.right, b: R.left });
      equalH = true;
    } else if (!xSnapped && L && LL) {
      const ref = L.left - LL.right;
      if (ref > 0 && Math.abs(gL - ref) <= EQ) {
        newCx = L.right + ref + halfW; D = box();
        valueH = Math.round(ref);
        equalSegH.push({ a: LL.right, b: L.left }, { a: L.right, b: D.left });
        equalH = true;
      }
    }
    if (!equalH && !xSnapped && R && RR) {
      const ref = RR.left - R.right;
      if (ref > 0 && Math.abs(gR - ref) <= EQ) {
        newCx = R.left - ref - halfW; D = box();
        valueH = Math.round(ref);
        equalSegH.push({ a: D.right, b: R.left }, { a: R.right, b: RR.left });
        equalH = true;
      }
    }
  }

  // --- 3. Espacement égal VERTICAL ---
  let equalV = false;
  const equalSegV: { a: number; b: number }[] = [];
  let valueV = 0;
  {
    const vOverlap = others.filter((o) => o.left < D.right && o.right > D.left);
    const row = [
      ...vOverlap.map((o) => ({ top: o.top, bottom: o.bottom, cy: o.cy, isD: false })),
      { top: D.top, bottom: D.bottom, cy: D.cy, isD: true },
    ].sort((a, b) => a.cy - b.cy);
    const di = row.findIndex((r) => r.isD);
    const T = row[di - 1], B = row[di + 1], TT = row[di - 2], BB = row[di + 2];
    const gT = T ? D.top - T.bottom : Infinity;
    const gB = B ? B.top - D.bottom : Infinity;

    if (!ySnapped && T && B && gT > 0 && gB > 0 && Math.abs(gT - gB) <= EQ) {
      newCy = (T.bottom + B.top) / 2; D = box();
      valueV = Math.round(D.top - T.bottom);
      equalSegV.push({ a: T.bottom, b: D.top }, { a: D.bottom, b: B.top });
      equalV = true;
    } else if (!ySnapped && T && TT) {
      const ref = T.top - TT.bottom;
      if (ref > 0 && Math.abs(gT - ref) <= EQ) {
        newCy = T.bottom + ref + halfH; D = box();
        valueV = Math.round(ref);
        equalSegV.push({ a: TT.bottom, b: T.top }, { a: T.bottom, b: D.top });
        equalV = true;
      }
    }
    if (!equalV && !ySnapped && B && BB) {
      const ref = BB.top - B.bottom;
      if (ref > 0 && Math.abs(gB - ref) <= EQ) {
        newCy = B.top - ref - halfH; D = box();
        valueV = Math.round(ref);
        equalSegV.push({ a: D.bottom, b: B.top }, { a: B.bottom, b: BB.top });
        equalV = true;
      }
    }
  }

  // --- 4. Voisins finaux ---
  const hOverlap = others.filter((o) => o.top < D.bottom && o.bottom > D.top);
  const vOverlap = others.filter((o) => o.left < D.right && o.right > D.left);
  const leftN = hOverlap.filter((o) => o.right <= D.left + 0.5).sort((a, b) => b.right - a.right)[0];
  const rightN = hOverlap.filter((o) => o.left >= D.right - 0.5).sort((a, b) => a.left - b.left)[0];
  const topN = vOverlap.filter((o) => o.bottom <= D.top + 0.5).sort((a, b) => b.bottom - a.bottom)[0];
  const bottomN = vOverlap.filter((o) => o.top >= D.bottom - 0.5).sort((a, b) => a.top - b.top)[0];

  const guideX = new Set<number>();
  const guideY = new Set<number>();
  for (const t of xTargets) { if (Math.abs(D.left - t) < 0.5 || Math.abs(D.cx - t) < 0.5 || Math.abs(D.right - t) < 0.5) guideX.add(t); }
  for (const t of yTargets) { if (Math.abs(D.top - t) < 0.5 || Math.abs(D.cy - t) < 0.5 || Math.abs(D.bottom - t) < 0.5) guideY.add(t); }

  const m: Measurement[] = [];
  if (equalH) {
    equalSegH.forEach((s) => m.push({ x1: s.a, y1: D.cy, x2: s.b, y2: D.cy, value: valueH, kind: 'equal' }));
  } else {
    const gapL = Math.round(D.left - (leftN ? leftN.right : 0));
    const gapR = Math.round((rightN ? rightN.left : width) - D.right);
    if (gapL > 0) m.push({ x1: leftN ? leftN.right : 0, y1: D.cy, x2: D.left, y2: D.cy, value: gapL, kind: 'spacing' });
    if (gapR > 0) m.push({ x1: D.right, y1: D.cy, x2: rightN ? rightN.left : width, y2: D.cy, value: gapR, kind: 'spacing' });
  }
  if (equalV) {
    equalSegV.forEach((s) => m.push({ x1: D.cx, y1: s.a, x2: D.cx, y2: s.b, value: valueV, kind: 'equal' }));
  } else {
    const gapT = Math.round(D.top - (topN ? topN.bottom : 0));
    const gapB = Math.round((bottomN ? bottomN.top : height) - D.bottom);
    if (gapT > 0) m.push({ x1: D.cx, y1: topN ? topN.bottom : 0, x2: D.cx, y2: D.top, value: gapT, kind: 'spacing' });
    if (gapB > 0) m.push({ x1: D.cx, y1: D.bottom, x2: D.cx, y2: bottomN ? bottomN.top : height, value: gapB, kind: 'spacing' });
  }

  return {
    guidesX: [...guideX],
    guidesY: [...guideY],
    measurements: m,
    dx: Math.round(newCx - currentCx),
    dy: Math.round(newCy - currentCy),
  };
}
