import { useEffect, useRef, useCallback } from 'react';
import { useComposition } from './hooks/useComposition';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { LayersPanel } from './components/LayersPanel';
import type { ElementBounds, AlignDirection, DistributeAxis } from './types';

// Polices Google utilisées dans l'éditeur (pour tentative d'embarquement à l'export)
const GOOGLE_FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;700;900&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Outfit:wght@400;700;900&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Space+Grotesk:wght@400;700&family=Syne:wght@400;700;800&display=swap';

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

  // Raccourcis clavier globaux
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      const mod = e.ctrlKey || e.metaKey;
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

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden font-sans text-gray-900">
      <Sidebar
        elements={elements}
        selectedElement={selectedElement}
        selectedIds={selectedIds}
        selectionCount={selectedIds.length}
        elementCount={elements.length}
        backgroundColor={backgroundColor}
        customColors={customColors}
        customFonts={customFonts}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        canUndo={canUndo}
        canRedo={canRedo}
        autoCanvasSize={autoCanvasSize}
        onToggleAutoCanvasSize={() => setAutoCanvasSize(!autoCanvasSize)}
        onAddElement={addElement}
        onUpdateElement={updateElement}
        onUpdateElementLive={updateElementLive}
        onBeginHistory={beginHistory}
        onRemoveElement={(id) => removeSelection([id])}
        onDuplicate={() => duplicateSelection(selectedIds)}
        onUpdateBackground={setBackgroundColor}
        onSaveColor={saveColor}
        onAddCustomFont={addCustomFont}
        onBringToFront={() => bringToFront(selectedIds)}
        onSendToBack={() => sendToBack(selectedIds)}
        onBringForward={() => bringForward(selectedIds)}
        onSendBackward={() => sendBackward(selectedIds)}
        onFlip={flipSelection}
        onExport={handleExport}
        onClearCanvas={clearCanvas}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        onUndo={undo}
        onRedo={redo}
        onApplyColor={(color) => applyColor(color, selectedIds)}
        onGroup={() => groupSelection(selectedIds)}
        onUngroup={() => ungroupSelection(selectedIds)}
        onSetCanvasSize={handleSetCanvasSize}
        onLoadTemplate={(tpl) => { setAutoCanvasSize(false); loadTemplate(tpl); }}
      />
      <main ref={mainRef} className="flex-1 h-full relative overflow-hidden flex items-center justify-center">
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
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          onBringForward={bringForward}
          onSendBackward={sendBackward}
          />
        {/* Status Bar */}
        <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
          <span>{elements.length} éléments</span>
          {selectedIds.length > 0 && <span>{selectedIds.length} sél.</span>}
          <span>{canvasWidth}x{canvasHeight}px</span>
        </div>
      </main>

      <LayersPanel
        elements={elements}
        selectedIds={selectedIds}
        onSelect={selectElement}
        onReorder={reorderElements}
        onToggleVisible={toggleVisible}
        onToggleLock={toggleLock}
        onRename={renameElement}
        onRemove={(id) => removeSelection([id])}
      />
    </div>
  );
}

export default App;
