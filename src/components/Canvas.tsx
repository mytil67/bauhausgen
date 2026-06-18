import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CompositionElement, ElementBounds } from '../types';
import { FALLBACK_BBOX, hexToRgba, buildElementDefs, renderElementContent } from './canvas/render';
import { computeMoveSnap, type Measurement } from './canvas/smartGuides';
import { CanvasContextMenu } from './canvas/CanvasContextMenu';
import { ResizeRotateHandles, type ResizeHandle } from './canvas/SelectionHandles';
import { GuidesOverlay } from './canvas/GuidesOverlay';

interface CanvasProps {
  elements: CompositionElement[];
  selectedIds: string[];
  backgroundColor: string;
  backgroundGradient?: { type: 'linear' | 'radial'; colors: { offset: number; color: string; opacity: number }[]; rotation: number };
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
  /** Ref optionnelle : Canvas y place une fonction de mesure fraîche des bbox (pour l'alignement). */
  measureRef?: React.MutableRefObject<(() => ElementBounds) | null>;
  showGrid?: boolean;
  gridSize?: number;
  snapToGrid?: boolean;
  guides?: { x: number[]; y: number[] };
  onGuidesChange?: React.Dispatch<React.SetStateAction<{ x: number[]; y: number[] }>>;
  zoom: number;
}

interface Marquee { x1: number; y1: number; x2: number; y2: number; additive: boolean; }
interface ContextMenuState { x: number; y: number; visible: boolean; }

