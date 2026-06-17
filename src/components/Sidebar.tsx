import React, { useRef, useState } from 'react';
import type { CompositionElement, ElementType, ShapeType, CustomFont, AlignDirection, DistributeAxis } from '../types';
import { TEMPLATES, type Template } from '../templates';
import {
  Type,
  Trash2,
  Download,
  Palette,
  LayoutTemplate,
  Frame,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUp,
  ArrowDown,
  Upload,
  Copy,
  Undo2,
  Redo2,
  Italic,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  FlipHorizontal,
  FlipVertical,
  ChevronUp,
  ChevronDown,
  Underline,
  Strikethrough,
  Pipette,
  Brush,
  Image as ImageIcon,
  Save,
  FolderOpen,
} from 'lucide-react';

interface SidebarProps {
  elements: CompositionElement[];
  selectedElement: CompositionElement | null;
  selectedIds: string[];
  selectionCount: number;
  elementCount: number;
  backgroundColor: string;
  customColors: string[];
  customFonts: CustomFont[];
  canvasWidth: number;
  canvasHeight: number;
  canUndo: boolean;
  canRedo: boolean;
  autoCanvasSize: boolean;
  onToggleAutoCanvasSize: () => void;
  onAddElement: (type: ElementType) => void;
  onUpdateElement: (id: string, updates: Partial<CompositionElement>) => void;
  onUpdateElementLive: (id: string, updates: Partial<CompositionElement>) => void;
  onBeginHistory: () => void;
  onRemoveElement: (id: string) => void;
  onDuplicate: () => void;
  onUpdateBackground: (color: string) => void;
  onSaveColor: (color: string) => void;
  onAddCustomFont: (name: string, data: string) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onFlip: (axis: 'horizontal' | 'vertical', ids: string[]) => void;
  projectName: string;
  onSetProjectName: (name: string) => void;
  onExport: (format: 'svg' | 'png' | 'jpg') => void;
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onImportImage: (file: File) => void;
  onClearCanvas: () => void;
  onAlign: (direction: AlignDirection, toPage: boolean) => void;
  onDistribute: (axis: DistributeAxis) => void;
  onUndo: () => void;
  onRedo: () => void;
  onApplyColor: (color: string) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onCopyStyle: (id: string) => void;
  onPasteStyle: (ids: string[]) => void;
  hasCopiedStyle: boolean;
  onSetCanvasSize: (w: number, h: number) => void;
  onLoadTemplate: (tpl: Template) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
}

const ensureFullHex = (color: string): string => {
  if (!color.startsWith('#')) color = '#' + color;
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  return '#000000';
};

// Aperçu vectoriel d'une forme (pour les boutons d'ajout)
const ShapeIcon: React.FC<{ type: ShapeType }> = ({ type }) => {
  const c = 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill={c}>
      {type === 'rect' && <rect x="3" y="5" width="14" height="10" />}
      {type === 'circle' && <circle cx="10" cy="10" r="7" />}
      {type === 'triangle' && <polygon points="10,3 17,17 3,17" />}
      {type === 'semicircle' && <path d="M3,13 A7,7 0 0 1 17,13 Z" />}
      {type === 'quarter' && <path d="M4,16 L16,16 A12,12 0 0 0 4,4 Z" />}
      {type === 'ring' && <circle cx="10" cy="10" r="6" fill="none" stroke={c} strokeWidth="3" />}
      {type === 'line' && <rect x="3" y="9" width="14" height="2" />}
    </svg>
  );
};

const SHAPES: { type: ShapeType; label: string }[] = [
  { type: 'rect', label: 'Rectangle' },
  { type: 'circle', label: 'Cercle' },
  { type: 'triangle', label: 'Triangle' },
  { type: 'semicircle', label: 'Demi-cercle' },
  { type: 'quarter', label: 'Quart' },
  { type: 'ring', label: 'Anneau' },
  { type: 'line', label: 'Ligne' },
];

const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Primaire', colors: ['#e63946', '#f4a261', '#1d3557', '#1a1a1a', '#f1faee'] },
  { name: 'Weimar', colors: ['#d62828', '#fcbf49', '#003049', '#eae2b7', '#1a1a1a'] },
  { name: 'Dessau', colors: ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#ffffff'] },
  { name: 'Mono', colors: ['#1a1a1a', '#4a4a4a', '#8a8a8a', '#cfcfcf', '#ffffff'] },
];

const CANVAS_PRESETS: { name: string; w: number; h: number }[] = [
  { name: 'Carré', w: 1080, h: 1080 },
  { name: 'Story', w: 1080, h: 1920 },
  { name: 'Post', w: 1080, h: 1350 },
  { name: 'Bannière', w: 1500, h: 500 },
  { name: 'A4 ↕', w: 1240, h: 1754 },
];

