import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  CompositionElement,
  DocState,
  ElementType,
  AlignDirection,
  DistributeAxis,
  ElementBounds,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 800;
const STORAGE_KEY = 'bauhaus-composition-state';
const MAX_HISTORY = 50;

/** Étend une liste d'ids pour inclure tous les membres des groupes concernés. */
const expandGroups = (ids: string[], elements: CompositionElement[]): string[] => {
  const idSet = new Set(ids);
  const groupIds = new Set<string>();
  elements.forEach((el) => { if (idSet.has(el.id) && el.groupId) groupIds.add(el.groupId); });
  if (groupIds.size === 0) return ids;
  const result = new Set(ids);
  elements.forEach((el) => { if (el.groupId && groupIds.has(el.groupId)) result.add(el.id); });
  return [...result];
};

/** Boîte englobante absolue (coords canvas) d'un élément, rotation ignorée. */
const getBox = (el: CompositionElement, bounds: ElementBounds) => {
  const b = bounds[el.id];
  if (b) {
    const left = el.x + b.x * el.scaleX;
    const top = el.y + b.y * el.scaleY;
    const w = b.width * el.scaleX;
    const h = b.height * el.scaleY;
    return { left, top, right: left + w, bottom: top + h, cx: left + w / 2, cy: top + h / 2, w, h };
  }
  // Repli si la boîte n'a pas encore été mesurée
  const w = 'width' in el ? el.width * el.scaleX : 100;
  const h = 'height' in el ? el.height * el.scaleY : 50;
  return { left: el.x - w / 2, top: el.y - h / 2, right: el.x + w / 2, bottom: el.y + h / 2, cx: el.x, cy: el.y, w, h };
};

const emptyDoc = (): DocState => ({
  elements: [],
  backgroundColor: '#ffffff',
  canvasWidth: DEFAULT_WIDTH,
  canvasHeight: DEFAULT_HEIGHT,
  customColors: [],
  customFonts: [],
});

interface PersistedShape extends DocState {
  selectedIds?: string[];
  // rétrocompat avec l'ancien format
  selectedId?: string | null;
  customFonts: DocState['customFonts'];
}

const loadInitial = (): { doc: DocState; selectedIds: string[] } => {
  const fallback = { doc: emptyDoc(), selectedIds: [] as string[] };
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved) as PersistedShape;
    // Migration : anciennes polices stockées en string[] -> ignorées (données perdues)
    const customFonts = Array.isArray(parsed.customFonts)
      ? parsed.customFonts.filter((f): f is { name: string; data: string } =>
          typeof f === 'object' && f !== null && 'data' in f)
      : [];
    const doc: DocState = {
      elements: parsed.elements ?? [],
      backgroundColor: parsed.backgroundColor ?? '#ffffff',
      canvasWidth: parsed.canvasWidth ?? DEFAULT_WIDTH,
      canvasHeight: parsed.canvasHeight ?? DEFAULT_HEIGHT,
      customColors: parsed.customColors ?? [],
      customFonts,
    };
    const selectedIds = parsed.selectedIds
      ?? (parsed.selectedId ? [parsed.selectedId] : []);
    return { doc, selectedIds };
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
    return fallback;
  }
};