type DragMode = 'move' | 'rotate' | ResizeHandle | null;

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedIds,
  backgroundColor,
  backgroundGradient,
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
  measureRef,
  showGrid,
  gridSize = 20,
  snapToGrid,
  guides,
  onGuidesChange,
  zoom,
}) => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0, scaleX: 1, scaleY: 1 });
  const [activeGuides, setActiveGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
  const [guideDrag, setGuideDrag] = useState<{ axis: 'x' | 'y'; index: number } | null>(null);
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

  // Stables (ne dépendent que de svgRef) : permet de les lister dans les deps des effets
  // sans provoquer de réabonnement à chaque render.
  const getPositionFromClient = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (clientX - CTM.e) / CTM.a,
      y: (clientY - CTM.f) / CTM.d,
    };
  }, []);

  const getMousePosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    return getPositionFromClient(e.clientX, e.clientY);
  }, [getPositionFromClient]);

  const getTouchPosition = useCallback((e: React.TouchEvent | TouchEvent) => {
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return { x: 0, y: 0 };
    return getPositionFromClient(touch.clientX, touch.clientY);
  }, [getPositionFromClient]);

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
  }, [marqueeActive, elements, bboxes, onSelect, onSelectMany, getMousePosition]);

  // Mesure fraîche des boîtes englobantes (getBBox) de tous les éléments, à la demande.
  const measureBounds = useCallback((): { [key: string]: DOMRect } => {
    const nb: { [key: string]: DOMRect } = {};
    elements.forEach((el) => {
      const ref = elementRefs.current[el.id];
      if (ref) {
        const content = (ref.querySelector('.measure-target') || ref.querySelector('text, rect, circle, polygon, path, image')) as SVGGraphicsElement;
        if (content) nb[el.id] = content.getBBox();
      }
    });
    return nb;
  }, [elements]);

  // Expose une mesure fraîche pour l'alignement (évite d'utiliser un cache périmé).
  useEffect(() => {
    if (measureRef) measureRef.current = measureBounds;
  }, [measureRef, measureBounds]);

  useEffect(() => {
    const newBboxes: { [key: string]: DOMRect } = {};
    elements.forEach((el) => {
      const ref = elementRefs.current[el.id];
      if (ref) {
        const content = (ref.querySelector('.measure-target') || ref.querySelector('text, rect, circle, polygon, path, image')) as SVGGraphicsElement;
        if (content) newBboxes[el.id] = content.getBBox();
      }
    });
    setBboxes(newBboxes);
    onBoundsChange(newBboxes);
    // Les bbox ne dépendent que de la géométrie : on NE remesure PAS à chaque
    // changement de sélection (évite un reflow getBBox coûteux à chaque clic).
  }, [elements, onBoundsChange]);

  // Déplacement d'un repère (guide) : maj live ; sorti du canvas au relâcher = supprimé.
  useEffect(() => {
    if (!guideDrag || !onGuidesChange) return;
    const apply = (clientX: number, clientY: number, finalize: boolean) => {
      const pos = getPositionFromClient(clientX, clientY);
      const { axis, index } = guideDrag;
      const val = axis === 'x' ? pos.x : pos.y;
      const lim = axis === 'x' ? width : height;
      onGuidesChange((prev) => {
        const arr = [...prev[axis]];
        if (finalize && (val < -4 || val > lim + 4)) arr.splice(index, 1);
        else arr[index] = Math.round(Math.max(0, Math.min(lim, val)));
        return { ...prev, [axis]: arr };
      });
    };
    const move = (e: MouseEvent) => apply(e.clientX, e.clientY, false);
    const up = (e: MouseEvent) => { apply(e.clientX, e.clientY, true); setGuideDrag(null); };
    const tmove = (e: TouchEvent) => { const t = e.touches[0]; if (t) { e.preventDefault(); apply(t.clientX, t.clientY, false); } };
    const tend = (e: TouchEvent) => { const t = e.changedTouches[0]; if (t) apply(t.clientX, t.clientY, true); setGuideDrag(null); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', tmove, { passive: false });
    window.addEventListener('touchend', tend);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', tmove);
      window.removeEventListener('touchend', tend);
    };
  }, [guideDrag, onGuidesChange, width, height, getPositionFromClient]);

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
        // Calcul de l'aimantation (smart guides) délégué à un module pur.
        const res = computeMoveSnap({
          mouseX: pos.x - dragOffset.x,
          mouseY: pos.y - dragOffset.y,
          singleSelected, el, activeId, groupAABB,
          elements, bboxes, selectedIds, width, height, guides, snapToGrid, gridSize,
        });
        if (!res) return;
        setActiveGuides({ x: res.guidesX, y: res.guidesY });
        setMeasurements(res.measurements);
        onNudge(res.dx, res.dy, selectedIds);
      }
 else {
        // Redimensionnement
        const shift = e.shiftKey; // maintient les proportions (uniforme), façon Photoshop
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
            if (shift) {
              // Échelle uniforme : même ratio sur les deux axes
              const r = (multX !== 0 && multY !== 0)
                ? (Math.abs(ratioX) >= Math.abs(ratioY) ? ratioX : ratioY)
                : (multX !== 0 ? ratioX : ratioY);
              updates.scaleX = Math.max(0.1, initialSize.scaleX * r);
              updates.scaleY = Math.max(0.1, initialSize.scaleY * r);
            } else {
              if (multX !== 0) updates.scaleX = Math.max(0.1, initialSize.scaleX * ratioX);
              if (multY !== 0) updates.scaleY = Math.max(0.1, initialSize.scaleY * ratioY);
            }
            onUpdateLive(activeId, updates);
          } else if (el.type === 'circle') {
            const delta = Math.max(dx * multX, dy * multY);
            if (multX !== 0 || multY !== 0) {
              const size = Math.max(10, initialSize.width + delta * 2);
              onUpdateLive(activeId, { width: size, height: size });
            }
          } else {
            // Rectangle / image / autres formes : largeur & hauteur
            const aspect = initialSize.width / Math.max(1, initialSize.height);
            let newW = multX !== 0 ? Math.max(10, initialSize.width + dx * multX * 2) : initialSize.width;
            let newH = multY !== 0 ? Math.max(10, initialSize.height + dy * multY * 2) : initialSize.height;
            if (shift) {
              // Verrouille le ratio largeur/hauteur initial
              if (multX !== 0 && multY !== 0) {
                if (newW / initialSize.width >= newH / initialSize.height) newH = newW / aspect;
                else newW = newH * aspect;
              } else if (multX !== 0) {
                newH = newW / aspect;
              } else if (multY !== 0) {
                newW = newH * aspect;
              }
            }
            if (snapToGrid && gridSize > 0 && !shift) {
              newW = Math.max(gridSize, Math.round(newW / gridSize) * gridSize);
              newH = Math.max(gridSize, Math.round(newH / gridSize) * gridSize);
            }
            const updates: { width?: number; height?: number } = {};
            if (shift || multX !== 0) updates.width = Math.max(10, newW);
            if (shift || multY !== 0) updates.height = Math.max(10, newH);
            onUpdateLive(activeId, updates);
          }
        } else {
          // Redimensionnement de groupe
          const g = initialSize;
          let ratioX = multX !== 0 ? Math.max(0.01, 1 + (dx * multX * 2) / Math.max(1, g.width)) : 1;
          let ratioY = multY !== 0 ? Math.max(0.01, 1 + (dy * multY * 2) / Math.max(1, g.height)) : 1;
          // Shift sur une poignée d'angle : échelle uniforme du groupe
          if (shift && multX !== 0 && multY !== 0) {
            const r = Math.abs(ratioX) >= Math.abs(ratioY) ? ratioX : ratioY;
            ratioX = r; ratioY = r;
          }

          // Centre du groupe au début du drag
          const gcx = dragOffset.x - (multX * g.width) / 2;
          const gcy = dragOffset.y - (multY * g.height) / 2;

          const bulkUpdates: Record<string, Partial<CompositionElement>> = {};
          initialElements.forEach((initEl) => {
            const base = {
              x: gcx + (initEl.x - gcx) * ratioX,
              y: gcy + (initEl.y - gcy) * ratioY,
            };
            // Le texte se redimensionne via scale ; les formes/images via width & height.
            bulkUpdates[initEl.id] = initEl.type === 'text'
              ? { ...base, scaleX: initEl.scaleX * ratioX, scaleY: initEl.scaleY * ratioY }
              : { ...base, width: initEl.width * ratioX, height: initEl.height * ratioY };
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
  }, [dragMode, activeId, dragOffset, onUpdateLive, onUpdateElementsLive, onNudge, elements, initialSize, width, height, bboxes, selectedIds, singleSelected, initialElements, snapToGrid, gridSize, guides, getMousePosition, groupAABB]);

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
          {backgroundGradient && (() => {
            const { type, colors, rotation } = backgroundGradient;
            if (type === 'linear') {
              const rad = (rotation * Math.PI) / 180;
              return (
                <linearGradient id="bg-gradient" x1={`${50 - Math.cos(rad) * 50}%`} y1={`${50 - Math.sin(rad) * 50}%`} x2={`${50 + Math.cos(rad) * 50}%`} y2={`${50 + Math.sin(rad) * 50}%`}>
                  {colors.map((c, i) => <stop key={i} offset={`${c.offset * 100}%`} stopColor={c.color} stopOpacity={c.opacity} />)}
                </linearGradient>
              );
            }
            return (
              <radialGradient id="bg-gradient">
                {colors.map((c, i) => <stop key={i} offset={`${c.offset * 100}%`} stopColor={c.color} stopOpacity={c.opacity} />)}
              </radialGradient>
            );
          })()}
          {showGrid && gridSize > 0 && (
            <pattern id="editor-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#3b82f6" strokeWidth={1 / zoom} opacity={0.45} />
            </pattern>
          )}
          {elements.map((el) => buildElementDefs(el, bboxes))}
        </defs>

        {/* Fond en dégradé (sous tous les éléments) — transparent aux clics pour
            ne pas casser le cadre de sélection (marquee) ni la désélection au clic. */}
        {backgroundGradient && (
          <rect x="0" y="0" width={width} height={height} fill="url(#bg-gradient)" pointerEvents="none" />
        )}

        {/* Grille (aide d'édition : ignorée à l'export, transparente aux clics) */}
        {showGrid && gridSize > 0 && (
          <rect x="0" y="0" width={width} height={height} fill="url(#editor-grid)" pointerEvents="none" className="export-ignore" />
        )}

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
              filter={filterUrl}
              onMouseDown={(e) => handleMouseDown(e, el)}
              onTouchStart={(e) => handleTouchStart(e, el)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => { e.stopPropagation(); startEditing(el); }}
              style={{
                cursor: dragMode === 'move' && isSelected ? 'grabbing' : 'grab',
                opacity: el.opacity,
                mixBlendMode: el.blendMode as React.CSSProperties['mixBlendMode'] ?? 'normal',
              }}
            >
              <g transform={innerTransform}>
                {renderElementContent({ el, fill, textShadowCss, bboxes, editingId, onUpdateLive, setEditingId, editInputRef })}
              </g>

              {/* Contour de sélection (toujours visible si sélectionné) */}
              {isSelected && (
                <rect x={sx - ho} y={sy - ho} width={sw + hz} height={sh + hz} fill="none" stroke="#3b82f6" strokeWidth={strokeZ} strokeDasharray={showHandles ? '4' : '2'} className="pointer-events-none export-ignore" />
              )}

              {/* Poignées (sélection unique uniquement) */}
              {showHandles && (
                <g className="export-ignore">
                  <ResizeRotateHandles
                    x={sx} y={sy} w={sw} h={sh}
                    hz={hz} ho={ho} strokeZ={strokeZ} zoom={zoom}
                    targetId={el.id}
                    onResize={handleResizeMouseDown}
                    onRotate={handleRotateMouseDown}
                  />
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
            <ResizeRotateHandles
              x={groupAABB.x} y={groupAABB.y} w={groupAABB.width} h={groupAABB.height}
              hz={hz} ho={ho} strokeZ={strokeZ} zoom={zoom}
              onResize={handleResizeMouseDown}
              onRotate={handleRotateMouseDown}
            />
          </g>
        )}

        {/* Overlay : guides & mesures */}
        <GuidesOverlay
          activeGuides={activeGuides}
          measurements={measurements}
          width={width}
          height={height}
          strokeGuide={strokeGuide}
          zoom={zoom}
        />

        {/* Repères manuels (guides) — déplaçables, sortir du canvas = supprimer */}
        {guides && (guides.x.length > 0 || guides.y.length > 0) && (
          <g className="export-ignore">
            {guides.x.map((gx, i) => (
              <React.Fragment key={`guide-x-${i}`}>
                <line x1={gx} y1={0} x2={gx} y2={height} stroke="#14b8a6" strokeWidth={strokeGuide} className="pointer-events-none" />
                <line x1={gx} y1={0} x2={gx} y2={height} stroke="#14b8a6" strokeOpacity={0} strokeWidth={14 / zoom}
                  style={{ cursor: 'ew-resize', pointerEvents: 'stroke' }}
                  onMouseDown={(e) => { e.stopPropagation(); setGuideDrag({ axis: 'x', index: i }); }}
                  onTouchStart={(e) => { e.stopPropagation(); setGuideDrag({ axis: 'x', index: i }); }} />
              </React.Fragment>
            ))}
            {guides.y.map((gy, i) => (
              <React.Fragment key={`guide-y-${i}`}>
                <line x1={0} y1={gy} x2={width} y2={gy} stroke="#14b8a6" strokeWidth={strokeGuide} className="pointer-events-none" />
                <line x1={0} y1={gy} x2={width} y2={gy} stroke="#14b8a6" strokeOpacity={0} strokeWidth={14 / zoom}
                  style={{ cursor: 'ns-resize', pointerEvents: 'stroke' }}
                  onMouseDown={(e) => { e.stopPropagation(); setGuideDrag({ axis: 'y', index: i }); }}
                  onTouchStart={(e) => { e.stopPropagation(); setGuideDrag({ axis: 'y', index: i }); }} />
              </React.Fragment>
            ))}
          </g>
        )}

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
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectionCount={selectionCount}
          selectedIds={selectedIds}
          elements={elements}
          hasCopiedStyle={hasCopiedStyle}
          onClose={closeContextMenu}
          onGroup={onGroup}
          onUngroup={onUngroup}
          onDuplicate={onDuplicate}
          onCopy={onCopy}
          onCopyStyle={onCopyStyle}
          onPasteStyle={onPasteStyle}
          onBringToFront={onBringToFront}
          onBringForward={onBringForward}
          onSendBackward={onSendBackward}
          onSendToBack={onSendToBack}
          onRemoveSelection={onRemoveSelection}
          onPaste={onPaste}
        />
      )}
    </div>
  );
};
