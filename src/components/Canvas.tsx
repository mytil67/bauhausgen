import React, { useState, useRef, useEffect } from 'react';
import { 
  Trash2, Copy, LayoutTemplate, ArrowUp, ArrowDown, Download,
  ChevronUp, ChevronDown
} from 'lucide-react';
import type { CompositionElement, ElementBounds } from '../types';

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

  const getMousePosition = (e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d,
    };
  };

  // Démarre un cadre de sélection sur le fond du canvas
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    closeContextMenu();
    if (e.target !== svgRef.current) return;
    const pos = getMousePosition(e);
    setMarquee({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, additive: e.shiftKey });
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
        const content = ref.querySelector('text, rect, circle, polygon, path') as SVGGraphicsElement;
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
    if (el.locked) return; // élément verrouillé : non manipulable au canvas
    // Shift+clic : (dé)sélection additive, sans démarrer de déplacement
    if (e.shiftKey) {
      onSelect(el.id, true);
      return;
    }
    // Clic simple sur un élément déjà dans la sélection multiple : on garde le groupe
    if (!selectedIds.includes(el.id)) {
      onSelect(el.id);
    }
    onBeginHistory();
    setActiveId(el.id);
    setDragMode('move');
    const pos = getMousePosition(e);
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

        let newX = mouseX;
        let newY = mouseY;

        // Référentiel de l'élément (ou du groupe) déplacé
        const currentBbox = singleSelected ? (bboxes[activeId] || FALLBACK_BBOX) : groupAABB;
        if (!currentBbox) return;
        const halfW = (currentBbox.width / 2) * (singleSelected ? el?.scaleX || 1 : 1);
        const halfH = (currentBbox.height / 2) * (singleSelected ? el?.scaleY || 1 : 1);
        const currentX = singleSelected ? el!.x : groupAABB!.cx;
        const currentY = singleSelected ? el!.y : groupAABB!.cy;

        // Boîtes absolues des autres éléments (non sélectionnés)
        const selectedSet = new Set(selectedIds);
        const others = elements
          .filter((o) => !selectedSet.has(o.id))
          .map((o) => {
            const ob = bboxes[o.id] || FALLBACK_BBOX;
            const ohw = (ob.width / 2) * o.scaleX;
            const ohh = (ob.height / 2) * o.scaleY;
            return { left: o.x - ohw, right: o.x + ohw, cx: o.x, top: o.y - ohh, bottom: o.y + ohh, cy: o.y };
          });

        // --- 1. Aimantation d'alignement ---
        const xTargets = [0, width / 2, width, ...others.flatMap((o) => [o.left, o.cx, o.right])];
        const yTargets = [0, height / 2, height, ...others.flatMap((o) => [o.top, o.cy, o.bottom])];

        let bestX = SNAP_DISTANCE;
        for (const t of xTargets) {
          for (const anchor of [-halfW, 0, halfW]) {
            const d = Math.abs(mouseX + anchor - t);
            if (d < bestX) { bestX = d; newX = t - anchor; }
          }
        }
        let bestY = SNAP_DISTANCE;
        for (const t of yTargets) {
          for (const anchor of [-halfH, 0, halfH]) {
            const d = Math.abs(mouseY + anchor - t);
            if (d < bestY) { bestY = d; newY = t - anchor; }
          }
        }
        const xSnapped = bestX < SNAP_DISTANCE;
        const ySnapped = bestY < SNAP_DISTANCE;

        const box = () => ({ left: newX - halfW, right: newX + halfW, cx: newX, top: newY - halfH, bottom: newY + halfH, cy: newY });
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
            newX = (L.right + R.left) / 2; D = box();
            valueH = Math.round(D.left - L.right);
            equalSegH.push({ a: L.right, b: D.left }, { a: D.right, b: R.left });
            equalH = true;
          } else if (!xSnapped && L && LL) {
            const ref = L.left - LL.right;
            if (ref > 0 && Math.abs(gL - ref) <= EQ) {
              newX = L.right + ref + halfW; D = box();
              valueH = Math.round(ref);
              equalSegH.push({ a: LL.right, b: L.left }, { a: L.right, b: D.left });
              equalH = true;
            }
          }
          if (!equalH && !xSnapped && R && RR) {
            const ref = RR.left - R.right;
            if (ref > 0 && Math.abs(gR - ref) <= EQ) {
              newX = R.left - ref - halfW; D = box();
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
            newY = (T.bottom + B.top) / 2; D = box();
            valueV = Math.round(D.top - T.bottom);
            equalSegV.push({ a: T.bottom, b: D.top }, { a: D.bottom, b: B.top });
            equalV = true;
          } else if (!ySnapped && T && TT) {
            const ref = T.top - TT.bottom;
            if (ref > 0 && Math.abs(gT - ref) <= EQ) {
              newY = T.bottom + ref + halfH; D = box();
              valueV = Math.round(ref);
              equalSegV.push({ a: TT.bottom, b: T.top }, { a: T.bottom, b: D.top });
              equalV = true;
            }
          }
          if (!equalV && !ySnapped && B && BB) {
            const ref = BB.top - B.bottom;
            if (ref > 0 && Math.abs(gB - ref) <= EQ) {
              newY = B.top - ref - halfH; D = box();
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
        onNudge(Math.round(newX) - currentX, Math.round(newY) - currentY, selectedIds);
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

    if (dragMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, activeId, dragOffset, onUpdateLive, onUpdateElementsLive, onNudge, elements, initialSize, width, height, bboxes, selectedIds, singleSelected, initialElements]);

  return (
    <div className="w-full h-full overflow-auto relative bg-transparent flex p-12">
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

            // Path pour texte courbé (arc de cercle)
            if (el.type === 'text' && el.curve && el.curve !== 0) {
              // On utilise une largeur estimée stable pour éviter la boucle infinie avec getBBox
              // (car le BBox d'un texte courbé change selon la courbure elle-même)
              const estimatedWidth = el.text.length * el.fontSize * 0.55 * ((el.fontWidth ?? 100) / 100);
              const w = Math.max(estimatedWidth, 10);
              const curve = el.curve;
              const r = Math.abs(10000 / curve);
              const sweep = curve > 0 ? 1 : 0;
              // On crée un arc de cercle centré
              const pathData = `M ${-w / 2},0 A ${r},${r} 0 0,${sweep} ${w / 2},0`;
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

          const sw = bbox.width * el.scaleX;
          const sh = bbox.height * el.scaleY;
          const sx = bbox.x * el.scaleX;
          const sy = bbox.y * el.scaleY;

          const filterUrl = (el.shadowBlur && el.shadowBlur > 0) || (el.shadowOpacity && el.shadowOpacity > 0) 
            ? `url(#filter-shadow-${el.id})` 
            : undefined;
          
          const fill = el.gradient ? `url(#gradient-${el.id})` : el.color;

          return (
            <g
              key={el.id}
              ref={(ref) => { elementRefs.current[el.id] = ref; }}
              transform={outerTransform}
              onMouseDown={(e) => handleMouseDown(e, el)}
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
                  el.maxWidth && el.maxWidth > 0 ? (
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
                        WebkitTextStroke: el.strokeWidth && el.strokeWidth > 0 ? `${el.strokeWidth}px ${el.strokeColor}` : 'none',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`
                      }}>
                        {el.text}
                      </div>
                    </foreignObject>
                  ) : (
                    <text
                      x="0"
                      y="0"
                      fontSize={el.fontSize}
                      fontFamily={el.fontFamily}
                      fontWeight={el.fontWeight}
                      fontStyle={el.italic ? 'italic' : 'normal'}
                      letterSpacing={el.letterSpacing ?? 0}
                      fill={fill}
                      stroke={el.strokeWidth && el.strokeWidth > 0 ? el.strokeColor : 'none'}
                      strokeWidth={el.strokeWidth ?? 0}
                      strokeLinejoin="round"
                      textAnchor={el.textAlign ?? 'middle'}
                      dominantBaseline="middle"
                      className="select-none"
                      style={{ 
                        textTransform: el.textTransform ?? 'none',
                        fontVariationSettings: `"wght" ${el.fontWeight === 'bold' ? 700 : el.fontWeight === 'normal' ? 400 : el.fontWeight}, "wdth" ${el.fontWidth ?? 100}`
                      }}
                    >
                      {el.curve && el.curve !== 0 ? (
                        <textPath xlinkHref={`#path-${el.id}`} startOffset="50%" textAnchor="middle">
                          {el.text}
                        </textPath>
                      ) : el.text}
                    </text>
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
                {(el.type === 'rect' || el.type === 'line') && <rect x={-el.width / 2} y={-el.height / 2} width={el.width} height={el.height} fill={el.color} />}
                {el.type === 'circle' && <circle cx="0" cy="0" r={el.width / 2} fill={el.color} />}
                {el.type === 'triangle' && <polygon points={`0,${-el.height / 2} ${el.width / 2},${el.height / 2} ${-el.width / 2},${el.height / 2}`} fill={el.color} />}
                {el.type === 'semicircle' && <path d={`M ${-el.width / 2},${el.height / 2} A ${el.width / 2} ${el.height} 0 0 1 ${el.width / 2} ${el.height / 2} Z`} fill={el.color} />}
                {el.type === 'quarter' && <path d={`M ${-el.width / 2},${el.height / 2} L ${el.width / 2},${el.height / 2} A ${el.width} ${el.height} 0 0 0 ${-el.width / 2},${-el.height / 2} Z`} fill={el.color} />}
                {el.type === 'ring' && <path fillRule="evenodd" d={`M ${-el.width / 2},0 A ${el.width / 2} ${el.height / 2} 0 1 0 ${el.width / 2} 0 A ${el.width / 2} ${el.height / 2} 0 1 0 ${-el.width / 2} 0 Z M ${-el.width / 4},0 A ${el.width / 4} ${el.height / 4} 0 1 1 ${el.width / 4} 0 A ${el.width / 4} ${el.height / 4} 0 1 1 ${-el.width / 4} 0 Z`} fill={el.color} />}
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
              stroke="#3b82f6"
              strokeWidth={strokeZ}
              strokeDasharray="4"
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
            const color = m.kind === 'equal' ? '#ec4899' : '#2563eb';
            const labelW = Math.max(18, String(m.value).length * 7 + 8) / zoom;
            const mx = (m.x1 + m.x2) / 2;
            const my = (m.y1 + m.y2) / 2;
            const a = 3 / zoom; // taille des têtes de flèche compensée
            // Pastille décalée pour ne pas masquer la ligne de mesure
            const labelCx = isVertical ? mx + labelW / 2 + 5 / zoom : mx;
            const labelCy = isVertical ? my : my - 11 / zoom;

            return (
              <g key={`m-${i}`}>
                {m.kind === 'equal' && (
                  <rect
                    x={isVertical ? m.x1 - 10 / zoom : Math.min(m.x1, m.x2)}
                    y={isVertical ? Math.min(m.y1, m.y2) : m.y1 - 10 / zoom}
                    width={isVertical ? 20 / zoom : Math.abs(m.x2 - m.x1)}
                    height={isVertical ? Math.abs(m.y2 - m.y1) : 20 / zoom}
                    fill={color}
                    opacity="0.1"
                  />
                )}
                <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={color} strokeWidth={strokeGuide} />
                {/* Doubles flèches aux extrémités */}
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
                <rect x={labelCx - labelW / 2} y={labelCy - 7 / zoom} width={labelW} height={14 / zoom} fill={color} rx={3 / zoom} />
                <text x={labelCx} y={labelCy} fontSize={9 / zoom} fontWeight="bold" fill="white" textAnchor="middle" dominantBaseline="central" className="select-none font-mono">
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
            fill="rgba(59, 130, 246, 0.06)"
            stroke="#3b82f6"
            strokeWidth={0.5 / zoom}
            strokeDasharray="3 3"
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
                  <Copy size={14} className="opacity-60" /> Copier le style <span className="ml-auto text-[10px] opacity-40">Ctrl+Alt+C</span>
                </button>
              )}
              {hasCopiedStyle && (
                <button onClick={() => { onPasteStyle(selectedIds); closeContextMenu(); }} className="flex items-center gap-3 px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-xs text-gray-700 font-medium transition-colors">
                  <Download size={14} className="opacity-60" /> Coller le style <span className="ml-auto text-[10px] opacity-40">Ctrl+Alt+V</span>
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
