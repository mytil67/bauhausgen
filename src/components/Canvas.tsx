import React, { useState, useRef, useEffect } from 'react';
import { 
  Trash2, Copy, LayoutTemplate, ArrowUp, ArrowDown, Download,
  ChevronUp, ChevronDown
} from 'lucide-react';
import type { CompositionElement, TextElement, ShapeElement, ElementBounds } from '../types';

interface CanvasProps {
  elements: CompositionElement[];
  selectedIds: string[];
  backgroundColor: string;
  width: number;
  height: number;
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectMany: (ids: string[], additive?: boolean) => void;
  onUpdateLive: (id: string, updates: Partial<CompositionElement>) => void;
  onUpdateElementsLive: (updates: Record<string, Partial<CompositionElement>>) => void;
  onNudge: (dx: number, dy: number, ids: string[]) => void;
  onRemoveSelection: (ids: string[]) => void;
  onBeginHistory: () => void;
  onBoundsChange: (bounds: ElementBounds) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onCopyStyle: (id: string) => void;
  onPasteStyle: (ids: string[]) => void;
  hasCopiedStyle: boolean;
  zoom: number;
}

interface Marquee { x1: number; y1: number; x2: number; y2: number; additive: boolean; }
interface ContextMenuState { x: number; y: number; visible: boolean; }

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragMode = 'move' | 'rotate' | ResizeHandle | null;

const FALLBACK_BBOX = { x: -50, y: -25, width: 100, height: 50 } as DOMRect;

/** Géométrie nue d'une forme, réutilisée pour le rendu, les clips et les masques
 *  (afin d'émuler l'alignement du contour intérieur/extérieur). */
const shapeGeom = (el: ShapeElement, props: React.SVGAttributes<SVGElement>): React.ReactNode => {
  const w = el.width, h = el.height;
  switch (el.type) {
    case 'rect':
    case 'line':
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} {...props} />;
    case 'circle':
      return <circle cx="0" cy="0" r={w / 2} {...props} />;
    case 'triangle':
      return <polygon points={`0,${-h / 2} ${w / 2},${h / 2} ${-w / 2},${h / 2}`} {...props} />;
    case 'semicircle':
      return <path d={`M ${-w / 2},${h / 2} A ${w / 2} ${h} 0 0 1 ${w / 2} ${h / 2} Z`} {...props} />;
    case 'quarter':
      return <path d={`M ${-w / 2},${h / 2} L ${w / 2},${h / 2} A ${w} ${h} 0 0 0 ${-w / 2},${-h / 2} Z`} {...props} />;
    case 'ring':
      return <path fillRule="evenodd" d={`M ${-w / 2},0 A ${w / 2} ${h / 2} 0 1 0 ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${-w / 2} 0 Z M ${-w / 4},0 A ${w / 4} ${h / 4} 0 1 1 ${w / 4} 0 A ${w / 4} ${h / 4} 0 1 1 ${-w / 4} 0 Z`} {...props} />;
    default:
      return null;
  }
};

