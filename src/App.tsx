import { useEffect, useRef, useCallback, useState } from 'react';
import { useComposition } from './hooks/useComposition';
import { useIsMobile } from './hooks/useIsMobile';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { LayersPanel } from './components/LayersPanel';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { Plus, Minus, Menu, Layers, X, Type, Square, Circle, Triangle, Undo2, Redo2, Trash2, Download, Copy, ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { ElementBounds, AlignDirection, DistributeAxis, ElementType } from './types';

// Polices Google utilisées dans l'éditeur (pour tentative d'embarquement à l'export)
const GOOGLE_FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Oswald:wght@400;700&family=Outfit:wght@400;700;900&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Poppins:wght@400;700;900&family=Righteous&family=Roboto+Mono:wght@400;700&family=Roboto:wght@400;700;900&family=Space+Grotesk:wght@400;700&family=Syne:wght@400;700;800&family=Work+Sans:wght@400;700;900&display=swap';

function App() {
  const {
    name: projectName,
    elements,
    selectedIds,
    backgroundColor,
    backgroundGradient,
    canvasWidth,
    canvasHeight,
    customColors,
    customFonts,
    canUndo,
    canRedo,
    setProjectName,
    addElement,
    addImage,
    loadProject,
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
    setBackgroundGradient,
    setBackgroundGradientLive,
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
  // Mesure fraîche à la demande (alignement) : évite un cache périmé (polices, etc.)
  const measureRef = useRef<(() => ElementBounds) | null>(null);
  const freshBounds = useCallback(() => measureRef.current?.() ?? boundsRef.current, []);
  const handleAlign = useCallback(
    (dir: AlignDirection, toPage: boolean) => alignElements(dir, selectedIds, freshBounds(), toPage),
    [alignElements, selectedIds, freshBounds],
  );
  const handleDistribute = useCallback(
    (axis: DistributeAxis) => distributeElements(axis, selectedIds, freshBounds()),
    [distributeElements, selectedIds, freshBounds],
  );

  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
        if (e.key === '?' && !typing) { e.preventDefault(); setHelpOpen((v) => !v); }
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

  // Nom de fichier basé sur le titre du projet (caractères interdits retirés).
  const fileBase = (fallback: string) =>
    projectName.trim().replace(/[\\/:*?"<>|]+/g, '').trim() || fallback;

  // Sauvegarde du projet : JSON portable (polices embarquées en data URL).
  const handleExportProject = () => {
    const data = JSON.stringify({
      version: 1,
      elements, backgroundColor, canvasWidth, canvasHeight, customColors, customFonts,
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `${fileBase('bauhaus-projet')}.json`);
    URL.revokeObjectURL(url);
  };

  const handleImportProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        loadProject(parsed);
        setAutoCanvasSize(false);
      } catch {
        alert('Fichier projet invalide.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const href = e.target?.result as string;
      const img = new Image();
      img.onload = () => addImage(href, img.naturalWidth || 300, img.naturalHeight || 300);
      img.onerror = () => alert("Impossible de charger cette image.");
      img.src = href;
    };
    reader.readAsDataURL(file);
  };

  const handleExport = async (format: 'svg' | 'png' | 'jpg') => {
    const svgData = await buildExportSvg();
    if (!svgData) return;

    if (format === 'svg') {
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, `${fileBase('bauhaus-composition')}.svg`);
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
      downloadUrl(dataUrl, `${fileBase('bauhaus-composition')}.${format}`);
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
    backgroundGradient,
    onUpdateBackground: setBackgroundColor,
    onSetBackgroundGradient: setBackgroundGradient,
    onSetBackgroundGradientLive: setBackgroundGradientLive,
    onSaveColor: saveColor,
    onAddCustomFont: addCustomFont,
    onBringToFront: () => bringToFront(selectedIds),
    onSendToBack: () => sendToBack(selectedIds),
    onBringForward: () => bringForward(selectedIds),
    onSendBackward: () => sendBackward(selectedIds),
    onFlip: flipSelection,
    projectName,
    onSetProjectName: setProjectName,
    onExport: handleExport,
    onExportProject: handleExportProject,
    onImportProject: handleImportProject,
    onImportImage: handleImportImage,
    onClearCanvas: clearCanvas,
    onAlign: handleAlign,
    onDistribute: handleDistribute,
    onUndo: undo,
    onRedo: redo,
    onApplyColor: (color: string) => applyColor(color, selectedIds),
    onGroup: () => groupSelection(selectedIds),
    onUngroup: () => ungroupSelection(selectedIds),
    onCopyStyle: copyStyle,
    onPasteStyle: pasteStyle,
    hasCopiedStyle,
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
      backgroundGradient={backgroundGradient}
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
      measureRef={measureRef}
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
          <div className="flex flex-col items-center">
            <h1 className="text-sm font-black tracking-tight text-gray-900 leading-none">BAUHAUS GEN</h1>
            <div className="flex items-center gap-1.5 mt-0.5 text-[8px] font-mono text-gray-400 uppercase tracking-tighter">
              <span>v0.1.0</span>
              <span>•</span>
              <a href="https://github.com/mytil67/bauhausgen" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">@mytil</a>
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => setHelpOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-bold"
              title="Raccourcis"
            >
              ?
            </button>
            <button
              onClick={() => { setLayersOpen(true); setSidebarOpen(false); }}
              className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
              title="Calques"
            >
              <Layers size={22} />
            </button>
          </div>
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

        {/* Barre contextuelle flottante (élément sélectionné) */}
        {selectedIds.length > 0 && !mobileAddOpen && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 px-1.5 py-1.5 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-full shadow-2xl max-w-[94vw] overflow-x-auto"
            style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
          >
            <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-blue-500 text-white text-xs font-bold active:bg-blue-600 shrink-0" title="Options de l'élément">
              <SlidersHorizontal size={16} /> Options
            </button>
            <button onClick={() => duplicateSelection(selectedIds)} className="p-2.5 rounded-full active:bg-gray-100 text-gray-600 shrink-0" title="Dupliquer"><Copy size={18} /></button>
            <button onClick={() => bringForward(selectedIds)} className="p-2.5 rounded-full active:bg-gray-100 text-gray-600 shrink-0" title="Avancer"><ChevronUp size={18} /></button>
            <button onClick={() => sendBackward(selectedIds)} className="p-2.5 rounded-full active:bg-gray-100 text-gray-600 shrink-0" title="Reculer"><ChevronDown size={18} /></button>
            <button onClick={() => removeSelection(selectedIds)} className="p-2.5 rounded-full active:bg-red-50 text-red-500 shrink-0" title="Supprimer"><Trash2 size={18} /></button>
          </div>
        )}

        {/* Barre d'actions principale (flottante) */}
        <nav
          className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 px-1.5 py-1.5 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-full shadow-2xl"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <button onClick={undo} disabled={!canUndo} className="p-2.5 rounded-full active:bg-gray-100 disabled:opacity-30 text-gray-600" title="Annuler"><Undo2 size={20} /></button>
          <button onClick={redo} disabled={!canRedo} className="p-2.5 rounded-full active:bg-gray-100 disabled:opacity-30 text-gray-600" title="Rétablir"><Redo2 size={20} /></button>

          {/* Bouton ajouter central */}
          <div className="relative">
            <button
              onClick={() => setMobileAddOpen(!mobileAddOpen)}
              className={`p-3 rounded-full shadow-lg transition-colors mx-0.5 ${mobileAddOpen ? 'bg-gray-900 text-white' : 'bg-blue-500 text-white active:bg-blue-600'}`}
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

          <button onClick={() => handleExport('png')} className="p-2.5 rounded-full active:bg-gray-100 text-gray-600" title="Exporter en PNG"><Download size={20} /></button>
        </nav>

        {/* Backdrop léger : le design reste visible au-dessus du bottom sheet ; tap pour fermer */}
        {(sidebarOpen || layersOpen) && (
          <div
            className="fixed inset-0 z-40 bg-black/10"
            onClick={() => { setSidebarOpen(false); setLayersOpen(false); }}
          />
        )}

        {/* Bottom sheet — Réglages (le canvas reste visible, aperçu en direct) */}
        <div
          className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ height: '62vh' }}
        >
          <div className="h-full bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden">
            <div className="relative shrink-0 pt-2.5 pb-2 flex items-center justify-center border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
              <button onClick={() => setSidebarOpen(false)} className="absolute right-3 top-2 p-1.5 rounded-full bg-gray-100 active:bg-gray-200 text-gray-500"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Sidebar {...sidebarProps} />
            </div>
          </div>
        </div>

        {/* Bottom sheet — Calques */}
        <div
          className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${layersOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ height: '55vh' }}
        >
          <div className="h-full bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden">
            <div className="relative shrink-0 pt-2.5 pb-2 flex items-center justify-center border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
              <button onClick={() => setLayersOpen(false)} className="absolute right-3 top-2 p-1.5 rounded-full bg-gray-100 active:bg-gray-200 text-gray-500"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <LayersPanel {...layersPanelProps} />
            </div>
          </div>
        </div>

        {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
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
          <span className="w-px h-3.5 bg-gray-200" />
          <button onClick={() => setHelpOpen(true)} className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 rounded-full font-bold" title="Raccourcis clavier (?)">?</button>
        </div>

        {/* Status Bar & Credits */}
        <div className="absolute bottom-4 right-4 flex items-center gap-3">
          <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            <span>{elements.length} éléments</span>
            {selectedIds.length > 0 && <span>{selectedIds.length} sél.</span>}
            <span>{canvasWidth}x{canvasHeight}px</span>
          </div>
          <div className="bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-3 text-[10px] font-mono text-gray-400">
            <span>v0.1.0</span>
            <span className="w-px h-2.5 bg-gray-200" />
            <a 
              href="https://github.com/mytil67/bauhausgen" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
              <span>@mytil</span>
            </a>
          </div>
        </div>
      </main>

      <LayersPanel {...layersPanelProps} />
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

export default App;