export const useComposition = () => {
  const initial = loadInitial();
  const [doc, setDoc] = useState<DocState>(initial.doc);
  const [selectedIds, setSelectedIds] = useState<string[]>(initial.selectedIds);
  const [past, setPast] = useState<DocState[]>([]);
  const [future, setFuture] = useState<DocState[]>([]);

  // Persistance avec debounce
  const saveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...doc, selectedIds }));
    }, 500);
    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [doc, selectedIds]);

  // Ré-enregistre les polices importées au chargement (les données sont persistées)
  useEffect(() => {
    doc.customFonts.forEach((font) => {
      const alreadyLoaded = Array.from(document.fonts).some((f) => f.family === font.name);
      if (alreadyLoaded) return;
      try {
        const face = new FontFace(font.name, `url(${font.data})`);
        face.load().then((loaded) => document.fonts.add(loaded)).catch(() => {});
      } catch {
        /* données de police invalides : on ignore */
      }
    });
    // au montage uniquement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Applique une mutation au document EN enregistrant un point d'historique. */
  const commit = useCallback((updater: (d: DocState) => DocState) => {
    setDoc((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      setPast((p) => [...p, prev].slice(-MAX_HISTORY));
      setFuture([]);
      return next;
    });
  }, []);

  /** Snapshot manuel : à appeler au DÉBUT d'un geste (drag/resize/rotate). */
  const beginHistory = useCallback(() => {
    setDoc((prev) => {
      setPast((p) => [...p, prev].slice(-MAX_HISTORY));
      setFuture([]);
      return prev;
    });
  }, []);

  /** Mutation « live » sans historique (pendant un geste). */
  const live = useCallback((updater: (d: DocState) => DocState) => {
    setDoc(updater);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setDoc((curr) => {
        setFuture((f) => [...f, curr]);
        return previous;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      setDoc((curr) => {
        setPast((p) => [...p, curr].slice(-MAX_HISTORY));
        return next;
      });
      return f.slice(0, -1);
    });
  }, []);

  const makeElement = (type: ElementType, doc: DocState): CompositionElement => {
    const id = uuidv4();
    const base = {
      id,
      x: doc.canvasWidth / 2,
      y: doc.canvasHeight / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      opacity: 1,
      blendMode: 'normal' as const,
      visible: true,
      locked: false,
      shadowColor: '#000000',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowOpacity: 0.5,
    };
    if (type === 'text') {
      return {
        ...base,
        type: 'text',
        name: 'Texte',
        color: '#000000',
        text: 'BAUHAUS',
        fontSize: 60,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        strokeWidth: 0,
        strokeColor: '#000000',
        letterSpacing: 0,
        lineHeight: 1.2,
      };
    }
    const names: Record<string, string> = {
      rect: 'Rectangle', circle: 'Cercle', triangle: 'Triangle',
      semicircle: 'Demi-cercle', quarter: 'Quart de cercle', ring: 'Anneau', line: 'Ligne',
    };
    const size = type === 'line' ? { width: 240, height: 8 } : { width: 120, height: 120 };
    return {
      ...base,
      type,
      name: names[type] ?? 'Forme',
      color: '#e63946',
      ...size,
    };
  };

  const addElement = useCallback((type: ElementType) => {
    let newId = '';
    commit((prev) => {
      const el = makeElement(type, prev);
      newId = el.id;
      return { ...prev, elements: [...prev.elements, el] };
    });
    setSelectedIds(newId ? [newId] : []);
  }, [commit]);

  const updateElement = useCallback((id: string, updates: Partial<CompositionElement>) => {
    commit((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? ({ ...el, ...updates } as CompositionElement) : el),
    }));
  }, [commit]);

  /** Maj d'un élément SANS historique (pendant un geste : resize/rotation/slider). */
  const updateElementLive = useCallback((id: string, updates: Partial<CompositionElement>) => {
    live((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? ({ ...el, ...updates } as CompositionElement) : el),
    }));
  }, [live]);

  /** Maj de plusieurs éléments SANS historique. */
  const updateElementsLive = useCallback((updates: Record<string, Partial<CompositionElement>>) => {
    live((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        updates[el.id] ? ({ ...el, ...updates[el.id] } as CompositionElement) : el),
    }));
  }, [live]);

  /** Déplace tous les éléments sélectionnés d'un delta (live, sans historique). */
  const nudgeSelection = useCallback((dx: number, dy: number, ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    live((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        set.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el),
    }));
  }, [live]);

  const removeSelection = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    commit((prev) => ({ ...prev, elements: prev.elements.filter((el) => !set.has(el.id)) }));
    setSelectedIds([]);
  }, [commit]);

  const duplicateSelection = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    const newIds: string[] = [];
    const groupMap = new Map<string, string>();
    commit((prev) => {
      const clones = prev.elements
        .filter((el) => set.has(el.id))
        .map((el) => {
          const id = uuidv4();
          newIds.push(id);
          let groupId = el.groupId;
          if (groupId) {
            if (!groupMap.has(groupId)) groupMap.set(groupId, uuidv4());
            groupId = groupMap.get(groupId);
          }
          return { ...el, id, groupId, x: el.x + 20, y: el.y + 20 } as CompositionElement;
        });
      return { ...prev, elements: [...prev.elements, ...clones] };
    });
    if (newIds.length) setSelectedIds(newIds);
  }, [commit]);

  // --- Calques : visibilité, verrou, renommage, réordonnancement ---
  const toggleVisible = useCallback((id: string) => {
    commit((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, visible: el.visible === false ? true : false } : el),
    }));
  }, [commit]);

  const toggleLock = useCallback((id: string) => {
    commit((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, locked: !el.locked } : el)),
    }));
  }, [commit]);

  const renameElement = useCallback((id: string, name: string) => {
    commit((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, name } : el)),
    }));
  }, [commit]);

  /** Réordonne le tableau d'éléments selon l'ordre donné (bas → haut). */
  const reorderElements = useCallback((orderedIds: string[]) => {
    commit((prev) => {
      const byId = new Map(prev.elements.map((el) => [el.id, el]));
      const next = orderedIds.map((id) => byId.get(id)).filter(Boolean) as CompositionElement[];
      // sécurité : garder d'éventuels éléments manquants
      if (next.length !== prev.elements.length) return prev;
      return { ...prev, elements: next };
    });
  }, [commit]);

  // --- Copier / Coller ---
  const copySelection = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const toCopy = doc.elements.filter((el) => set.has(el.id));
    localStorage.setItem('bauhaus-clipboard', JSON.stringify(toCopy));
  }, [doc.elements]);

  const pasteClipboard = useCallback(() => {
    const saved = localStorage.getItem('bauhaus-clipboard');
    if (!saved) return;
    try {
      const clipboard = JSON.parse(saved) as CompositionElement[];
      if (clipboard.length === 0) return;
      const newIds: string[] = [];
      const groupMap = new Map<string, string>();
      commit((prev) => {
        const clones = clipboard.map((el) => {
          const id = uuidv4();
          newIds.push(id);
          let groupId = el.groupId;
          if (groupId) {
            if (!groupMap.has(groupId)) groupMap.set(groupId, uuidv4());
            groupId = groupMap.get(groupId);
          }
          return { ...el, id, groupId, x: el.x + 24, y: el.y + 24 } as CompositionElement;
        });
        return { ...prev, elements: [...prev.elements, ...clones] };
      });
      if (newIds.length) setSelectedIds(newIds);
    } catch {
      // Ignorer si invalide
    }
  }, [commit]);

  // --- Canvas & templates ---
  const setCanvasSize = useCallback((w: number, h: number) => {
    live((prev) => ({ ...prev, canvasWidth: w, canvasHeight: h }));
  }, [live]);

  const loadTemplate = useCallback((tpl: Pick<DocState, 'elements' | 'backgroundColor' | 'canvasWidth' | 'canvasHeight'>) => {
    commit((prev) => ({
      ...prev,
      elements: tpl.elements.map((el) => ({ ...el, id: uuidv4() })),
      backgroundColor: tpl.backgroundColor,
      canvasWidth: tpl.canvasWidth,
      canvasHeight: tpl.canvasHeight,
    }));
    setSelectedIds([]);
  }, [commit]);

  /** Sélection. `additive` (shift) ajoute/retire ; la sélection s'étend au groupe. */
  const selectElement = useCallback((id: string | null, additive = false) => {
    if (id === null) { setSelectedIds([]); return; }
    const group = expandGroups([id], doc.elements);
    setSelectedIds((prev) => {
      if (!additive) return group;
      const allIn = group.every((g) => prev.includes(g));
      return allIn ? prev.filter((i) => !group.includes(i)) : Array.from(new Set([...prev, ...group]));
    });
  }, [doc.elements]);

  const selectAll = useCallback(() => {
    setSelectedIds(doc.elements.map((el) => el.id));
  }, [doc.elements]);

  /** Sélectionne un lot d'ids (cadre de sélection). `additive` fusionne avec l'existant. */
  const selectMany = useCallback((ids: string[], additive = false) => {
    const expanded = expandGroups(ids, doc.elements);
    setSelectedIds((prev) =>
      additive ? Array.from(new Set([...prev, ...expanded])) : expanded);
  }, [doc.elements]);

  const groupSelection = useCallback((ids: string[]) => {
    if (ids.length < 2) return;
    const gid = uuidv4();
    const set = new Set(ids);
    commit((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (set.has(el.id) ? { ...el, groupId: gid } : el)),
    }));
  }, [commit]);

  const ungroupSelection = useCallback((ids: string[]) => {
    const set = new Set(ids);
    commit((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (set.has(el.id) ? { ...el, groupId: undefined } : el)),
    }));
  }, [commit]);

  const setBackgroundColor = useCallback((color: string) => {
    commit((prev) => ({ ...prev, backgroundColor: color }));
  }, [commit]);

  /** Applique une couleur à la sélection, ou au fond si rien n'est sélectionné. */
  const applyColor = useCallback((color: string, ids: string[]) => {
    commit((prev) => {
      if (ids.length === 0) return { ...prev, backgroundColor: color };
      const set = new Set(ids);
      return {
        ...prev,
        elements: prev.elements.map((el) => (set.has(el.id) ? { ...el, color } : el)),
      };
    });
  }, [commit]);

  const saveColor = useCallback((color: string) => {
    if (!color || color === 'transparent') return;
    commit((prev) => {
      if (prev.customColors.includes(color)) return prev;
      return { ...prev, customColors: [color, ...prev.customColors].slice(0, 16) };
    });
  }, [commit]);

  const addCustomFont = useCallback((name: string, data: string) => {
    commit((prev) => {
      if (prev.customFonts.some((f) => f.name === name)) return prev;
      return { ...prev, customFonts: [...prev.customFonts, { name, data }] };
    });
  }, [commit]);

  const bringToFront = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    commit((prev) => {
      const selected = prev.elements.filter((el) => set.has(el.id));
      const remaining = prev.elements.filter((el) => !set.has(el.id));
      return { ...prev, elements: [...remaining, ...selected] };
    });
  }, [commit]);

  const sendToBack = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    commit((prev) => {
      const selected = prev.elements.filter((el) => set.has(el.id));
      const remaining = prev.elements.filter((el) => !set.has(el.id));
      return { ...prev, elements: [...selected, ...remaining] };
    });
  }, [commit]);

  const bringForward = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    commit((prev) => {
      const next = [...prev.elements];
      // On parcourt de la fin vers le début pour ne pas déplacer un élément 
      // qu'on vient juste d'avancer.
      for (let i = next.length - 2; i >= 0; i--) {
        if (set.has(next[i].id) && !set.has(next[i + 1].id)) {
          [next[i], next[i + 1]] = [next[i + 1], next[i]];
        }
      }
      return { ...prev, elements: next };
    });
  }, [commit]);

  const sendBackward = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    commit((prev) => {
      const next = [...prev.elements];
      // On parcourt du début vers la fin.
      for (let i = 1; i < next.length; i++) {
        if (set.has(next[i].id) && !set.has(next[i - 1].id)) {
          [next[i], next[i - 1]] = [next[i - 1], next[i]];
        }
      }
      return { ...prev, elements: next };
    });
  }, [commit]);

  const flipSelection = useCallback((axis: 'horizontal' | 'vertical', ids: string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    commit((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (!set.has(el.id)) return el;
        return axis === 'horizontal'
          ? { ...el, scaleX: el.scaleX * -1 }
          : { ...el, scaleY: el.scaleY * -1 };
      }),
    }));
  }, [commit]);

  const alignElements = useCallback(
    (direction: AlignDirection, ids: string[], bounds: ElementBounds, toPage = false) => {
      commit((prev) => {
        // Cible : la page, ou la sélection (>=2 éléments). Sinon rien à faire.
        const useSelection = !toPage && ids.length >= 2;
        if (!toPage && !useSelection) return prev;

        const set = new Set(ids);
        const targets = useSelection
          ? prev.elements.filter((el) => set.has(el.id))
          : prev.elements;
        if (targets.length < 1) return prev;

        const boxes = targets.map((el) => getBox(el, bounds));

        // Référentiel d'alignement (boîte de groupe ou page)
        const ref = useSelection
          ? {
              left: Math.min(...boxes.map((b) => b.left)),
              right: Math.max(...boxes.map((b) => b.right)),
              top: Math.min(...boxes.map((b) => b.top)),
              bottom: Math.max(...boxes.map((b) => b.bottom)),
            }
          : { left: 0, right: prev.canvasWidth, top: 0, bottom: prev.canvasHeight };
        const refCx = (ref.left + ref.right) / 2;
        const refCy = (ref.top + ref.bottom) / 2;

        const moveSet = new Set(targets.map((t) => t.id));
        return {
          ...prev,
          elements: prev.elements.map((el) => {
            if (!moveSet.has(el.id)) return el;
            const b = getBox(el, bounds);
            switch (direction) {
              case 'left': return { ...el, x: el.x + (ref.left - b.left) };
              case 'right': return { ...el, x: el.x + (ref.right - b.right) };
              case 'center': return { ...el, x: el.x + (refCx - b.cx) };
              case 'top': return { ...el, y: el.y + (ref.top - b.top) };
              case 'bottom': return { ...el, y: el.y + (ref.bottom - b.bottom) };
              case 'middle': return { ...el, y: el.y + (refCy - b.cy) };
              default: return el;
            }
          }),
        };
      });
    },
    [commit],
  );

  const distributeElements = useCallback(
    (axis: DistributeAxis, ids: string[], bounds: ElementBounds) => {
      commit((prev) => {
        // Distribue la sélection (>=3) ou, à défaut, tous les éléments.
        const useSelection = ids.length >= 3;
        const set = new Set(ids);
        const targets = useSelection
          ? prev.elements.filter((el) => set.has(el.id))
          : prev.elements;
        if (targets.length < 3) return prev;

        const horizontal = axis === 'horizontal';
        const entries = targets
          .map((el) => ({ el, box: getBox(el, bounds) }))
          .sort((a, b) => (horizontal ? a.box.left - b.box.left : a.box.top - b.box.top));

        // Espacement égal entre les bords (Photoshop/Canva "distribute spacing")
        const minStart = horizontal ? entries[0].box.left : entries[0].box.top;
        const last = entries[entries.length - 1].box;
        const maxEnd = horizontal ? last.right : last.bottom;
        const sumSize = entries.reduce((s, e) => s + (horizontal ? e.box.w : e.box.h), 0);
        const gap = (maxEnd - minStart - sumSize) / (entries.length - 1);

        const deltas = new Map<string, number>();
        let cursor = minStart;
        entries.forEach((e) => {
          const start = horizontal ? e.box.left : e.box.top;
          deltas.set(e.el.id, cursor - start);
          cursor += (horizontal ? e.box.w : e.box.h) + gap;
        });

        return {
          ...prev,
          elements: prev.elements.map((el) => {
            const d = deltas.get(el.id);
            if (d === undefined) return el;
            return horizontal ? { ...el, x: el.x + d } : { ...el, y: el.y + d };
          }),
        };
      });
    },
    [commit],
  );

  const clearCanvas = useCallback(() => {
    if (window.confirm('Voulez-vous vraiment vider le canvas ?')) {
      commit((prev) => ({ ...prev, elements: [], backgroundColor: '#ffffff' }));
      setSelectedIds([]);
    }
  }, [commit]);

  return {
    ...doc,
    selectedIds,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    addElement,
    updateElement,
    updateElementLive,
    updateElementsLive,
    nudgeSelection,
    removeSelection,
    duplicateSelection,
    selectElement,
    selectAll,
    selectMany,
    groupSelection,
    ungroupSelection,
    toggleVisible,
    toggleLock,
    renameElement,
    reorderElements,
    copySelection,
    pasteClipboard,
    setCanvasSize,
    loadTemplate,
    setBackgroundColor,
    applyColor,
    saveColor,
    addCustomFont,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    flipSelection,
    clearCanvas,
    alignElements,
    distributeElements,
    beginHistory,
    undo,
    redo,
  };
};
