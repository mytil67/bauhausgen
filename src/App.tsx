import { useEffect, useRef, useCallback, useState } from 'react';
import { useComposition } from './hooks/useComposition';
import { useIsMobile } from './hooks/useIsMobile';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { LayersPanel } from './components/LayersPanel';
import { Plus, Minus, Menu, Layers, X, Type, Square, Circle, Triangle, Undo2, Redo2, Trash2, Download } from 'lucide-react';
import type { ElementBounds, AlignDirection, DistributeAxis, ElementType } from './types';

// Polices Google utilisées dans l'éditeur (pour tentative d'embarquement à l'export)
const GOOGLE_FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Oswald:wght@400;700&family=Outfit:wght@400;700;900&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Poppins:wght@400;700;900&family=Righteous&family=Roboto+Mono:wght@400;700&family=Roboto:wght@400;700;900&family=Space+Grotesk:wght@400;700&family=Syne:wght@400;700;800&family=Work+Sans:wght@400;700;900&display=swap';

function App() {
  const {
    elements,
    selectedIds,
    backgroundColor,
    canvasWidth,
    canvasHeight,
    customColors,
    customFonts,
    canUndo,
    canRedo,
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
    hasCopiedStyle,
    copyStyle,
    pasteStyle,
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
  } = useComposition();

  const selectedElement =
    selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) ?? null : null;

  // Boîtes englobantes mesurées par le Canvas (pour un alignement aux bords réels)
  const boundsRef = useRef<ElementBounds>({});
  const handleBoundsChange = useCallback((b: ElementBounds) => {
    boundsRef.current = b;
  }, []);
  const handleAlign = useCallback(
    (dir: AlignDirection, toPage: boolean) => alignElements(dir, selectedIds, boundsRef.current, toPage),
    [alignElements, selectedIds],
  );
  const handleDistribute = useCallback(
    (axis: DistributeAxis) => distributeElements(axis, selectedIds, boundsRef.current),
    [distributeElements, selectedIds],
  );

  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);

  const [zoom, setZoom] = useState(1);

  // Zoom avec la molette
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(z => {
          const newZ = z - e.deltaY * 0.002;
          return Math.max(0.1, Math.min(5, newZ));
        });
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Raccourcis clavier globaux
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        if (e.altKey && e.key.toLowerCase() === 'c' && selectedIds.length === 1) { e.preventDefault(); copyStyle(selectedIds[0]); return; }
        if (e.altKey && e.key.toLowerCase() === 'v' && selectedIds.length > 0) { e.preventDefault(); pasteStyle(selectedIds); return; }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(z => Math.min(5, z + 0.25)); return; }
        if (e.key === '-') { e.preventDefault(); setZoom(z => Math.max(0.1, z - 0.25)); return; }
        if (e.key === '0') { e.preventDefault(); setZoom(1); return; }
      }

      if (!mod) {
        if (e.key === 'Escape') selectElement(null);
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'z':
          if (typing) return;
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          break;
        case 'y':
          if (typing) return;
          e.preventDefault();
          redo();
          break;
        case 'd':
          if (typing) return;
          e.preventDefault();
          duplicateSelection(selectedIds);
          break;
        case 'a':
          if (typing) return;
          e.preventDefault();
          selectAll();
          break;
        case 'c':
          if (typing) return;
          copySelection(selectedIds);
          break;
        case 'x':
          if (typing) return;
          copySelection(selectedIds);
          removeSelection(selectedIds);
          break;
        case 'v':
          if (typing) return;
          e.preventDefault();
          pasteClipboard();
          break;
        case 'g':
          if (typing) return;
          e.preventDefault();
          if (e.shiftKey) ungroupSelection(selectedIds);
          else groupSelection(selectedIds);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, duplicateSelection, selectAll, selectElement, selectedIds, copySelection, removeSelection, pasteClipboard, groupSelection, ungroupSelection]);

  /** Construit une chaîne SVG exportable : UI de sélection retirée + polices embarquées. */
  const buildExportSvg = async (): Promise<string | null> => {
    const svgElement = document.getElementById('bauhaus-svg') as SVGSVGElement | null;
    if (!svgElement) return null;

    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('.export-ignore').forEach((node) => node.remove());

    // @font-face pour les polices importées (data URL → autonome)
    const faces = customFonts
      .map((f) => `@font-face{font-family:'${f.name}';src:url(${f.data});}`)
      .join('\n');

    // Tentative d'embarquement des Google Fonts (fonctionne en ligne)
    let googleCss = '';
    try {
      const res = await fetch(GOOGLE_FONTS_CSS);
      if (res.ok) googleCss = await res.text();
    } catch {
      /* hors-ligne : on retombe sur les polices système */
    }

    if (faces || googleCss) {
      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.textContent = `${googleCss}\n${faces}`;
      clone.insertBefore(styleEl, clone.firstChild);
    }

    return new XMLSerializer().serializeToString(clone);
  };

  const downloadUrl = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async (format: 'svg' | 'png' | 'jpg') => {
    const svgData = await buildExportSvg();
    if (!svgData) return;

    if (format === 'svg') {
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, 'bauhaus-composition.svg');
      URL.revokeObjectURL(url);
      return;
    }

    // Assure que les polices sont prêtes avant la rastérisation
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 1.0);
      downloadUrl(dataUrl, `bauhaus-composition.${format}`);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("Échec de l'export de l'image.");
    };
    img.src = url;
  };

  const mainRef = useRef<HTMLDivElement>(null);
  const [autoCanvasSize, setAutoCanvasSize] = useState(true);

  // Mise à jour automatique de la taille du canvas pour remplir l'espace disponible
  useEffect(() => {
    if (!mainRef.current || !autoCanvasSize) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // On laisse une petite marge pour ne pas coller aux bords
        const padding = 64;
        setCanvasSize(Math.floor(width - padding), Math.floor(height - padding));
      }
    });
    observer.observe(mainRef.current);
    return () => observer.disconnect();
  }, [setCanvasSize, autoCanvasSize]);

  const handleSetCanvasSize = useCallback((w: number, h: number) => {
    setAutoCanvasSize(false);
    setCanvasSize(w, h);
  }, [setCanvasSize]);

  const handleMobileAdd = (type: ElementType) => {
    addElement(type);
    setMobileAddOpen(false);
  };

  const sidebarProps = {
    elements,
    selectedElement,
    selectedIds,
    selectionCount: selectedIds.length,
    elementCount: elements.length,
    backgroundColor,
    customColors,
    customFonts,
    canvasWidth,
    canvasHeight,
    canUndo,
    canRedo,
    autoCanvasSize,
    onToggleAutoCanvasSize: () => setAutoCanvasSize(!autoCanvasSize),
    onAddElement: addElement,
    onUpdateElement: updateElement,
    onUpdateElementLive: updateElementLive,
    onBeginHistory: beginHistory,
    onRemoveElement: (id: string) => removeSelection([id]),
    onDuplicate: () => duplicateSelection(selectedIds),
    onUpdateBackground: setBackgroundColor,
    onSaveColor: saveColor,
    onAddCustomFont: addCustomFont,
    onBringToFront: () => bringToFront(selectedIds),
    onSendToBack: () => sendToBack(selectedIds),
    onBringForward: () => bringForward(selectedIds),
    onSendBackward: () => sendBackward(selectedIds),
    onFlip: flipSelection,
    onExport: handleExport,
    onClearCanvas: clearCanvas,
    onAlign: handleAlign,
    onDistribute: handleDistribute,
    onUndo: undo,
    onRedo: redo,
    onApplyColor: (color: string) => applyColor(color, selectedIds),
    onGroup: () => groupSelection(selectedIds),
    onUngroup: () => ungroupSelection(selectedIds),
    onSetCanvasSize: handleSetCanvasSize,
    onLoadTemplate: (tpl: Parameters<typeof loadTemplate>[0]) => { setAutoCanvasSize(false); loadTemplate(tpl); },
  };

  const layersPanelProps = {
    elements,
    selectedIds,
    onSelect: selectElement,
    onReorder: reorderElements,
    onToggleVisible: toggleVisible,
    onToggleLock: toggleLock,
    onRename: renameElement,
    onRemove: (id: string) => removeSelection([id]),
  };

  const canvasJsx = (
    <Canvas
      elements={elements}
      selectedIds={selectedIds}
      backgroundColor={backgroundColor}
      width={canvasWidth}
      height={canvasHeight}
      onSelect={selectElement}
      onSelectMany={selectMany}
      onUpdateLive={updateElementLive}
      onUpdateElementsLive={updateElementsLive}
      onNudge={nudgeSelection}
      onRemoveSelection={removeSelection}
      onBeginHistory={beginHistory}
      onBoundsChange={handleBoundsChange}
      onDuplicate={() => duplicateSelection(selectedIds)}
      onCopy={() => copySelection(selectedIds)}
      onPaste={pasteClipboard}
      onGroup={() => groupSelection(selectedIds)}
      onUngroup={() => ungroupSelection(selectedIds)}
      onBringToFront={() => bringToFront(selectedIds)}
      onSendToBack={() => sendToBack(selectedIds)}
      onBringForward={() => bringForward(selectedIds)}
      onSendBackward={() => sendBackward(selectedIds)}
      onCopyStyle={copyStyle}
      onPasteStyle={pasteStyle}
      hasCopiedStyle={hasCopiedStyle}
      zoom={zoom}
    />
  );

  /* ── MOBILE LAYOUT ── */
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-screen bg-[#eef0f2] overflow-hidden font-sans text-gray-900 selection:bg-blue-200">
        {/* Barre du haut mobile */}
        <header className="flex items-center justify-between px-3 py-2 bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-sm z-30 shrink-0">
          <button
            onClick={() => { setSidebarOpen(true); setLayersOpen(false); }}
            className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
            title="Outils"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-sm font-black tracking-tight text-gray-900">BAUHAUS GEN</h1>
          <button
            onClick={() => { setLayersOpen(true); setSidebarOpen(false); }}
            className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
            title="Calques"
          >
            <Layers size={22} />
          </button>
        </header>

        {/* Zone canvas */}
        <main ref={mainRef} className="flex-1 relative overflow-hidden flex items-center justify-center">
          {canvasJsx}

          {/* Zoom mobile */}
          <div className="absolute top-3 right-3 bg-white/80 backdrop-blur px-2 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-1 text-xs font-mono text-gray-600 z-20">
            <button onClick={() => setZoom(z => Math.max(0.1, z - 0.25))} className="p-1.5 active:bg-gray-200 rounded"><Minus size={14} /></button>
            <span className="w-10 text-center" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="p-1.5 active:bg-gray-200 rounded"><Plus size={14} /></button>
          </div>
        </main>

        {/* Barre d'outils mobile en bas */}
        <nav className="flex items-center justify-around px-2 py-2 bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-30 shrink-0 safe-area-bottom">
          <button onClick={undo} disabled={!canUndo} className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-gray-100 disabled:opacity-30 text-gray-600" title="Annuler">
            <Undo2 size={20} />
            <span className="text-[9px]">Annuler</span>
          </button>
          <button onClick={redo} disabled={!canRedo} className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-gray-100 disabled:opacity-30 text-gray-600" title="Rétablir">
            <Redo2 size={20} />
            <span className="text-[9px]">Rétablir</span>
          </button>

          {/* Bouton ajouter central */}
          <div className="relative">
            <button
              onClick={() => setMobileAddOpen(!mobileAddOpen)}
              className={`p-3 rounded-full shadow-lg transition-colors ${mobileAddOpen ? 'bg-gray-900 text-white' : 'bg-blue-500 text-white active:bg-blue-600'}`}
              title="Ajouter un élément"
            >
              {mobileAddOpen ? <X size={22} /> : <Plus size={22} />}
            </button>
            {/* Menu d'ajout rapide */}
            {mobileAddOpen && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 flex gap-2 z-50">
                <button onClick={() => handleMobileAdd('text')} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 text-gray-700" title="Texte">
                  <Type size={20} /><span className="text-[9px]">Texte</span>
                </button>
                <button onClick={() => handleMobileAdd('rect')} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 text-gray-700" title="Rectangle">
                  <Square size={20} /><span className="text-[9px]">Rect</span>
                </button>
                <button onClick={() => handleMobileAdd('circle')} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 text-gray-700" title="Cercle">
                  <Circle size={20} /><span className="text-[9px]">Cercle</span>
                </button>
                <button onClick={() => handleMobileAdd('triangle')} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 text-gray-700" title="Triangle">
                  <Triangle size={20} /><span className="text-[9px]">Triangle</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => removeSelection(selectedIds)}
            disabled={selectedIds.length === 0}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-gray-100 disabled:opacity-30 text-gray-600"
            title="Supprimer"
          >
            <Trash2 size={20} />
            <span className="text-[9px]">Suppr.</span>
          </button>
          <button
            onClick={() => handleExport('png')}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg active:bg-gray-100 text-gray-600"
            title="Exporter"
          >
            <Download size={20} />
            <span className="text-[9px]">Export</span>
          </button>
        </nav>

        {/* Overlay backdrop pour drawers */}
        {(sidebarOpen || layersOpen) && (
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => { setSidebarOpen(false); setLayersOpen(false); }}
          />
        )}

        {/* Drawer Sidebar (gauche) */}
        <div className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] transform transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-full relative">
            <Sidebar {...sidebarProps} />
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 z-10"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Drawer Calques (droite) */}
        <div className={`fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] transform transition-transform duration-300 ease-out ${layersOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-full relative">
            <LayersPanel {...layersPanelProps} />
            <button
              onClick={() => setLayersOpen(false)}
              className="absolute top-3 left-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 z-10"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── DESKTOP LAYOUT (inchangé) ── */
  return (
    <div className="flex h-screen w-screen bg-[#eef0f2] overflow-hidden font-sans text-gray-900 selection:bg-blue-200">
      <Sidebar {...sidebarProps} />
      <main ref={mainRef} className="flex-1 h-full relative overflow-hidden flex items-center justify-center">
        {canvasJsx}
        {/* Zoom Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-2 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 text-xs font-mono text-gray-600">
          <button onClick={() => setZoom(z => Math.max(0.1, z - 0.25))} className="p-1 hover:bg-gray-100 rounded" title="Dézoomer (Ctrl + -)"><Minus size={14} /></button>
          <span className="w-12 text-center cursor-pointer hover:bg-gray-100 rounded" onClick={() => setZoom(1)} title="Taille réelle (Ctrl + 0)">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} className="p-1 hover:bg-gray-100 rounded" title="Zoomer (Ctrl + +)"><Plus size={14} /></button>
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
          <span>{elements.length} éléments</span>
          {selectedIds.length > 0 && <span>{selectedIds.length} sél.</span>}
          <span>{canvasWidth}x{canvasHeight}px</span>
        </div>
      </main>

      <LayersPanel {...layersPanelProps} />
    </div>
  );
}

export default App;