/** Convertit un hex (#rgb ou #rrggbb) en rgba() avec l'alpha donné. */
const hexToRgba = (hex: string, a: number): string => {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/**
 * Rayon du cercle support pour un texte courbé.
 * - mode « arc » : rayon dérivé de la courbure (10000/curve) — courbe douce → grand rayon.
 * - mode « circle » (360°) : rayon calculé d'après la LONGUEUR du texte pour qu'il fasse
 *   exactement le tour sans étirement ni débordement (la circonférence ≈ largeur du mot).
 */
const curveRadius = (el: CompositionElement): number => {
  if (el.type !== 'text' || !el.curve) return 10;
  if (el.curveType === 'circle') {
    const est =
      Math.max(el.text.length, 1) * el.fontSize * 0.6 * ((el.fontWidth ?? 100) / 100) +
      el.text.length * (el.letterSpacing ?? 0);
    return Math.max(est / (2 * Math.PI), el.fontSize * 0.7);
  }
  return Math.max(Math.abs(10000 / el.curve), 10);
};

/** Rend un `<text>` aux glyphes nus (sans décor/contour), réutilisé pour le masque de
 *  découpe (knockout) et la cible de mesure invisible. */
const glyphText = (el: TextElement, fill: string, extra: React.SVGProps<SVGTextElement> = {}) => (
  <text
    x="0"
    y="0"
    fontSize={el.fontSize}
    fontFamily={el.fontFamily}
    fontWeight={el.fontWeight}
    fontStyle={el.italic ? 'italic' : 'normal'}
    letterSpacing={el.letterSpacing ?? 0}
    wordSpacing={el.wordSpacing ?? 0}
    textAnchor={el.textAlign ?? 'middle'}
    dominantBaseline="middle"
    fill={fill}
    style={{
      textTransform: el.textTransform ?? 'none',
      fontVariant: el.fontVariant ?? 'normal',
      fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`,
    }}
    {...extra}
  >
    {el.text}
  </text>
);

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedIds,
  backgroundColor,
  width,
  height,
  onSelect,
  onSelectMany,
  onUpdateLive,
  onUpdateElementsLive,
  onNudge,
  onRemoveSelection,
  onBeginHistory,
  onBoundsChange,
  onDuplicate,
  onCopy,
  onPaste,
  onGroup,
  onUngroup,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onCopyStyle,
  onPasteStyle,
  hasCopiedStyle,
  zoom,
}) => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0, scaleX: 1, scaleY: 1 });
  const [activeGuides, setActiveGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [measurements, setMeasurements] = useState<{ x1: number, y1: number, x2: number, y2: number, value: number, kind: 'spacing' | 'equal' }[]>([]);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
  const editInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const elementRefs = useRef<{ [key: string]: SVGGElement | null }>({});
  const [bboxes, setBboxes] = useState<{ [key: string]: DOMRect }>({});

  const selectionCount = selectedIds.length;
  const singleSelected = selectionCount === 1;
  const marqueeActive = marquee !== null;

  // Constantes compensant le zoom pour la taille des éléments d'interface UI
  const hz = 10 / zoom;         // Taille des poignées
  const ho = 5 / zoom;          // Offset des poignées
  const strokeZ = 1.5 / zoom;   // Épaisseur de trait standard UI
  const strokeGuide = 1 / zoom; // Épaisseur des guides

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
  };

  const closeContextMenu = () => {
    if (contextMenu.visible) setContextMenu({ ...contextMenu, visible: false });
  };

  const getGroupAABB = () => {
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

  const groupAABB = getGroupAABB();

  // Focus + sélection du texte quand on entre en édition
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Entrer en édition de texte (double-clic)
  const startEditing = (el: CompositionElement) => {
    if (el.type !== 'text' || el.locked) return;
    onSelect(el.id);
    onBeginHistory();
    setEditingId(el.id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIds.length === 0) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const step = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          onRemoveSelection(selectedIds);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onBeginHistory();
          onNudge(-step, 0, selectedIds);
          break;
        case 'ArrowRight':
          e.preventDefault();
          onBeginHistory();
          onNudge(step, 0, selectedIds);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onBeginHistory();
          onNudge(0, -step, selectedIds);
          break;
        case 'ArrowDown':
          e.preventDefault();
          onBeginHistory();
          onNudge(0, step, selectedIds);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, onRemoveSelection, onNudge, onBeginHistory]);

  const getPositionFromClient = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (clientX - CTM.e) / CTM.a,
      y: (clientY - CTM.f) / CTM.d,
    };
  };

  const getMousePosition = (e: React.MouseEvent | MouseEvent) => {
    return getPositionFromClient(e.clientX, e.clientY);
  };

  const getTouchPosition = (e: React.TouchEvent | TouchEvent) => {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return { x: 0, y: 0 };
    return getPositionFromClient(touch.clientX, touch.clientY);
  };

  // Démarre un cadre de sélection sur le fond du canvas
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    closeContextMenu();
    if (e.target !== svgRef.current) return;
    const pos = getMousePosition(e);
    setMarquee({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, additive: e.shiftKey });
  };

  // Touch : tap sur le fond = désélection
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    closeContextMenu();
    if (e.target !== svgRef.current) return;
    if (e.touches.length === 1) {
      onSelect(null);
    }
  };

  useEffect(() => {
    if (!marqueeActive) return;

    const move = (e: MouseEvent) => {
      const pos = getMousePosition(e);
      setMarquee((m) => (m ? { ...m, x2: pos.x, y2: pos.y } : m));
    };

    const up = () => {
      setMarquee((m) => {
        if (!m) return null;
        const minX = Math.min(m.x1, m.x2);
        const maxX = Math.max(m.x1, m.x2);
        const minY = Math.min(m.y1, m.y2);
        const maxY = Math.max(m.y1, m.y2);

        // Simple clic (cadre négligeable) : désélection
        if (maxX - minX < 3 && maxY - minY < 3) {
          if (!m.additive) onSelect(null);
          return null;
        }

        // Sélectionne tout élément dont la boîte croise le cadre
        const ids = elements
          .filter((el) => {
            if (el.locked || el.visible === false) return false;
            const bbox = bboxes[el.id] || FALLBACK_BBOX;
            const left = el.x + bbox.x * el.scaleX;
            const top = el.y + bbox.y * el.scaleY;
            const right = left + bbox.width * el.scaleX;
            const bottom = top + bbox.height * el.scaleY;
            return left < maxX && right > minX && top < maxY && bottom > minY;
          })
          .map((el) => el.id);

        onSelectMany(ids, m.additive);
        return null;
      });
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [marqueeActive, elements, bboxes, onSelect, onSelectMany]);

  useEffect(() => {
    const newBboxes: { [key: string]: DOMRect } = {};
    elements.forEach((el) => {
      const ref = elementRefs.current[el.id];
      if (ref) {
        const content = (ref.querySelector('.measure-target') || ref.querySelector('text, rect, circle, polygon, path')) as SVGGraphicsElement;
        if (content) {
          newBboxes[el.id] = content.getBBox();
        }
      }
    });
    setBboxes(newBboxes);
    onBoundsChange(newBboxes);
  }, [elements, selectedIds, onBoundsChange]);

  const handleMouseDown = (e: React.MouseEvent, el: CompositionElement) => {
    e.stopPropagation();
    if (el.locked) return;
    if (e.shiftKey) {
      onSelect(el.id, true);
      return;
    }
    if (!selectedIds.includes(el.id)) {
      onSelect(el.id);
    }
    onBeginHistory();
    setActiveId(el.id);
    setDragMode('move');
    const pos = getMousePosition(e);
    setDragOffset({ x: pos.x - el.x, y: pos.y - el.y });
  };

  // Touch : sélection + déplacement d'un élément
  const handleTouchStart = (e: React.TouchEvent, el: CompositionElement) => {
    e.stopPropagation();
    if (el.locked) return;
    if (e.touches.length !== 1) return;
    if (!selectedIds.includes(el.id)) {
      onSelect(el.id);
    }
    onBeginHistory();
    setActiveId(el.id);
    setDragMode('move');
    const pos = getTouchPosition(e);
    setDragOffset({ x: pos.x - el.x, y: pos.y - el.y });
  };

  const [initialElements, setInitialElements] = useState<CompositionElement[]>([]);

  const handleResizeMouseDown = (e: React.MouseEvent, handle: ResizeHandle, targetId?: string) => {
    e.stopPropagation();
    onBeginHistory();
    setDragMode(handle);
    const pos = getMousePosition(e);
    setDragOffset({ x: pos.x, y: pos.y });

    if (singleSelected || targetId) {
      const id = targetId || selectedIds[0];
      setActiveId(id);
      const el = elements.find(item => item.id === id);
      if (el) {
        const bbox = bboxes[el.id] || FALLBACK_BBOX;
        setInitialSize({ width: bbox.width, height: bbox.height, scaleX: el.scaleX, scaleY: el.scaleY });
      }
    } else {
      // Multi-sélection : on mémorise l'état de tous les éléments sélectionnés
      const selected = elements.filter(el => selectedIds.includes(el.id));
      setInitialElements(selected);
      const g = getGroupAABB();
      if (g) setInitialSize({ width: g.width, height: g.height, scaleX: 1, scaleY: 1 });
      setActiveId('group');
    }
  };

  const handleRotateMouseDown = (e: React.MouseEvent, targetId?: string) => {
    e.stopPropagation();
    onBeginHistory();
    setDragMode('rotate');
    const pos = getMousePosition(e);
    
    const isGroup = selectionCount > 1 && !targetId;
    const target = !isGroup ? elements.find(el => el.id === (targetId || selectedIds[0])) : null;
    const center = target ? { x: target.x, y: target.y } : (groupAABB ? { x: groupAABB.cx, y: groupAABB.cy } : { x: 0, y: 0 });
    
    // On stocke l'angle initial de la souris et le centre de rotation
    const mouseAngle = Math.atan2(pos.y - center.y, pos.x - center.x) * (180 / Math.PI);
    setDragOffset({ x: mouseAngle, y: 0 });
    setInitialSize({ width: center.x, height: center.y, scaleX: 0, scaleY: 0 });
    
    const selected = elements.filter(el => selectedIds.includes(el.id));
    setInitialElements(isGroup ? selected : (target ? [target] : []));
    setActiveId(isGroup ? 'group' : (target?.id || null));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragMode || !activeId) return;
      const el = activeId === 'group' ? null : elements.find((item) => item.id === activeId);
      if (!el && singleSelected && activeId !== 'group') return;

      const pos = getMousePosition(e);
      const SNAP_DISTANCE = 8;

      if (dragMode === 'rotate') {
        const cx = initialSize.width;
        const cy = initialSize.height;
        const startMouseAngle = dragOffset.x;
        const currentMouseAngle = Math.atan2(pos.y - cy, pos.x - cx) * (180 / Math.PI);
        let deltaAngle = currentMouseAngle - startMouseAngle;
        
        if (e.shiftKey) deltaAngle = Math.round(deltaAngle / 15) * 15;
        
        const bulkUpdates: Record<string, Partial<CompositionElement>> = {};
        initialElements.forEach((initEl) => {
          if (activeId === 'group') {
            // Rotation orbitale autour du centre du groupe
            const rad = (deltaAngle * Math.PI) / 180;
            const dx = initEl.x - cx;
            const dy = initEl.y - cy;
            bulkUpdates[initEl.id] = {
              x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
              y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
              rotation: (initEl.rotation + deltaAngle + 360) % 360
            };
          } else {
            // Rotation simple sur le centre de l'élément
            bulkUpdates[initEl.id] = {
              rotation: (initEl.rotation + deltaAngle + 360) % 360
            };
          }
        });
        onUpdateElementsLive(bulkUpdates);
        return;
      }

      if (dragMode === 'move') {
        const mouseX = pos.x - dragOffset.x;
        const mouseY = pos.y - dragOffset.y;

        // Référentiel de l'élément (ou du groupe) déplacé
        const currentBbox = singleSelected ? (bboxes[activeId] || FALLBACK_BBOX) : groupAABB;
        if (!currentBbox) return;
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
        const xTargets = [0, width / 2, width, ...others.flatMap((o) => [o.left, o.cx, o.right])];
        const yTargets = [0, height / 2, height, ...others.flatMap((o) => [o.top, o.cy, o.bottom])];

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
        setActiveGuides({ x: [...guideX], y: [...guideY] });

        const m: typeof measurements = [];
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

        setMeasurements(m);
        onNudge(Math.round(newCx - currentCx), Math.round(newCy - currentCy), selectedIds);
      }
 else {
        // Redimensionnement
        let mouseX = pos.x;
        let mouseY = pos.y;
        const snapX: number[] = [];
        const snapY: number[] = [];

        // Aimantation uniquement en sélection unique (plus lisible)
        if (singleSelected) {
          const targetsX = new Set<number>([0, width / 2, width]);
          const targetsY = new Set<number>([0, height / 2, height]);
          elements.forEach((other) => {
            if (other.id === activeId) return;
            const otherBbox = bboxes[other.id] || FALLBACK_BBOX;
            const oHalfW = (otherBbox.width / 2) * other.scaleX;
            const oHalfH = (otherBbox.height / 2) * other.scaleY;
            targetsX.add(other.x); targetsX.add(other.x - oHalfW); targetsX.add(other.x + oHalfW);
            targetsY.add(other.y); targetsY.add(other.y - oHalfH); targetsY.add(other.y + oHalfH);
          });
          targetsX.forEach((tx) => { if (Math.abs(mouseX - tx) < SNAP_DISTANCE) { mouseX = tx; snapX.push(tx); } });
          targetsY.forEach((ty) => { if (Math.abs(mouseY - ty) < SNAP_DISTANCE) { mouseY = ty; snapY.push(ty); } });
        }

        const dx = mouseX - dragOffset.x;
        const dy = mouseY - dragOffset.y;

        setActiveGuides({ x: snapX, y: snapY });
        setMeasurements([]);

        let multX = 0; let multY = 0;
        if (dragMode.includes('e')) multX = 1;
        if (dragMode.includes('w')) multX = -1;
        if (dragMode.includes('s')) multY = 1;
        if (dragMode.includes('n')) multY = -1;

        if (singleSelected) {
          if (!el) return;
          if (el.type === 'text') {
            const ratioX = 1 + (dx * multX * 2) / Math.max(1, initialSize.width);
            const ratioY = 1 + (dy * multY * 2) / Math.max(1, initialSize.height);
            const updates: Partial<CompositionElement> = {};
            if (multX !== 0) updates.scaleX = Math.max(0.1, initialSize.scaleX * ratioX);
            if (multY !== 0) updates.scaleY = Math.max(0.1, initialSize.scaleY * ratioY);
            onUpdateLive(activeId, updates);
          } else if (el.type === 'circle') {
            const delta = Math.max(dx * multX, dy * multY);
            if (multX !== 0 || multY !== 0) {
              const size = Math.max(10, initialSize.width + delta * 2);
              onUpdateLive(activeId, { width: size, height: size });
            }
          } else {
            const updates: { width?: number; height?: number } = {};
            if (multX !== 0) updates.width = Math.max(10, initialSize.width + dx * multX * 2);
            if (multY !== 0) updates.height = Math.max(10, initialSize.height + dy * multY * 2);
            onUpdateLive(activeId, updates);
          }
        } else {
          // Redimensionnement de groupe
          const g = initialSize;
          const ratioX = multX !== 0 ? Math.max(0.01, 1 + (dx * multX * 2) / Math.max(1, g.width)) : 1;
          const ratioY = multY !== 0 ? Math.max(0.01, 1 + (dy * multY * 2) / Math.max(1, g.height)) : 1;

          // Centre du groupe au début du drag
          const gcx = dragOffset.x - (multX * g.width) / 2;
          const gcy = dragOffset.y - (multY * g.height) / 2;

          const bulkUpdates: Record<string, Partial<CompositionElement>> = {};
          initialElements.forEach((initEl) => {
            const updates: Partial<CompositionElement> = {
              x: gcx + (initEl.x - gcx) * ratioX,
              y: gcy + (initEl.y - gcy) * ratioY,
            };

            if (initEl.type === 'text') {
              updates.scaleX = initEl.scaleX * ratioX;
              updates.scaleY = initEl.scaleY * ratioY;
            } else {
              (updates as any).width = (initEl as any).width * ratioX;
              (updates as any).height = (initEl as any).height * ratioY;
            }
            bulkUpdates[initEl.id] = updates;
          });
          onUpdateElementsLive(bulkUpdates);
        }
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
      setActiveId(null);
      setActiveGuides({ x: [], y: [] });
      setMeasurements([]);
    };

    // Touch move/end handlers — réutilise la logique mouse via clientX/clientY
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      // Crée un objet synthétique compatible avec getMousePosition
      const synth = { clientX: touch.clientX, clientY: touch.clientY, shiftKey: false } as MouseEvent;
      handleMouseMove(synth);
    };

    const handleTouchEnd = () => {
      handleMouseUp();
    };

    if (dragMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [dragMode, activeId, dragOffset, onUpdateLive, onUpdateElementsLive, onNudge, elements, initialSize, width, height, bboxes, selectedIds, singleSelected, initialElements]);

  return (
    <div className="w-full h-full overflow-auto relative bg-transparent flex p-4 md:p-12" style={{ touchAction: 'none' }}>
      <div 
        className="m-auto flex-shrink-0 origin-center transition-transform duration-75 ease-out"
        style={{ transform: `scale(${zoom})`, width, height }}
      >
        <svg
          ref={svgRef}
          id="bauhaus-svg"
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ backgroundColor }}
          className="shadow-2xl shadow-gray-300/50 cursor-default ring-1 ring-gray-900/5 block"
          onMouseDown={handleCanvasMouseDown}
          onTouchStart={handleCanvasTouchStart}
          onContextMenu={handleContextMenu}
          onClick={closeContextMenu}
        >
        <defs>
          {elements.map((el) => {
            const defs: React.ReactNode[] = [];
            
            // Filtre d'ombre
            if (el.shadowBlur !== 0 || el.shadowOpacity !== 0) {
              defs.push(
                <filter key={`shadow-${el.id}`} id={`filter-shadow-${el.id}`} x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation={el.shadowBlur ?? 0} />
                  <feOffset dx={el.shadowOffsetX ?? 0} dy={el.shadowOffsetY ?? 0} result="offsetblur" />
                  <feFlood floodColor={el.shadowColor ?? '#000000'} floodOpacity={el.shadowOpacity ?? 0.5} />
                  <feComposite in2="offsetblur" operator="in" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              );
            }

            // Dégradé
            if (el.gradient) {
              const { type, colors, rotation } = el.gradient;
              const id = `gradient-${el.id}`;
              if (type === 'linear') {
                const rad = (rotation * Math.PI) / 180;
                const x1 = 50 - Math.cos(rad) * 50;
                const y1 = 50 - Math.sin(rad) * 50;
                const x2 = 50 + Math.cos(rad) * 50;
                const y2 = 50 + Math.sin(rad) * 50;
                defs.push(
                  <linearGradient key={id} id={id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
                    {colors.map((c, i) => <stop key={i} offset={`${c.offset * 100}%`} stopColor={c.color} stopOpacity={c.opacity} />)}
                  </linearGradient>
                );
              } else {
                defs.push(
                  <radialGradient key={id} id={id}>
                    {colors.map((c, i) => <stop key={i} offset={`${c.offset * 100}%`} stopColor={c.color} stopOpacity={c.opacity} />)}
                  </radialGradient>
                );
              }
            }

            // Motif (rayures / points / grille / damier)
            if (el.pattern) {
              const { type, color, background, scale, angle } = el.pattern;
              const s = Math.max(4, 24 * (scale || 1));
              const t = s / 6; // épaisseur des traits
              const id = `pattern-${el.id}`;
              const bg = background && background !== 'transparent'
                ? <rect width={s} height={s} fill={background} />
                : null;
              let motif: React.ReactNode;
              if (type === 'stripes') {
                motif = <rect width={s} height={s / 2} fill={color} />;
              } else if (type === 'dots') {
                motif = <circle cx={s / 2} cy={s / 2} r={s / 4} fill={color} />;
              } else if (type === 'grid') {
                motif = <><rect width={s} height={t} fill={color} /><rect width={t} height={s} fill={color} /></>;
              } else { // checker
                motif = <><rect width={s / 2} height={s / 2} fill={color} /><rect x={s / 2} y={s / 2} width={s / 2} height={s / 2} fill={color} /></>;
              }
              defs.push(
                <pattern key={id} id={id} patternUnits="userSpaceOnUse" width={s} height={s} patternTransform={`rotate(${angle || 0})`}>
                  {bg}
                  {motif}
                </pattern>
              );
            }

            // Alignement du contour (formes) : clip pour l'intérieur, masque pour l'extérieur
            if (el.type !== 'text' && (el.strokeWidth ?? 0) > 0 && el.strokeAlign && el.strokeAlign !== 'center') {
              if (el.strokeAlign === 'inside') {
                defs.push(
                  <clipPath key={`sc-${el.id}`} id={`shapeclip-${el.id}`}>
                    {shapeGeom(el, {})}
                  </clipPath>
                );
              } else {
                const m = Math.max(el.width, el.height) + (el.strokeWidth ?? 0) * 4 + 20;
                defs.push(
                  <mask key={`sm-${el.id}`} id={`shapemask-${el.id}`} maskUnits="userSpaceOnUse" x={-m} y={-m} width={2 * m} height={2 * m}>
                    <rect x={-m} y={-m} width={2 * m} height={2 * m} fill="white" />
                    {shapeGeom(el, { fill: 'black' })}
                  </mask>
                );
              }
            }

            // Masque de découpe (knockout) : plaque pleine, lettres en trou
            if (el.type === 'text' && el.knockout && !el.curve) {
              const b = bboxes[el.id] || FALLBACK_BBOX;
              const pad = el.bgPadding ?? 16;
              defs.push(
                <mask
                  key={`ko-${el.id}`}
                  id={`knockout-${el.id}`}
                  maskUnits="userSpaceOnUse"
                  x={b.x - pad - 8}
                  y={b.y - pad - 8}
                  width={b.width + pad * 2 + 16}
                  height={b.height + pad * 2 + 16}
                >
                  <rect x={b.x - pad} y={b.y - pad} width={b.width + pad * 2} height={b.height + pad * 2} rx={el.bgRadius ?? 0} fill="white" />
                  {glyphText(el, 'black')}
                </mask>
              );
            }

            // Path pour texte courbé (arc de cercle ou cercle complet)
            if (el.type === 'text' && el.curve && el.curve !== 0) {
              const curve = el.curve;
              const r = curveRadius(el);
              const sweep = (curve > 0) !== !!el.curveInvert ? 1 : 0;
              
              // On crée systématiquement un cercle complet dont l'apex (le sommet ou le creux) est exactement à (0,0).
              // Cela évite de devoir calculer la largeur du texte (w) et empêche tout rognage (clipping) !
              // startOffset="50%" de <textPath> placera toujours le centre du texte à (0,0).
              let pathData = '';
              if (sweep) {
                // Sourire (curve > 0) : Centre à (0, r). Apex haut à (0,0). Départ en bas à (0, 2r).
                pathData = `M 0,${2 * r} A ${r},${r} 0 0,1 0,0 A ${r},${r} 0 0,1 0,${2 * r}`;
              } else {
                // Triste (curve < 0) : Centre à (0, -r). Apex bas à (0,0). Départ en haut à (0, -2r).
                pathData = `M 0,${-2 * r} A ${r},${r} 0 0,0 0,0 A ${r},${r} 0 0,0 0,${-2 * r}`;
              }
              defs.push(<path key={`path-${el.id}`} id={`path-${el.id}`} d={pathData} />);
            }

            return defs;
          })}
        </defs>

        {elements.map((el) => {
          if (el.visible === false) return null;
          const isSelected = selectedIds.includes(el.id);
          const showHandles = singleSelected && isSelected && editingId !== el.id;
          const outerTransform = `translate(${el.x}, ${el.y}) rotate(${el.rotation}) skewX(${el.skewX ?? 0}) skewY(${el.skewY ?? 0})`;
          const innerTransform = `scale(${el.scaleX}, ${el.scaleY})`;
          const bbox = bboxes[el.id] || FALLBACK_BBOX;

          // La boîte de sélection englobe la plaque (badge/découpe) ET la partie du contour
          // qui dépasse de la géométrie (getBBox ignore le stroke), pour que les poignées
          // entourent toujours le rendu complet — sans manip manuelle.
          const plateActive = el.type === 'text' && !el.curve && (el.bgEnabled || el.knockout);
          const bgPad = plateActive ? (el.bgPadding ?? (el.type === 'text' && el.knockout ? 16 : 10)) : 0;
          const strokeW = el.strokeWidth ?? 0;
          const strokeMargin = strokeW > 0
            ? (el.strokeAlign === 'outside' ? strokeW : el.strokeAlign === 'inside' ? 0 : strokeW / 2)
            : 0;
          const selPad = Math.max(bgPad, strokeMargin);
          const sw = (bbox.width + selPad * 2) * el.scaleX;
          const sh = (bbox.height + selPad * 2) * el.scaleY;
          const sx = (bbox.x - selPad) * el.scaleX;
          const sy = (bbox.y - selPad) * el.scaleY;

          const filterUrl = (el.shadowBlur && el.shadowBlur > 0) || (el.shadowOpacity && el.shadowOpacity > 0)
            ? `url(#filter-shadow-${el.id})`
            : undefined;

          const fill = el.noFill
            ? 'none'
            : el.pattern
            ? `url(#pattern-${el.id})`
            : el.gradient ? `url(#gradient-${el.id})` : el.color;


          // Ombres de texte multiples (CSS text-shadow), distinct du filtre drop-shadow
          const textShadowCss = el.type === 'text' && el.textShadows && el.textShadows.length
            ? el.textShadows.map((s) => `${s.x}px ${s.y}px ${s.blur}px ${hexToRgba(s.color, s.opacity ?? 1)}`).join(', ')
            : undefined;

          return (
            <g
              key={el.id}
              ref={(ref) => { elementRefs.current[el.id] = ref; }}
              transform={outerTransform}
              onMouseDown={(e) => handleMouseDown(e, el)}
              onTouchStart={(e) => handleTouchStart(e, el)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => { e.stopPropagation(); startEditing(el); }}
              style={{ 
                cursor: dragMode === 'move' && isSelected ? 'grabbing' : 'grab', 
                opacity: el.opacity,
                mixBlendMode: el.blendMode as React.CSSProperties['mixBlendMode'] ?? 'normal',
                filter: filterUrl
              }}
            >
              <g transform={innerTransform}>
                {el.type === 'text' && editingId !== el.id && (
                  el.knockout && !el.curve ? (
                    <>
                      {/* Texte invisible pour la mesure (le bbox sert à dimensionner la plaque) */}
                      {glyphText(el, 'none', { className: 'measure-target', 'aria-hidden': true })}
                      {/* Plaque pleine, lettres découpées via le masque */}
                      <rect
                        x={(bboxes[el.id]?.x ?? 0) - (el.bgPadding ?? 16)}
                        y={(bboxes[el.id]?.y ?? 0) - (el.bgPadding ?? 16)}
                        width={(bboxes[el.id]?.width ?? 0) + (el.bgPadding ?? 16) * 2}
                        height={(bboxes[el.id]?.height ?? 0) + (el.bgPadding ?? 16) * 2}
                        rx={el.bgRadius ?? 0}
                        ry={el.bgRadius ?? 0}
                        fill={fill}
                        mask={`url(#knockout-${el.id})`}
                      />
                    </>
                  ) : el.maxWidth && el.maxWidth > 0 && (!el.curve || el.curve === 0) ? (
                    <foreignObject
                      x={-el.maxWidth / 2} 
                      y={-(el.fontSize * (el.lineHeight ?? 1.2) * 2) / 2} 
                      width={el.maxWidth} 
                      height={1000}
                      className="select-none pointer-events-none"
                    >
                      <div style={{
                        color: el.color,
                        background: el.gradient ? (
                          el.gradient.type === 'linear' 
                            ? `linear-gradient(${el.gradient.rotation}deg, ${el.gradient.colors.map(c => `${c.color} ${c.offset * 100}%`).join(', ')})`
                            : `radial-gradient(circle, ${el.gradient.colors.map(c => `${c.color} ${c.offset * 100}%`).join(', ')})`
                        ) : 'none',
                        WebkitBackgroundClip: el.gradient ? 'text' : 'none',
                        WebkitTextFillColor: el.gradient ? 'transparent' : 'initial',
                        fontSize: el.fontSize,
                        fontFamily: el.fontFamily,
                        fontWeight: el.fontWeight as any,
                        fontStyle: el.italic ? 'italic' : 'normal',
                        lineHeight: el.lineHeight ?? 1.2,
                        letterSpacing: (el.letterSpacing ?? 0) + 'px',
                        textAlign: (el.textAlign === 'middle' ? 'center' : el.textAlign === 'end' ? 'right' : 'left') as any,
                        textTransform: el.textTransform ?? 'none',
                        fontVariant: el.fontVariant ?? 'normal',
                        wordSpacing: (el.wordSpacing ?? 0) + 'px',
                        writingMode: el.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                        textDecoration: el.textDecoration && el.textDecoration !== 'none'
                          ? `${el.textDecoration} ${el.textDecorationStyle ?? 'solid'} ${el.textDecorationColor ?? el.color}`
                          : 'none',
                        WebkitTextStroke: el.strokeWidth && el.strokeWidth > 0 ? `${el.strokeWidth}px ${el.strokeColor}` : 'none',
                        textShadow: textShadowCss,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`
                      }}>
                        {el.text}
                      </div>
                    </foreignObject>
                  ) : (
                    <>
                      {el.bgEnabled && !el.curve && (
                        <rect
                          x={(bboxes[el.id]?.x ?? 0) - (el.bgPadding ?? 10)}
                          y={(bboxes[el.id]?.y ?? 0) - (el.bgPadding ?? 10)}
                          width={(bboxes[el.id]?.width ?? 0) + (el.bgPadding ?? 10) * 2}
                          height={(bboxes[el.id]?.height ?? 0) + (el.bgPadding ?? 10) * 2}
                          fill={el.bgColor ?? '#000000'}
                          rx={el.bgRadius ?? 0}
                          ry={el.bgRadius ?? 0}
                        />
                      )}
                      <text
                        x="0"
                        y="0"
                        fontSize={el.fontSize}
                        fontFamily={el.fontFamily}
                        fontWeight={el.fontWeight}
                        fontStyle={el.italic ? 'italic' : 'normal'}
                        letterSpacing={el.letterSpacing ?? 0}
                        wordSpacing={el.wordSpacing ?? 0}
                        fill={fill}
                        stroke={el.strokeWidth && el.strokeWidth > 0 ? el.strokeColor : 'none'}
                        strokeWidth={el.strokeWidth && el.strokeWidth > 0 ? (el.strokeAlign === 'outside' ? el.strokeWidth * 2 : el.strokeWidth) : 0}
                        strokeLinejoin="round"
                        textAnchor={el.textAlign ?? 'middle'}
                        dominantBaseline="middle"
                        className="select-none measure-target"
                        style={{
                          paintOrder: el.strokeAlign === 'outside' ? 'stroke' : undefined,
                          textTransform: el.textTransform ?? 'none',
                          fontVariant: el.fontVariant ?? 'normal',
                          writingMode: el.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                          textDecoration: el.textDecoration && el.textDecoration !== 'none'
                            ? `${el.textDecoration} ${el.textDecorationStyle ?? 'solid'} ${el.textDecorationColor ?? el.color}`
                            : 'none',
                          textShadow: textShadowCss,
                          fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`
                        }}
                      >
                        {el.curve && el.curve !== 0 && el.writingMode !== 'vertical' ? (
                          <textPath 
                            href={`#path-${el.id}`} 
                            startOffset="50%" 
                            textAnchor="middle"
                            {...(el.curveType === 'circle' ? {
                              textLength: Math.PI * 2 * curveRadius(el),
                              lengthAdjust: "spacing"
                            } : {})}
                          >
                            {el.text}
                          </textPath>
                        ) : el.text}
                      </text>
                    </>
                  )
                )}
                {el.type === 'text' && editingId === el.id && (() => {
                  const w = Math.max((bboxes[el.id]?.width ?? 200) + 40, 60);
                  const h = el.fontSize * (el.lineHeight ?? 1.4);
                  return (
                    <foreignObject x={-w / 2} y={-h / 2} width={w} height={h} style={{ overflow: 'visible' }}>
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input
                          ref={editInputRef}
                          value={el.text}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => onUpdateLive(el.id, { text: e.target.value })}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                          }}
                          style={{
                            width: '100%', textAlign: (el.textAlign === 'start' ? 'left' : el.textAlign === 'end' ? 'right' : 'center') as React.CSSProperties['textAlign'],
                            padding: 0, margin: 0,
                            border: 'none', outline: '1px dashed #3b82f6',
                            background: 'rgba(255,255,255,0.5)',
                            fontSize: el.fontSize,
                            fontFamily: el.fontFamily,
                            fontWeight: el.fontWeight as React.CSSProperties['fontWeight'],
                            fontStyle: el.italic ? 'italic' : 'normal',
                            letterSpacing: el.letterSpacing ?? 0,
                            textTransform: el.textTransform ?? 'none',
                            color: el.color,
                            lineHeight: el.lineHeight ?? 1.2,
                          }}
                        />
                      </div>
                    </foreignObject>
                  );
                })()}
                {el.type !== 'text' && (() => {
                  const w = el.strokeWidth ?? 0;
                  const align = el.strokeAlign ?? 'center';
                  const strokeProps = w > 0
                    ? { stroke: el.strokeColor ?? '#000000', strokeWidth: align === 'center' ? w : w * 2, strokeLinejoin: 'round' as const }
                    : null;
                  // Pas de contour, ou contour centré : un seul tracé suffit
                  if (!strokeProps || align === 'center') {
                    return shapeGeom(el, { fill, ...(strokeProps ?? {}) });
                  }
                  // Intérieur / extérieur : fond + contour double largeur clippé/masqué
                  const clipMask = align === 'inside'
                    ? { clipPath: `url(#shapeclip-${el.id})` }
                    : { mask: `url(#shapemask-${el.id})` };
                  return (
                    <>
                      {shapeGeom(el, { fill })}
                      {shapeGeom(el, { fill: 'none', ...strokeProps, ...clipMask })}
                    </>
                  );
                })()}
              </g>

              {/* Contour de sélection (toujours visible si sélectionné) */}
              {isSelected && (
                <rect x={sx - ho} y={sy - ho} width={sw + hz} height={sh + hz} fill="none" stroke="#3b82f6" strokeWidth={strokeZ} strokeDasharray={showHandles ? '4' : '2'} className="pointer-events-none export-ignore" />
              )}

              {/* Poignées (sélection unique uniquement) */}
              {showHandles && (
                <g className="export-ignore">
                  {/* Poignée de rotation */}
                  <line x1={sx + sw / 2} y1={sy - ho} x2={sx + sw / 2} y2={sy - 28 / zoom} stroke="#3b82f6" strokeWidth={strokeZ} className="pointer-events-none" />
                  <circle cx={sx + sw / 2} cy={sy - 32 / zoom} r={6 / zoom} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} style={{ cursor: 'grab' }} onMouseDown={(e) => handleRotateMouseDown(e, el.id)} />

                  {/* Coins */}
                  <rect x={sx - hz} y={sy - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nwse-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'nw', el.id)} />
                  <rect x={sx + sw} y={sy - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nesw-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'ne', el.id)} />
                  <rect x={sx - hz} y={sy + sh} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nesw-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'sw', el.id)} />
                  <rect x={sx + sw} y={sy + sh} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nwse-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'se', el.id)} />

                  {/* Milieux */}
                  <rect x={sx + sw / 2 - ho} y={sy - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ns-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'n', el.id)} />
                  <rect x={sx + sw / 2 - ho} y={sy + sh} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ns-resize" onMouseDown={(e) => handleResizeMouseDown(e, 's', el.id)} />
                  <rect x={sx - hz} y={sy + sh / 2 - ho} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ew-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'w', el.id)} />
                  <rect x={sx + sw} y={sy + sh / 2 - ho} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ew-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'e', el.id)} />
                </g>
              )}
            </g>
          );
        })}

        {/* Poignées de groupe (multi-sélection) */}
        {!singleSelected && groupAABB && (
          <g className="export-ignore">
            <rect
              x={groupAABB.x - ho}
              y={groupAABB.y - ho}
              width={groupAABB.width + hz}
              height={groupAABB.height + hz}
              fill="none"
              stroke="#ec4899"
              strokeWidth={2 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              className="pointer-events-none"
            />
            {/* Coins */}
            <rect x={groupAABB.x - hz} y={groupAABB.y - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nwse-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
            <rect x={groupAABB.x + groupAABB.width} y={groupAABB.y - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nesw-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
            <rect x={groupAABB.x - hz} y={groupAABB.y + groupAABB.height} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nesw-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
            <rect x={groupAABB.x + groupAABB.width} y={groupAABB.y + groupAABB.height} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nwse-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
            {/* Milieux */}
            <rect x={groupAABB.x + groupAABB.width / 2 - ho} y={groupAABB.y - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ns-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
            <rect x={groupAABB.x + groupAABB.width / 2 - ho} y={groupAABB.y + groupAABB.height} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ns-resize" onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
            <rect x={groupAABB.x - hz} y={groupAABB.y + groupAABB.height / 2 - ho} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ew-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
            <rect x={groupAABB.x + groupAABB.width} y={groupAABB.y + groupAABB.height / 2 - ho} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ew-resize" onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />

            {/* Rotation de groupe */}
            <line x1={groupAABB.x + groupAABB.width / 2} y1={groupAABB.y - ho} x2={groupAABB.x + groupAABB.width / 2} y2={groupAABB.y - 28 / zoom} stroke="#3b82f6" strokeWidth={strokeZ} className="pointer-events-none" />
            <circle cx={groupAABB.x + groupAABB.width / 2} cy={groupAABB.y - 32 / zoom} r={6 / zoom} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} style={{ cursor: 'grab' }} onMouseDown={(e) => handleRotateMouseDown(e)} />
          </g>
        )}

        {/* Overlay : guides & mesures */}
        <g className="pointer-events-none export-ignore">
          {/* Lignes d'alignement (rouge, nettes) */}
          {activeGuides.x.map((x, i) => <line key={`gx-${i}`} x1={x} y1="0" x2={x} y2={height} stroke="#f43f5e" strokeWidth={strokeGuide} />)}
          {activeGuides.y.map((y, i) => <line key={`gy-${i}`} x1="0" y1={y} x2={width} y2={y} stroke="#f43f5e" strokeWidth={strokeGuide} />)}

          {/* Badges d'espacement (bleu) / espacement égal (rose) */}
          {measurements.map((m, i) => {
            const isVertical = m.x1 === m.x2;
            const color = m.kind === 'equal' ? '#ec4899' : '#ec4899'; // On utilise le rose partout pour un look Canva/Figma cohérent
            const labelW = Math.max(20, String(m.value).length * 6 + 10) / zoom;
            const labelH = 14 / zoom;
            const mx = (m.x1 + m.x2) / 2;
            const my = (m.y1 + m.y2) / 2;
            const a = 4 / zoom; // taille des têtes de flèche
            
            // On centre le label sur la ligne
            const labelCx = mx;
            const labelCy = my;

            return (
              <g key={`m-${i}`}>
                {/* Zone d'espacement (très subtile) */}
                {m.kind === 'equal' && (
                  <rect
                    x={isVertical ? m.x1 - 10 / zoom : Math.min(m.x1, m.x2)}
                    y={isVertical ? Math.min(m.y1, m.y2) : m.y1 - 10 / zoom}
                    width={isVertical ? 20 / zoom : Math.abs(m.x2 - m.x1)}
                    height={isVertical ? Math.abs(m.y2 - m.y1) : 20 / zoom}
                    fill={color}
                    opacity="0.05"
                  />
                )}
                
                {/* Ligne principale */}
                <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={color} strokeWidth={strokeGuide} />
                
                {/* Têtes de flèches (double flèche) */}
                {isVertical ? (
                  <>
                    <path d={`M${m.x1 - a},${m.y1 + a} L${m.x1},${m.y1} L${m.x1 + a},${m.y1 + a}`} fill="none" stroke={color} strokeWidth={strokeGuide} />
                    <path d={`M${m.x2 - a},${m.y2 - a} L${m.x2},${m.y2} L${m.x2 + a},${m.y2 - a}`} fill="none" stroke={color} strokeWidth={strokeGuide} />
                  </>
                ) : (
                  <>
                    <path d={`M${m.x1 + a},${m.y1 - a} L${m.x1},${m.y1} L${m.x1 + a},${m.y1 + a}`} fill="none" stroke={color} strokeWidth={strokeGuide} />
                    <path d={`M${m.x2 - a},${m.y2 - a} L${m.x2},${m.y2} L${m.x2 - a},${m.y2 + a}`} fill="none" stroke={color} strokeWidth={strokeGuide} />
                  </>
                )}

                {/* Petit carré (badge) avec la valeur */}
                <rect 
                  x={labelCx - labelW / 2} 
                  y={labelCy - labelH / 2} 
                  width={labelW} 
                  height={labelH} 
                  fill={color} 
                  rx={2 / zoom} 
                />
                <text 
                  x={labelCx} 
                  y={labelCy} 
                  fontSize={8 / zoom} 
                  fontWeight="bold" 
                  fill="white" 
                  textAnchor="middle" 
                  dominantBaseline="central" 
                  className="select-none font-sans"
                >
                  {m.value}
                </text>
              </g>
            );
          })}
        </g>

        {/* Cadre de sélection (rubber-band) — très discret */}
        {marquee && (
          <rect
            x={Math.min(marquee.x1, marquee.x2)}
            y={Math.min(marquee.y1, marquee.y2)}
            width={Math.abs(marquee.x2 - marquee.x1)}
            height={Math.abs(marquee.y2 - marquee.y1)}
            fill="rgba(236, 72, 153, 0.10)"
            stroke="#ec4899"
            strokeWidth={2 / zoom}
            strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            className="pointer-events-none export-ignore"
          />
        )}
      </svg>
      </div>

      {/* Menu Contextuel (Clic droit) */}
      {contextMenu.visible && (
        <div 
          className="fixed z-[9999] bg-white border border-gray-200 shadow-xl rounded-lg overflow-hidden py-1.5 w-52 flex flex-col font-sans"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {selectionCount > 0 ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 mb-1">Sélection ({selectionCount})</div>
              {selectionCount >= 2 && (
                <button onClick={() => { onGroup(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                  <Copy size={14} className="opacity-60" /> Grouper <span className="ml-auto text-[10px] opacity-40">Ctrl+G</span>
                </button>
              )}
              {selectedIds.some(id => elements.find(e => e.id === id)?.groupId) && (
                <button onClick={() => { onUngroup(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                  <LayoutTemplate size={14} className="opacity-60" /> Dégrouper <span className="ml-auto text-[10px] opacity-40">Ctrl+Maj+G</span>
                </button>
              )}
              <div className="h-px bg-gray-100 my-1 mx-2" />
              <button onClick={() => { onDuplicate(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                <Copy size={14} className="opacity-60" /> Dupliquer <span className="ml-auto text-[10px] opacity-40">Ctrl+D</span>
              </button>
              <button onClick={() => { onCopy(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                <Copy size={14} className="opacity-60" /> Copier <span className="ml-auto text-[10px] opacity-40">Ctrl+C</span>
              </button>
              {selectionCount === 1 && (
                <button onClick={() => { onCopyStyle(selectedIds[0]); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                  <Copy size={14} className="opacity-60" /> Copier la mise en forme <span className="ml-auto text-[10px] opacity-40">Ctrl+Alt+C</span>
                </button>
              )}
              {hasCopiedStyle && (
                <button onClick={() => { onPasteStyle(selectedIds); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                  <Download size={14} className="opacity-60" /> Coller la mise en forme <span className="ml-auto text-[10px] opacity-40">Ctrl+Alt+V</span>
                </button>
              )}
              <div className="h-px bg-gray-100 my-1 mx-2" />
              <button onClick={() => { onBringToFront(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                <ArrowUp size={14} className="opacity-60" /> Tout devant
              </button>
              <button onClick={() => { onBringForward(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                <ChevronUp size={14} className="opacity-60" /> Avancer
              </button>
              <button onClick={() => { onSendBackward(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                <ChevronDown size={14} className="opacity-60" /> Reculer
              </button>
              <button onClick={() => { onSendToBack(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                <ArrowDown size={14} className="opacity-60" /> Tout derrière
              </button>
              <div className="h-px bg-gray-100 my-1 mx-2" />
              <button onClick={() => { onRemoveSelection(selectedIds); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-red-50 hover:text-red-700 text-xs text-red-600 font-medium transition-colors">
                <Trash2 size={14} className="opacity-60" /> Supprimer <span className="ml-auto text-[10px] opacity-40">Suppr</span>
              </button>
            </>
          ) : (
            <button onClick={() => { onPaste(); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
              <Download size={14} className="opacity-60" /> Coller ici <span className="ml-auto text-[10px] opacity-40">Ctrl+V</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