const GOOGLE_FONTS = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Montserrat', value: "'Montserrat', sans-serif" },
  { label: 'Outfit', value: "'Outfit', sans-serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'Syne', value: "'Syne', sans-serif" },
  { label: 'Archivo Black', value: "'Archivo Black', sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'Libre Baskerville', value: "'Libre Baskerville', serif" },
  { label: 'Roboto', value: "'Roboto', sans-serif" },
  { label: 'Poppins', value: "'Poppins', sans-serif" },
  { label: 'Oswald', value: "'Oswald', sans-serif" },
  { label: 'Bebas Neue', value: "'Bebas Neue', sans-serif" },
  { label: 'Righteous', value: "'Righteous', display" },
  { label: 'Anton', value: "'Anton', sans-serif" },
  { label: 'Work Sans', value: "'Work Sans', sans-serif" },
  { label: 'Roboto Mono', value: "'Roboto Mono', monospace" },
];

type Shadow = { x: number; y: number; blur: number; color: string; opacity: number };
// Préréglages d'ombres de texte (stacks de text-shadow)
const SHADOW_PRESETS: { label: string; shadows: Shadow[] }[] = [
  { label: 'Douce', shadows: [{ x: 2, y: 3, blur: 6, color: '#000000', opacity: 0.4 }] },
  { label: 'Dure', shadows: [{ x: 4, y: 4, blur: 0, color: '#000000', opacity: 1 }] },
  { label: 'Longue', shadows: Array.from({ length: 16 }, (_, i) => ({ x: i + 1, y: i + 1, blur: 0, color: '#1a1a1a', opacity: 1 })) },
  { label: 'Néon', shadows: [{ x: 0, y: 0, blur: 6, color: '#ec4899', opacity: 0.9 }, { x: 0, y: 0, blur: 16, color: '#ec4899', opacity: 0.7 }] },
  { label: 'Contour', shadows: ([[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]] as const).map(([x, y]) => ({ x, y, blur: 0, color: '#000000', opacity: 1 })) },
];

export const Sidebar: React.FC<SidebarProps> = ({
  elements,
  selectedElement,
  selectedIds,
  selectionCount,
  elementCount,
  backgroundColor,
  customColors,
  customFonts,
  canvasWidth,
  canvasHeight,
  canUndo,
  canRedo,
  autoCanvasSize,
  onToggleAutoCanvasSize,
  onAddElement,
  onUpdateElement,
  onUpdateElementLive,
  onBeginHistory,
  onRemoveElement,
  onDuplicate,
  onUpdateBackground,
  onSaveColor,
  onAddCustomFont,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onFlip,
  projectName,
  onSetProjectName,
  onExport,
  onExportProject,
  onImportProject,
  onImportImage,
  onClearCanvas,
  onAlign,
  onDistribute,
  onUndo,
  onRedo,
  onApplyColor,
  onGroup,
  onUngroup,
  onCopyStyle,
  onPasteStyle,
  hasCopiedStyle,
  onSetCanvasSize,
  onLoadTemplate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [alignToPage, setAlignToPage] = useState(false);
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    transform: true,
    appearance: true,
    text: true,
    effects: false,
    document: true,
    export: true
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const canAlignSelection = selectionCount >= 2;
  const effectiveToPage = canAlignSelection ? alignToPage : true;
  const canAlign = effectiveToPage ? elementCount >= 1 : canAlignSelection;
  const canDistribute = selectionCount >= 3 || (selectionCount < 3 && elementCount >= 3);

  const alignButtons = [
    { dir: 'left', Icon: AlignStartVertical, label: 'Gauche' },
    { dir: 'center', Icon: AlignCenterVertical, label: 'Centre H' },
    { dir: 'right', Icon: AlignEndVertical, label: 'Droite' },
    { dir: 'top', Icon: AlignStartHorizontal, label: 'Haut' },
    { dir: 'middle', Icon: AlignCenterHorizontal, label: 'Milieu V' },
    { dir: 'bottom', Icon: AlignEndHorizontal, label: 'Bas' },
  ] as const;

  const handleColorInput = (val: string, callback: (color: string) => void) => {
    let normalized = val;
    if (!val.startsWith('#') && val.length > 0) normalized = '#' + val;
    if (/^#[0-9A-Fa-f]{0,6}$/.test(normalized) || normalized === '') {
      callback(normalized);
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const reader = new FileReader();

    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        const fontFace = new FontFace(fontName, `url(${dataUrl})`);
        await fontFace.load();
        document.fonts.add(fontFace);
        onAddCustomFont(fontName, dataUrl);
        if (selectedElement?.type === 'text') {
          onUpdateElement(selectedElement.id, { fontFamily: fontName });
        }
      } catch (err) {
        console.error('Erreur chargement police:', err);
        alert('Impossible de charger cette police.');
      }
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="w-full md:w-[360px] h-full bg-white border-r border-gray-100 flex shadow-2xl z-10 overflow-hidden shrink-0">
      {/* Inputs fichier (toujours montés, partagés par les boutons d'import) */}
      <input type="file" ref={fileInputRef} onChange={handleFontUpload} accept=".ttf,.otf,.woff,.woff2" className="hidden" />
      <input type="file" ref={imageInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportImage(f); e.target.value = ''; }} accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp" className="hidden" />
      <input type="file" ref={projectInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportProject(f); e.target.value = ''; }} accept="application/json,.json" className="hidden" />
      {/* 1. TOOL STRIP (Fixe à gauche) */}
      <aside className="w-14 h-full bg-gray-50 border-r border-gray-100 flex flex-col items-center py-4 gap-4 shrink-0">
        <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center text-[10px] font-black text-white mb-2">B</div>
        
        <div className="flex flex-col gap-1 w-full px-2">
          <button onClick={() => onAddElement('text')} title="Texte" className="w-full aspect-square flex items-center justify-center rounded hover:bg-blue-50 hover:text-blue-600 text-gray-500 transition-colors">
            <Type size={20} />
          </button>
          <div className="h-px bg-gray-200 my-1 mx-2" />
          {SHAPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onAddElement(type)}
              title={label}
              className="w-full aspect-square flex items-center justify-center rounded hover:bg-blue-50 hover:text-blue-600 text-gray-500 transition-colors"
            >
              <ShapeIcon type={type} />
            </button>
          ))}
          <div className="h-px bg-gray-200 my-1 mx-2" />
          <button onClick={() => imageInputRef.current?.click()} title="Importer une image (PNG/SVG)" className="w-full aspect-square flex items-center justify-center rounded hover:bg-blue-50 hover:text-blue-600 text-gray-500 transition-colors">
            <ImageIcon size={20} />
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-1 w-full px-2">
          <button onClick={onUndo} disabled={!canUndo} title="Annuler" className="w-full aspect-square flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-20 text-gray-500 transition-colors">
            <Undo2 size={18} />
          </button>
          <button onClick={onRedo} disabled={!canRedo} title="Rétablir" className="w-full aspect-square flex items-center justify-center rounded hover:bg-gray-200 disabled:opacity-20 text-gray-500 transition-colors">
            <Redo2 size={18} />
          </button>
        </div>
      </aside>

      {/* 2. PROPERTIES PANEL (Contextuel) */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar bg-white">
        {/* Header dynamique */}
        <header className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-20">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
            {selectionCount === 0 ? 'Réglages Document' : selectionCount === 1 ? `Propriétés : ${selectedElement?.type}` : `${selectionCount} Éléments sélectionnés`}
          </h2>
        </header>

        <div className="p-4 space-y-6">
          {selectionCount === 0 ? (
            /* --- MODE DOCUMENT --- */
            <>
              <section>
                <button onClick={() => toggleSection('document')} className="w-full flex items-center justify-between mb-3 group">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    <Frame size={14} className="text-gray-400" /> Format du Canvas
                  </span>
                  <ChevronDown size={14} className={`text-gray-300 transition-transform ${openSections.document ? '' : '-rotate-90'}`} />
                </button>
                {openSections.document && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 p-2 rounded border border-gray-100">
                        <label className="text-[9px] font-bold text-gray-400 block mb-1 uppercase">Largeur</label>
                        <input type="number" value={canvasWidth} onChange={(e) => onSetCanvasSize(Number(e.target.value), canvasHeight)} className="w-full bg-transparent text-sm font-mono outline-none" />
                      </div>
                      <div className="bg-gray-50 p-2 rounded border border-gray-100">
                        <label className="text-[9px] font-bold text-gray-400 block mb-1 uppercase">Hauteur</label>
                        <input type="number" value={canvasHeight} onChange={(e) => onSetCanvasSize(canvasWidth, Number(e.target.value))} className="w-full bg-transparent text-sm font-mono outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={onToggleAutoCanvasSize} className={`py-2 rounded border text-[9px] font-bold uppercase transition-all ${autoCanvasSize ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>Auto</button>
                      {CANVAS_PRESETS.map((p) => (
                        <button key={p.name} onClick={() => onSetCanvasSize(p.w, p.h)} className={`py-2 rounded border text-[9px] font-bold uppercase transition-all ${!autoCanvasSize && canvasWidth === p.w && canvasHeight === p.h ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{p.name}</button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                  <Palette size={14} className="text-gray-400" /> Couleur de Fond
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100 mb-3">
                  <div className="relative w-8 h-8 rounded border border-gray-200 overflow-hidden shrink-0">
                    <input type="color" value={ensureFullHex(backgroundColor)} onChange={(e) => onUpdateBackground(e.target.value)} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" />
                  </div>
                  <input type="text" value={backgroundColor} onChange={(e) => handleColorInput(e.target.value, onUpdateBackground)} className="bg-transparent text-sm font-mono uppercase outline-none flex-1 w-20" />
                  <button onClick={() => onSaveColor(backgroundColor)} className="text-[10px] font-bold text-blue-600 uppercase hover:underline shrink-0">Mémoriser</button>
                </div>
                <div className="space-y-3">
                  {PALETTES.map((pal) => (
                    <div key={pal.name} className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{pal.name}</span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {pal.colors.map((c) => (
                          <button key={c} onClick={() => onApplyColor(c)} className="aspect-square rounded-sm border border-gray-100 hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {customColors.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Mes Couleurs</span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {customColors.map((c, i) => (
                          <button key={`${c}-${i}`} onClick={() => onApplyColor(c)} className="aspect-square rounded-sm border border-gray-100 hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                  <LayoutTemplate size={14} className="text-gray-400" /> Templates
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button key={tpl.name} onClick={() => { if (window.confirm(`Charger « ${tpl.name} » ?`)) onLoadTemplate(tpl); }} className="text-left px-3 py-2 bg-white hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200 text-xs font-medium transition-all group">
                      {tpl.name} <span className="float-right text-gray-300 group-hover:text-blue-400">→</span>
                    </button>
                  ))}
                </div>
              </section>
              
              <section>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                  <Upload size={14} className="text-gray-400" /> Mes Polices
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-gray-50 hover:bg-white text-gray-600 border border-gray-200 rounded text-[10px] font-bold uppercase transition-all">Charger OTF/TTF</button>
              </section>
            </>
          ) : (
            /* --- MODE ÉLÉMENT (SÉLECTION) --- */
            <>
              <section>
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded mb-3">
                  <button onClick={() => canAlignSelection && setAlignToPage(false)} disabled={!canAlignSelection} className={`py-1 rounded text-[9px] font-bold uppercase transition-all ${!effectiveToPage ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'} disabled:opacity-20`}>Sélection</button>
                  <button onClick={() => setAlignToPage(true)} className={`py-1 rounded text-[9px] font-bold uppercase transition-all ${effectiveToPage ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>Page</button>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {alignButtons.map(({ dir, Icon, label }) => (
                    <button key={dir} onClick={() => onAlign(dir, effectiveToPage)} disabled={!canAlign} className="aspect-square flex items-center justify-center rounded bg-gray-50 border border-gray-100 hover:border-blue-300 hover:text-blue-600 text-gray-500 disabled:opacity-20 transition-all" title={label}><Icon size={14} /></button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={() => onDistribute('horizontal')} disabled={!canDistribute} className="flex items-center justify-center gap-2 py-1.5 bg-gray-50 border border-gray-100 rounded text-[9px] font-bold uppercase text-gray-500 hover:bg-white disabled:opacity-20 transition-all">Espacer H</button>
                  <button onClick={() => onDistribute('vertical')} disabled={!canDistribute} className="flex items-center justify-center gap-2 py-1.5 bg-gray-50 border border-gray-100 rounded text-[9px] font-bold uppercase text-gray-500 hover:bg-white disabled:opacity-20 transition-all">Espacer V</button>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-1 p-1 bg-gray-50 rounded border border-gray-100">
                    <button onClick={onBringToFront} title="Premier plan" className="p-1.5 hover:bg-white rounded text-gray-500"><ArrowUp size={14} /></button>
                    <button onClick={onBringForward} title="Avancer" className="p-1.5 hover:bg-white rounded text-gray-500"><ChevronUp size={14} /></button>
                    <button onClick={onSendBackward} title="Reculer" className="p-1.5 hover:bg-white rounded text-gray-500"><ChevronDown size={14} /></button>
                    <button onClick={onSendToBack} title="Arrière plan" className="p-1.5 hover:bg-white rounded text-gray-500"><ArrowDown size={14} /></button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={onDuplicate} title="Dupliquer" className="p-2 bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded border border-gray-100"><Copy size={16} /></button>
                    <button onClick={() => selectedIds.forEach(id => onRemoveElement(id))} title="Supprimer" className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded border border-red-100"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={onGroup} disabled={selectionCount < 2} className="flex-1 py-1.5 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold uppercase text-gray-500 hover:bg-white transition-all disabled:opacity-20">Grouper</button>
                  {(selectedElement?.groupId || selectedIds.some(id => elements.find(e => e.id === id)?.groupId)) && (
                    <button onClick={onUngroup} className="flex-1 py-1.5 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold uppercase text-gray-500 hover:bg-white transition-all">Dégrouper</button>
                  )}
                </div>
                {/* Copier / coller la mise en forme (police, taille, couleur, effets…) */}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => selectionCount === 1 && onCopyStyle(selectedIds[0])} disabled={selectionCount !== 1} title="Copier police, taille, couleur, effets… (Ctrl+Alt+C)" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold uppercase text-gray-500 hover:bg-white hover:text-blue-600 transition-all disabled:opacity-20"><Pipette size={13} /> Copier le format</button>
                  <button onClick={() => onPasteStyle(selectedIds)} disabled={!hasCopiedStyle || selectionCount === 0} title="Appliquer la mise en forme copiée (Ctrl+Alt+V)" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold uppercase text-gray-500 hover:bg-white hover:text-blue-600 transition-all disabled:opacity-20"><Brush size={13} /> Coller</button>
                </div>
              </section>

              {selectionCount === 1 && selectedElement && (
                <>
                  <section>
                    <button onClick={() => toggleSection('transform')} className="w-full flex items-center justify-between mb-3 group">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-900">Transformation</span>
                      <ChevronDown size={14} className={`text-gray-300 transition-transform ${openSections.transform ? '' : '-rotate-90'}`} />
                    </button>
                    {openSections.transform && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-50 p-2 rounded border border-gray-100">
                            <label className="text-[9px] font-bold text-gray-400 block mb-0.5 uppercase">X</label>
                            <input type="number" value={Math.round(selectedElement.x)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { x: Number(e.target.value) })} className="w-full bg-transparent text-sm font-mono outline-none" />
                          </div>
                          <div className="bg-gray-50 p-2 rounded border border-gray-100">
                            <label className="text-[9px] font-bold text-gray-400 block mb-0.5 uppercase">Y</label>
                            <input type="number" value={Math.round(selectedElement.y)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { y: Number(e.target.value) })} className="w-full bg-transparent text-sm font-mono outline-none" />
                          </div>
                        </div>
                        {selectedElement.type !== 'text' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gray-50 p-2 rounded border border-gray-100">
                              <label className="text-[9px] font-bold text-gray-400 block mb-0.5 uppercase">Largeur</label>
                              <input type="number" value={Math.round(selectedElement.width)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { width: Number(e.target.value) })} className="w-full bg-transparent text-sm font-mono outline-none" />
                            </div>
                            <div className="bg-gray-50 p-2 rounded border border-gray-100">
                              <label className="text-[9px] font-bold text-gray-400 block mb-0.5 uppercase">Hauteur</label>
                              <input type="number" value={Math.round(selectedElement.height)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { height: Number(e.target.value) })} className="w-full bg-transparent text-sm font-mono outline-none" />
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div>
                            <div className="flex justify-between items-center mb-1.5"><label className="text-[9px] font-bold text-gray-400 uppercase">Rotation</label><div className="flex items-center gap-0.5"><input type="number" value={Math.round(selectedElement.rotation)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { rotation: Number(e.target.value) })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /><span className="text-[9px] font-mono text-gray-400">°</span></div></div>
                            <input type="range" min="0" max="360" value={selectedElement.rotation} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { rotation: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1.5"><label className="text-[9px] font-bold text-gray-400 uppercase">Opacité</label><div className="flex items-center gap-0.5"><input type="number" value={Math.round(selectedElement.opacity * 100)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { opacity: Number(e.target.value) / 100 })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /><span className="text-[9px] font-mono text-gray-400">%</span></div></div>
                            <input type="range" min="0" max="1" step="0.01" value={selectedElement.opacity} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { opacity: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => onFlip('horizontal', selectedIds)} className="flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-bold uppercase text-gray-600 border border-gray-100 transition-all"><FlipHorizontal size={14} /> Flip H</button>
                          <button onClick={() => onFlip('vertical', selectedIds)} className="flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-bold uppercase text-gray-600 border border-gray-100 transition-all"><FlipVertical size={14} /> Flip V</button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section>
                    <button onClick={() => toggleSection('appearance')} className="w-full flex items-center justify-between mb-3 group">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-900">Apparence</span>
                      <ChevronDown size={14} className={`text-gray-300 transition-transform ${openSections.appearance ? '' : '-rotate-90'}`} />
                    </button>
                    {openSections.appearance && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 block mb-2 uppercase tracking-wide">Fusion</label>
                          <select value={selectedElement.blendMode ?? 'normal'} onChange={(e) => onUpdateElement(selectedElement.id, { blendMode: e.target.value as any })} className="w-full p-2 bg-gray-50 border border-gray-100 rounded text-xs focus:bg-white outline-none">
                            <option value="normal">Normal</option><option value="multiply">Produit</option><option value="screen">Superposition</option><option value="overlay">Incrustation</option><option value="difference">Différence</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 block mb-2 uppercase tracking-wide">Couleur</label>
                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100 mb-3">
                            <div className="relative w-8 h-8 rounded border border-gray-200 overflow-hidden shrink-0"><input type="color" value={ensureFullHex(selectedElement.color)} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { color: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" /></div>
                            <input type="text" value={selectedElement.color} onChange={(e) => handleColorInput(e.target.value, (color) => onUpdateElement(selectedElement.id, { color }))} className="bg-transparent text-sm font-mono uppercase outline-none flex-1 w-20" />
                            <button onClick={() => onSaveColor(selectedElement.color)} className="text-[10px] font-bold text-blue-600 uppercase shrink-0">Mémoriser</button>
                          </div>
                          {!selectedElement.gradient ? (
                            <button onClick={() => onUpdateElement(selectedElement.id, { gradient: { type: 'linear', rotation: 0, colors: [{ offset: 0, color: selectedElement.color, opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 1 }] } })} className="w-full py-1.5 border border-dashed border-gray-300 rounded text-[9px] font-bold uppercase text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-all">+ Dégradé</button>
                          ) : (
                            <div className="p-3 bg-gray-50 rounded border border-gray-100 space-y-3">
                              <div className="flex justify-between items-center"><select value={selectedElement.gradient.type} onChange={(e) => onUpdateElementLive(selectedElement.id, { gradient: { ...selectedElement.gradient!, type: e.target.value as any } })} className="text-[10px] font-bold bg-transparent outline-none"><option value="linear">Linéaire</option><option value="radial">Radial</option></select><button onClick={() => onUpdateElement(selectedElement.id, { gradient: undefined })} className="text-[9px] text-red-500 font-bold uppercase">Supprimer</button></div>
                              <div className="space-y-2">{selectedElement.gradient.colors.map((c, i) => (<div key={i} className="flex gap-2 items-center"><div className="relative w-5 h-5 rounded border border-gray-200 bg-white overflow-hidden shrink-0"><input type="color" value={ensureFullHex(c.color)} onMouseDown={onBeginHistory} onChange={(e) => { const newColors = [...selectedElement.gradient!.colors]; newColors[i] = { ...newColors[i], color: e.target.value }; onUpdateElementLive(selectedElement.id, { gradient: { ...selectedElement.gradient!, colors: newColors } }); }} className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer" /></div><input type="range" min="0" max="1" step="0.01" value={c.offset} onMouseDown={onBeginHistory} onChange={(e) => { const newColors = [...selectedElement.gradient!.colors]; newColors[i] = { ...newColors[i], offset: Number(e.target.value) }; onUpdateElementLive(selectedElement.id, { gradient: { ...selectedElement.gradient!, colors: newColors } }); }} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /></div>))}</div>
                            </div>
                          )}

                          {/* Motif (rayures / points / grille / damier) */}
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <label className="text-[9px] font-bold text-gray-400 block mb-2 uppercase tracking-wide">Motif</label>
                            <select
                              value={selectedElement.pattern?.type ?? 'none'}
                              onChange={(e) => {
                                const t = e.target.value;
                                if (t === 'none') { onUpdateElement(selectedElement.id, { pattern: undefined }); return; }
                                onUpdateElement(selectedElement.id, {
                                  pattern: {
                                    type: t as 'stripes' | 'dots' | 'grid' | 'checker',
                                    color: selectedElement.pattern?.color ?? '#1a1a1a',
                                    background: selectedElement.pattern?.background ?? selectedElement.color,
                                    scale: selectedElement.pattern?.scale ?? 1,
                                    angle: selectedElement.pattern?.angle ?? 0,
                                  },
                                });
                              }}
                              className="w-full p-2 bg-gray-50 border border-gray-100 rounded text-xs focus:bg-white outline-none"
                            >
                              <option value="none">Aucun motif</option>
                              <option value="stripes">Rayures</option>
                              <option value="dots">Points</option>
                              <option value="grid">Grille</option>
                              <option value="checker">Damier</option>
                            </select>
                            {selectedElement.pattern && (
                              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-100 space-y-2">
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Motif</label>
                                    <div className="relative w-full h-6 rounded border border-gray-200 overflow-hidden bg-white"><input type="color" value={ensureFullHex(selectedElement.pattern.color)} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { pattern: { ...selectedElement.pattern!, color: e.target.value } })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" /></div>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Fond</label>
                                    <div className="relative w-full h-6 rounded border border-gray-200 overflow-hidden bg-white"><input type="color" value={ensureFullHex(selectedElement.pattern.background === 'transparent' ? '#ffffff' : selectedElement.pattern.background)} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { pattern: { ...selectedElement.pattern!, background: e.target.value } })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" /></div>
                                  </div>
                                </div>
                                <div><div className="flex justify-between items-center mb-1"><label className="text-[8px] font-bold text-gray-400 uppercase">Échelle</label><span className="text-[8px] font-mono text-gray-400">{selectedElement.pattern.scale.toFixed(2)}</span></div><input type="range" min="0.25" max="3" step="0.05" value={selectedElement.pattern.scale} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { pattern: { ...selectedElement.pattern!, scale: Number(e.target.value) } })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /></div>
                                <div><div className="flex justify-between items-center mb-1"><label className="text-[8px] font-bold text-gray-400 uppercase">Angle</label><span className="text-[8px] font-mono text-gray-400">{selectedElement.pattern.angle}°</span></div><input type="range" min="0" max="360" step="1" value={selectedElement.pattern.angle} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { pattern: { ...selectedElement.pattern!, angle: Number(e.target.value) } })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /></div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {selectedElement.type === 'text' && (
                    <section>
                      <button onClick={() => toggleSection('text')} className="w-full flex items-center justify-between mb-3 group">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-900">Typographie</span>
                        <ChevronDown size={14} className={`text-gray-300 transition-transform ${openSections.text ? '' : '-rotate-90'}`} />
                      </button>
                      {openSections.text && (
                        <div className="space-y-4">
                          <textarea value={selectedElement.text} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { text: e.target.value })} className="w-full p-2 bg-gray-50 border border-gray-100 rounded text-sm focus:bg-white outline-none min-h-[60px] resize-none" />
                          <div className="flex gap-2 items-stretch">
                            <div className="relative flex-1">
                              <button onClick={() => setIsFontPickerOpen(!isFontPickerOpen)} className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded text-left text-sm flex justify-between items-center hover:bg-white hover:border-blue-200 transition-all">
                                <span style={{ fontFamily: selectedElement.fontFamily }} className="truncate">{selectedElement.fontFamily.split(',')[0].replace(/['"]/g, '')}</span>
                                <ChevronDown size={14} className="text-gray-400" />
                              </button>
                              {isFontPickerOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setIsFontPickerOpen(false)} />
                                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-xl z-50 max-h-60 overflow-y-auto py-1">
                                    <div className="px-3 py-1 text-[8px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 sticky top-0">Google Fonts</div>
                                    {GOOGLE_FONTS.map(f => (<button key={f.value} onClick={() => { onUpdateElement(selectedElement.id, { fontFamily: f.value }); setIsFontPickerOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 ${selectedElement.fontFamily === f.value ? 'bg-blue-50 text-blue-600 font-bold' : ''}`} style={{ fontFamily: f.value }}>{f.label}</button>))}
                                    {customFonts.length > 0 && (
                                      <>
                                        <div className="px-3 py-1 mt-1 text-[8px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 sticky top-0 border-t">Mes Polices</div>
                                        {customFonts.map(f => (
                                          <button key={f.name} onClick={() => { onUpdateElement(selectedElement.id, { fontFamily: f.name }); setIsFontPickerOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${selectedElement.fontFamily === f.name ? 'bg-blue-50 text-blue-600 font-bold' : ''}`} style={{ fontFamily: f.name }}>{f.name}</button>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            {/* Import de police perso — hors de la liste déroulante */}
                            <button onClick={() => fileInputRef.current?.click()} className="shrink-0 px-3 bg-blue-50 text-blue-600 border border-blue-100 rounded flex items-center gap-1.5 text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors" title="Importer une police personnelle (OTF/TTF/WOFF)">
                              <Upload size={13} /> Police
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gray-50 p-2 rounded border border-gray-100"><label className="text-[9px] font-bold text-gray-400 block uppercase">Taille</label><input type="number" value={selectedElement.fontSize} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { fontSize: Number(e.target.value) })} className="w-full bg-transparent text-sm font-mono outline-none" /></div>
                            <div className="bg-gray-50 p-2 rounded border border-gray-100"><label className="text-[9px] font-bold text-gray-400 block uppercase">Graisse</label><select value={selectedElement.fontWeight} onChange={(e) => onUpdateElement(selectedElement.id, { fontWeight: e.target.value })} className="w-full bg-transparent text-xs font-bold outline-none cursor-pointer"><option value="normal">Normal</option><option value="bold">Gras</option><option value="100">Thin</option><option value="300">Light</option><option value="500">Medium</option><option value="700">Bold</option><option value="900">Black</option></select></div>
                          </div>
                          <div className="flex gap-1 p-1 bg-gray-50 rounded border border-gray-100">
                            <button onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'start' })} className={`flex-1 flex justify-center p-2 rounded ${selectedElement.textAlign === 'start' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}><AlignLeft size={16} /></button>
                            <button onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'middle' })} className={`flex-1 flex justify-center p-2 rounded ${(!selectedElement.textAlign || selectedElement.textAlign === 'middle') ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}><AlignCenter size={16} /></button>
                            <button onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'end' })} className={`flex-1 flex justify-center p-2 rounded ${selectedElement.textAlign === 'end' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}><AlignRight size={16} /></button>
                            <div className="w-px h-4 bg-gray-200 self-center mx-1" />
                            <button onClick={() => onUpdateElement(selectedElement.id, { italic: !selectedElement.italic })} className={`flex-1 flex justify-center p-2 rounded ${selectedElement.italic ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}><Italic size={16} /></button>
                            <button onClick={() => onUpdateElement(selectedElement.id, { fontVariant: selectedElement.fontVariant === 'small-caps' ? 'normal' : 'small-caps' })} className={`flex-1 flex justify-center p-2 rounded text-[10px] font-bold ${selectedElement.fontVariant === 'small-caps' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>Sᴄ</button>
                          </div>

                          {/* Casse, décoration & sens d'écriture */}
                          <div className="flex gap-1 p-1 bg-gray-50 rounded border border-gray-100">
                            <button onClick={() => onUpdateElement(selectedElement.id, { textTransform: selectedElement.textTransform === 'uppercase' ? 'none' : 'uppercase' })} className={`flex-1 flex justify-center p-2 rounded text-[10px] font-bold ${selectedElement.textTransform === 'uppercase' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`} title="Majuscules">AA</button>
                            <button onClick={() => onUpdateElement(selectedElement.id, { textTransform: selectedElement.textTransform === 'lowercase' ? 'none' : 'lowercase' })} className={`flex-1 flex justify-center p-2 rounded text-[10px] font-bold ${selectedElement.textTransform === 'lowercase' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`} title="Minuscules">aa</button>
                            <div className="w-px h-4 bg-gray-200 self-center mx-1" />
                            <button onClick={() => onUpdateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' })} className={`flex-1 flex justify-center p-2 rounded ${selectedElement.textDecoration === 'underline' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`} title="Souligné"><Underline size={15} /></button>
                            <button onClick={() => onUpdateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'line-through' ? 'none' : 'line-through' })} className={`flex-1 flex justify-center p-2 rounded ${selectedElement.textDecoration === 'line-through' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`} title="Barré"><Strikethrough size={15} /></button>
                            <button onClick={() => onUpdateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'overline' ? 'none' : 'overline' })} className={`flex-1 flex justify-center p-2 rounded text-[11px] font-bold leading-none ${selectedElement.textDecoration === 'overline' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`} title="Surligné"><span style={{ textDecoration: 'overline' }}>O</span></button>
                            <div className="w-px h-4 bg-gray-200 self-center mx-1" />
                            <button onClick={() => onUpdateElement(selectedElement.id, { writingMode: selectedElement.writingMode === 'vertical' ? 'horizontal' : 'vertical' })} className={`flex-1 flex justify-center p-2 rounded text-[11px] font-bold ${selectedElement.writingMode === 'vertical' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`} title="Texte vertical"><span style={{ writingMode: 'vertical-rl' as React.CSSProperties['writingMode'], lineHeight: 1 }}>A</span></button>
                          </div>

                          {/* Style & couleur de la décoration (si active) */}
                          {selectedElement.textDecoration && selectedElement.textDecoration !== 'none' && (
                            <div className="flex gap-2 items-center">
                              <select value={selectedElement.textDecorationStyle ?? 'solid'} onChange={(e) => onUpdateElement(selectedElement.id, { textDecorationStyle: e.target.value as 'solid' | 'dashed' | 'dotted' | 'wavy' })} className="flex-1 p-2 bg-gray-50 border border-gray-100 rounded text-xs focus:bg-white outline-none" title="Style du trait">
                                <option value="solid">Plein</option>
                                <option value="dashed">Tirets</option>
                                <option value="dotted">Pointillés</option>
                                <option value="wavy">Ondulé</option>
                              </select>
                              <div className="relative w-8 h-8 rounded border border-gray-200 overflow-hidden shrink-0 bg-white" title="Couleur du trait">
                                <input type="color" value={ensureFullHex(selectedElement.textDecorationColor ?? selectedElement.color)} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { textDecorationColor: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" />
                              </div>
                            </div>
                          )}
                          <div className="space-y-4">
                            <div><div className="flex justify-between items-center mb-1.5"><label className="text-[9px] font-bold text-gray-400 uppercase">Interlettrage</label><div className="flex items-center gap-0.5"><input type="number" step="0.5" value={selectedElement.letterSpacing ?? 0} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { letterSpacing: Number(e.target.value) })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /><span className="text-[9px] font-mono text-gray-400">px</span></div></div><input type="range" min="-10" max="50" step="0.5" value={selectedElement.letterSpacing ?? 0} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { letterSpacing: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /></div>

                            <div><div className="flex justify-between items-center mb-1.5"><label className="text-[9px] font-bold text-gray-400 uppercase">Espacement des mots</label><div className="flex items-center gap-0.5"><input type="number" step="0.5" value={selectedElement.wordSpacing ?? 0} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { wordSpacing: Number(e.target.value) })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /><span className="text-[9px] font-mono text-gray-400">px</span></div></div><input type="range" min="-10" max="50" step="0.5" value={selectedElement.wordSpacing ?? 0} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { wordSpacing: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /></div>

                            <div><div className="flex justify-between items-center mb-1.5"><label className="text-[9px] font-bold text-gray-400 uppercase">Interligne</label><div className="flex items-center gap-0.5"><input type="number" step="0.1" value={selectedElement.lineHeight ?? 1.2} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { lineHeight: Number(e.target.value) })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /></div></div><input type="range" min="0.5" max="3" step="0.1" value={selectedElement.lineHeight ?? 1.2} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { lineHeight: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /></div>

                            <div><div className="flex justify-between items-center mb-1.5"><label className="text-[9px] font-bold text-gray-400 uppercase">Étirement (Width)</label><div className="flex items-center gap-0.5"><input type="number" value={selectedElement.fontWidth ?? 100} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { fontWidth: Number(e.target.value) })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /><span className="text-[9px] font-mono text-gray-400">%</span></div></div><input type="range" min="50" max="200" step="1" value={selectedElement.fontWidth ?? 100} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { fontWidth: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /></div>

                            <div><div className="flex justify-between items-center mb-1.5"><label className="text-[9px] font-bold text-gray-400 uppercase">Largeur max (retour ligne)</label><div className="flex items-center gap-0.5"><input type="number" value={selectedElement.maxWidth ?? 0} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { maxWidth: Number(e.target.value) })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /></div></div><input type="range" min="0" max="2000" step="10" value={selectedElement.maxWidth ?? 0} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { maxWidth: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /><p className="text-[8px] text-gray-300 mt-1 italic">0 = ligne unique.</p></div>

                            <div className="p-2 bg-gray-50 rounded border border-gray-100 space-y-2">
                              <div className="flex justify-between items-center mb-1.5"><label className="text-[9px] font-bold text-gray-400 uppercase">Courbure</label><div className="flex items-center gap-0.5"><input type="number" value={selectedElement.curve ?? 0} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { curve: Number(e.target.value) })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /></div></div>
                              <input type="range" min="-100" max="100" step="1" value={selectedElement.curve ?? 0} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { curve: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900 mb-2" />
                              
                              {Math.abs(selectedElement.curve ?? 0) > 0 && (
                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200">
                                  <div>
                                    <label className="text-[8px] font-bold text-gray-400 block uppercase mb-1">Type</label>
                                    <select value={selectedElement.curveType ?? 'arc'} onChange={(e) => onUpdateElement(selectedElement.id, { curveType: e.target.value as 'arc' | 'circle' })} className="w-full bg-white border border-gray-200 rounded px-1 py-1 text-[9px] font-bold outline-none">
                                      <option value="arc">Arc de cercle</option>
                                      <option value="circle">Cercle 360°</option>
                                    </select>
                                  </div>
                                  <div className="flex items-center pt-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="checkbox" checked={!!selectedElement.curveInvert} onChange={(e) => onUpdateElement(selectedElement.id, { curveInvert: e.target.checked })} className="accent-gray-900" />
                                      <span className="text-[9px] font-bold text-gray-500 uppercase">Inverser</span>
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Options de Fond de Texte (Badge) */}
                            <div className="p-2 bg-gray-50 rounded border border-gray-100 space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="checkbox" checked={!!selectedElement.bgEnabled} onChange={(e) => onUpdateElement(selectedElement.id, { bgEnabled: e.target.checked })} className="accent-gray-900" />
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">Fond (Badge)</span>
                                </label>
                              </div>
                              {selectedElement.bgEnabled && (
                                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-200">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase">Couleur</label>
                                    <div className="relative w-full h-5 rounded border border-gray-200 overflow-hidden bg-white"><input type="color" value={ensureFullHex(selectedElement.bgColor ?? '#000000')} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { bgColor: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" /></div>
                                  </div>
                                  <div>
                                    <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Marge</label>
                                    <input type="number" value={selectedElement.bgPadding ?? 10} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { bgPadding: Number(e.target.value) })} className="w-full bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono outline-none" />
                                  </div>
                                  <div>
                                    <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Rayon</label>
                                    <input type="number" value={selectedElement.bgRadius ?? 0} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { bgRadius: Number(e.target.value) })} className="w-full bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono outline-none" />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Texte découpé (knockout) */}
                            <div className="p-2 bg-gray-50 rounded border border-gray-100 space-y-2">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={!!selectedElement.knockout} onChange={(e) => onUpdateElement(selectedElement.id, { knockout: e.target.checked })} className="accent-gray-900" />
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Texte découpé (knockout)</span>
                              </label>
                              {selectedElement.knockout && (
                                <>
                                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                                    <div>
                                      <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Marge</label>
                                      <input type="number" value={selectedElement.bgPadding ?? 16} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { bgPadding: Number(e.target.value) })} className="w-full bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono outline-none" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">Rayon</label>
                                      <input type="number" value={selectedElement.bgRadius ?? 0} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { bgRadius: Number(e.target.value) })} className="w-full bg-white border border-gray-200 rounded px-1 py-0.5 text-[9px] font-mono outline-none" />
                                    </div>
                                  </div>
                                  <p className="text-[8px] text-gray-300 italic">Les lettres laissent voir le fond / les éléments derrière. La couleur de la plaque = remplissage du texte.</p>
                                </>
                              )}
                            </div>

                            {/* Ombres de texte multiples */}
                            <div className="p-2 bg-gray-50 rounded border border-gray-100 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Ombres de texte</span>
                                <button onClick={() => onUpdateElement(selectedElement.id, { textShadows: [...(selectedElement.textShadows ?? []), { x: 3, y: 3, blur: 0, color: '#000000', opacity: 1 }] })} className="text-[9px] font-bold text-blue-600 uppercase">+ Ajouter</button>
                              </div>

                              {/* Préréglages */}
                              <div className="grid grid-cols-5 gap-1">
                                {SHADOW_PRESETS.map((p) => (
                                  <button key={p.label} onClick={() => onUpdateElement(selectedElement.id, { textShadows: p.shadows.map((s) => ({ ...s })) })} className="py-1 rounded border border-gray-200 bg-white text-[8px] font-bold uppercase text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors" title={`Préréglage : ${p.label}`}>{p.label}</button>
                                ))}
                              </div>

                              {(selectedElement.textShadows ?? []).length === 0 && (
                                <p className="text-[8px] text-gray-300 italic">Aucune ombre. Choisis un préréglage ou « + Ajouter ».</p>
                              )}

                              {/* Liste des ombres (champs explicites) */}
                              {(selectedElement.textShadows ?? []).map((s, i) => (
                                <div key={i} className="p-2 bg-white rounded border border-gray-200 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <div className="relative w-5 h-5 rounded border border-gray-200 overflow-hidden bg-white shrink-0" title="Couleur de l'ombre"><input type="color" value={ensureFullHex(s.color)} onMouseDown={onBeginHistory} onChange={(e) => { const arr = [...(selectedElement.textShadows ?? [])]; arr[i] = { ...arr[i], color: e.target.value }; onUpdateElementLive(selectedElement.id, { textShadows: arr }); }} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" /></div>
                                      <span className="text-[9px] font-bold text-gray-500 uppercase">Ombre {i + 1}</span>
                                    </div>
                                    <button onClick={() => { const arr = (selectedElement.textShadows ?? []).filter((_, idx) => idx !== i); onUpdateElement(selectedElement.id, { textShadows: arr.length ? arr : undefined }); }} className="text-red-400 hover:text-red-600 shrink-0" title="Supprimer cette ombre"><Trash2 size={12} /></button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <div>
                                      <label className="text-[8px] font-bold text-gray-400 uppercase block mb-0.5">Décalage X</label>
                                      <input type="number" value={s.x} onFocus={onBeginHistory} onChange={(e) => { const arr = [...(selectedElement.textShadows ?? [])]; arr[i] = { ...arr[i], x: Number(e.target.value) }; onUpdateElementLive(selectedElement.id, { textShadows: arr }); }} className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] font-mono outline-none focus:border-blue-400" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] font-bold text-gray-400 uppercase block mb-0.5">Décalage Y</label>
                                      <input type="number" value={s.y} onFocus={onBeginHistory} onChange={(e) => { const arr = [...(selectedElement.textShadows ?? [])]; arr[i] = { ...arr[i], y: Number(e.target.value) }; onUpdateElementLive(selectedElement.id, { textShadows: arr }); }} className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] font-mono outline-none focus:border-blue-400" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] font-bold text-gray-400 uppercase block mb-0.5">Flou</label>
                                      <input type="number" min="0" value={s.blur} onFocus={onBeginHistory} onChange={(e) => { const arr = [...(selectedElement.textShadows ?? [])]; arr[i] = { ...arr[i], blur: Number(e.target.value) }; onUpdateElementLive(selectedElement.id, { textShadows: arr }); }} className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] font-mono outline-none focus:border-blue-400" />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between items-center mb-0.5"><label className="text-[8px] font-bold text-gray-400 uppercase">Opacité</label><span className="text-[8px] font-mono text-gray-400">{Math.round((s.opacity ?? 1) * 100)}%</span></div>
                                    <input type="range" min="0" max="1" step="0.01" value={s.opacity ?? 1} onMouseDown={onBeginHistory} onChange={(e) => { const arr = [...(selectedElement.textShadows ?? [])]; arr[i] = { ...arr[i], opacity: Number(e.target.value) }; onUpdateElementLive(selectedElement.id, { textShadows: arr }); }} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  <section>
                    <button onClick={() => toggleSection('effects')} className="w-full flex items-center justify-between mb-3 group">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-900">Effets</span>
                      <ChevronDown size={14} className={`text-gray-300 transition-transform ${openSections.effects ? '' : '-rotate-90'}`} />
                    </button>
                    {openSections.effects && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div>
                          <div className="flex justify-between items-center mb-2"><label className="text-[9px] font-bold text-gray-400 uppercase">Contour</label><div className="flex items-center gap-0.5"><input type="number" step="0.5" value={selectedElement.strokeWidth ?? 0} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { strokeWidth: Number(e.target.value) })} className="w-10 text-[9px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /><span className="text-[9px] font-mono text-gray-400">px</span></div></div>
                          <div className="flex gap-3 p-2 bg-gray-50 rounded border border-gray-100"><div className="relative w-7 h-7 rounded border border-gray-200 overflow-hidden shrink-0 bg-white"><input type="color" value={ensureFullHex(selectedElement.strokeColor ?? '#000000')} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { strokeColor: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" /></div><input type="range" min="0" max="20" step="0.5" value={selectedElement.strokeWidth ?? 0} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { strokeWidth: Number(e.target.value) })} className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900 self-center" /></div>
                          {(selectedElement.strokeWidth ?? 0) > 0 && (() => {
                            // Le texte ne propose pas « intérieur » (non émulable proprement sur les glyphes)
                            const opts = selectedElement.type === 'text'
                              ? (['center', 'outside'] as const)
                              : (['inside', 'center', 'outside'] as const);
                            return (
                              <div className={`grid gap-1 mt-2 p-1 bg-gray-100 rounded text-[9px] font-bold uppercase ${opts.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {opts.map((a) => (
                                  <button
                                    key={a}
                                    onClick={() => onUpdateElement(selectedElement.id, { strokeAlign: a })}
                                    className={`py-1 rounded transition-all ${(selectedElement.strokeAlign ?? 'center') === a ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                                    title={a === 'inside' ? 'Contour intérieur' : a === 'outside' ? 'Contour extérieur' : 'Contour centré'}
                                  >
                                    {a === 'inside' ? 'Intér.' : a === 'outside' ? 'Extér.' : 'Centre'}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                          <label className="flex items-center gap-1.5 cursor-pointer mt-2">
                            <input type="checkbox" checked={!!selectedElement.noFill} onChange={(e) => onUpdateElement(selectedElement.id, { noFill: e.target.checked })} className="accent-gray-900" />
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Sans remplissage (contour seul)</span>
                          </label>
                        </div>
                        <div className="p-3 bg-gray-50 rounded border border-gray-100 space-y-3">
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block">Ombre Portée</label>
                          <div className="flex gap-3"><div className="relative w-8 h-8 rounded border border-gray-200 overflow-hidden shrink-0 bg-white"><input type="color" value={ensureFullHex(selectedElement.shadowColor ?? '#000000')} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { shadowColor: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" /></div><div className="flex-1"><div className="flex justify-between items-center mb-1"><label className="text-[8px] font-bold text-gray-400 uppercase">Opacité</label><div className="flex items-center gap-0.5"><input type="number" value={Math.round((selectedElement.shadowOpacity ?? 0.5) * 100)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { shadowOpacity: Number(e.target.value) / 100 })} className="w-10 text-[8px] font-mono text-right bg-white border border-gray-200 rounded px-1 py-0.5 outline-none text-gray-700 focus:border-blue-400" /><span className="text-[8px] font-mono text-gray-400">%</span></div></div><input type="range" min="0" max="1" step="0.01" value={selectedElement.shadowOpacity ?? 0.5} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { shadowOpacity: Number(e.target.value) })} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /></div></div>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}

          <section className="pt-4 border-t border-gray-100">
            <button onClick={() => toggleSection('export')} className="w-full flex items-center justify-between mb-3 group">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2"><Download size={14} className="text-gray-400" /> Export & Actions</span>
              <ChevronDown size={14} className={`text-gray-300 transition-transform ${openSections.export ? '' : '-rotate-90'}`} />
            </button>
            {openSections.export && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="mb-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Nom du projet</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => onSetProjectName(e.target.value)}
                    placeholder="Sans titre"
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 focus:bg-white focus:border-blue-400 outline-none"
                  />
                  <p className="text-[8px] text-gray-300 mt-1 italic">Utilisé comme nom de fichier (PNG, SVG, JSON).</p>
                </div>
                <button onClick={() => onExport('svg')} className="w-full py-2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-black transition-all shadow-sm">Exporter en SVG</button>
                <div className="grid grid-cols-2 gap-2"><button onClick={() => onExport('png')} className="py-2 bg-gray-100 text-gray-700 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-gray-200 transition-all">PNG</button><button onClick={() => onExport('jpg')} className="py-2 bg-gray-100 text-gray-700 text-[10px] font-bold uppercase tracking-widest rounded hover:bg-gray-200 transition-all">JPG</button></div>

                {/* Projet (sauvegarde/chargement portable .json) */}
                <div className="pt-2 mt-1 border-t border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Projet (réutilisable)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={onExportProject} title="Télécharge le projet en .json (polices incluses)" className="flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold uppercase tracking-wider rounded hover:bg-blue-100 transition-all"><Save size={13} /> Enregistrer</button>
                    <button onClick={() => projectInputRef.current?.click()} title="Charge un projet .json" className="flex items-center justify-center gap-1.5 py-2 bg-gray-50 text-gray-600 border border-gray-200 text-[10px] font-bold uppercase tracking-wider rounded hover:bg-white transition-all"><FolderOpen size={13} /> Charger</button>
                  </div>
                </div>

                <button onClick={onClearCanvas} className="w-full mt-4 py-2 text-red-400 hover:text-red-600 text-[9px] font-bold uppercase tracking-widest transition-colors">Vider le canvas</button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
