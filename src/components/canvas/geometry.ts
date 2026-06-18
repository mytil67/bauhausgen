import type { CompositionElement } from '../../types';
import { FALLBACK_BBOX } from './render';

export interface GroupAABB {
  x: number; y: number; width: number; height: number; cx: number; cy: number;
}

/**
 * Boîte englobante absolue (coords canvas) de la sélection — l'union des boîtes des
 * éléments sélectionnés, rotation ignorée (comme `getBox` côté alignement). Sert au
 * cadre/poignées de groupe et au référentiel du déplacement/redimensionnement de groupe.
 * PURE. Renvoie `null` si rien de mesurable n'est sélectionné.
 */
export const getGroupAABB = (
  selectedIds: string[],
  elements: CompositionElement[],
  bboxes: { [key: string]: DOMRect },
): GroupAABB | null => {
  if (selectedIds.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  selectedIds.forEach((id) => {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    found = true;
    const bbox = bboxes[id] || FALLBACK_BBOX;
    const hw = (bbox.width / 2) * el.scaleX;
    const hh = (bbox.height / 2) * el.scaleY;
    minX = Math.min(minX, el.x - hw);
    maxX = Math.max(maxX, el.x + hw);
    minY = Math.min(minY, el.y - hh);
    maxY = Math.max(maxY, el.y + hh);
  });
  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
};
