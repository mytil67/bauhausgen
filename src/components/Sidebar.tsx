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
  MoveHorizontal,
  MoveVertical,
  RotateCcw,
  Layers,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUp,
  ArrowDown,
  Upload,
  Copy,
  Undo2,
  Redo2,
  Italic,
  CaseSensitive,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  FlipHorizontal,
  FlipVertical,
  ChevronUp,
  ChevronDown,
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
  onAddElement: (type: ElementType) => void;
  onUpdateElement: (id: string, updates: Partial<CompositionElement>) => void;
  onUpdateElementLive: (id: string, updates: Partial<CompositionElement>) => void;
  onBeginHistory: () => void;
  onRemoveElement: (id: string) => void;
  onDuplicate: () => void;
  onUpdateBackground: (color: string) => void;
  onSaveColor: (color: string) => void;
  onAddCustomFont: (name: string, data: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onFlip: (axis: 'horizontal' | 'vertical', ids: string[]) => void;
  onExport: (format: 'svg' | 'png' | 'jpg') => void;
  onClearCanvas: () => void;
  onAlign: (direction: AlignDirection, toPage: boolean) => void;
  onDistribute: (axis: DistributeAxis) => void;
  onUndo: () => void;
  onRedo: () => void;
  onApplyColor: (color: string) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onSetCanvasSize: (w: number, h: number) => void;
  onLoadTemplate: (tpl: Template) => void;
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

// Palettes Bauhaus
const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Primaire', colors: ['#e63946', '#f4a261', '#1d3557', '#1a1a1a', '#f1faee'] },
  { name: 'Weimar', colors: ['#d62828', '#fcbf49', '#003049', '#eae2b7', '#1a1a1a'] },
  { name: 'Dessau', colors: ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#ffffff'] },
  { name: 'Mono', colors: ['#1a1a1a', '#4a4a4a', '#8a8a8a', '#cfcfcf', '#ffffff'] },
];

// Formats de canvas
const CANVAS_PRESETS: { name: string; w: number; h: number }[] = [
  { name: 'Carré', w: 1080, h: 1080 },
  { name: 'Story', w: 1080, h: 1920 },
  { name: 'Post', w: 1080, h: 1350 },
  { name: 'Bannière', w: 1500, h: 500 },
  { name: 'A4 ↕', w: 1240, h: 1754 },
  { name: 'A4 ↔', w: 1754, h: 1240 },
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
  onExport,
  onClearCanvas,
  onAlign,
  onDistribute,
  onUndo,
  onRedo,
  onApplyColor,
  onGroup,
  onUngroup,
  onSetCanvasSize,
  onLoadTemplate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [alignToPage, setAlignToPage] = useState(false);

  const canAlignSelection = selectionCount >= 2;
  const effectiveToPage = canAlignSelection ? alignToPage : true;
  const canAlign = effectiveToPage ? elementCount >= 1 : canAlignSelection;
  const canDistribute = selectionCount >= 3 || (selectionCount < 3 && elementCount >= 3);

  const alignButtons = [
    { dir: 'left', Icon: AlignStartVertical, label: 'Aligner à gauche' },
    { dir: 'center', Icon: AlignCenterVertical, label: 'Centrer horizontalement' },
    { dir: 'right', Icon: AlignEndVertical, label: 'Aligner à droite' },
    { dir: 'top', Icon: AlignStartHorizontal, label: 'Aligner en haut' },
    { dir: 'middle', Icon: AlignCenterHorizontal, label: 'Centrer verticalement' },
    { dir: 'bottom', Icon: AlignEndHorizontal, label: 'Aligner en bas' },
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
    <div className="w-80 h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto p-4 gap-6 shadow-lg">
      <div className="flex items-center justify-between border-b pb-2">
        <h1 className="text-2xl font-bold tracking-tighter text-gray-900">BAUHAUS GEN</h1>
        <div className="flex gap-1">
          <button onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)" className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"><Undo2 size={16} /></button>
          <button onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Maj+Z)" className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"><Redo2 size={16} /></button>
        </div>
      </div>

      {/* Add Elements Section */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Layers size={14} /> Ajouter Éléments
        </h2>
        <button onClick={() => onAddElement('text')} className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-black transition-colors"><Type size={16} /> Ajouter un texte</button>
        <div className="grid grid-cols-4 gap-1.5">
          {SHAPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onAddElement(type)}
              title={label}
              className="aspect-square flex items-center justify-center bg-gray-50 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <ShapeIcon type={type} />
            </button>
          ))}
        </div>
      </section>

      {/* Templates */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <LayoutTemplate size={14} /> Templates
        </h2>
        <div className="grid grid-cols-1 gap-1.5">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => { if (window.confirm(`Charger « ${tpl.name} » ? La composition actuelle sera remplacée.`)) onLoadTemplate(tpl); }}
              className="text-left px-3 py-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 hover:border-blue-300 text-xs font-medium transition-colors"
            >
              {tpl.name}
            </button>
          ))}
        </div>
      </section>

      {/* Format du canvas */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Frame size={14} /> Format
        </h2>
        <div className="grid grid-cols-3 gap-1.5">
          {CANVAS_PRESETS.map((p) => {
            const active = canvasWidth === p.w && canvasHeight === p.h;
            return (
              <button
                key={p.name}
                onClick={() => onSetCanvasSize(p.w, p.h)}
                className={`py-1.5 rounded border text-[10px] font-bold uppercase transition-colors ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                title={`${p.w}×${p.h}`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Palettes Bauhaus */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Palette size={14} /> Palettes
        </h2>
        <p className="text-[10px] text-gray-400 mb-2 leading-snug">
          {selectionCount > 0 ? 'Applique la couleur à la sélection.' : 'Applique la couleur au fond.'}
        </p>
        <div className="space-y-1.5">
          {PALETTES.map((pal) => (
            <div key={pal.name} className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-gray-400 w-12 shrink-0 uppercase">{pal.name}</span>
              <div className="flex-1 grid grid-cols-5 gap-1">
                {pal.colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => onApplyColor(c)}
                    className="aspect-square rounded-sm border border-gray-200 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Alignement & distribution */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <AlignCenterVertical size={14} /> Alignement
        </h2>

        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded mb-3 text-[10px] font-bold uppercase tracking-wide">
          <button
            onClick={() => canAlignSelection && setAlignToPage(false)}
            disabled={!canAlignSelection}
            className={`py-1 rounded transition-all ${!effectiveToPage ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'} disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Aligner les éléments sélectionnés entre eux"
          >
            Sélection
          </button>
          <button
            onClick={() => setAlignToPage(true)}
            className={`py-1 rounded transition-all ${effectiveToPage ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            title="Aligner sur la page (le canvas)"
          >
            Page
          </button>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {alignButtons.map(({ dir, Icon, label }) => (
            <button
              key={dir}
              onClick={() => onAlign(dir, effectiveToPage)}
              disabled={!canAlign}
              className="aspect-square flex items-center justify-center rounded border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-gray-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:hover:text-gray-600 disabled:hover:border-gray-200"
              title={label}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1 mt-2">
          <button
            onClick={() => onDistribute('horizontal')}
            disabled={!canDistribute}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-gray-600 text-[10px] font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:hover:text-gray-600"
            title="Espacement horizontal égal"
          >
            <AlignHorizontalDistributeCenter size={14} /> Espacer H
          </button>
          <button
            onClick={() => onDistribute('vertical')}
            disabled={!canDistribute}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-gray-600 text-[10px] font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:hover:text-gray-600"
            title="Espacement vertical égal"
          >
            <AlignVerticalDistributeCenter size={14} /> Espacer V
          </button>
        </div>
      </section>

      {/* Font Upload Section */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Upload size={14} /> Mes Polices
        </h2>
        <input type="file" ref={fileInputRef} onChange={handleFontUpload} accept=".ttf,.otf,.woff,.woff2" className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded text-xs font-bold uppercase hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
        >
          <Upload size={14} /> Charger une police (OTF/TTF)
        </button>
      </section>

      {/* Global Controls */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Fond</h2>
        <div className="flex items-center gap-2 mb-2">
          <div className="relative w-8 h-8 shrink-0 overflow-hidden rounded border border-gray-300">
            <input
              type="color"
              value={ensureFullHex(backgroundColor)}
              onChange={(e) => onUpdateBackground(e.target.value)}
              className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer"
            />
          </div>
          <input
            type="text"
            value={backgroundColor}
            onChange={(e) => handleColorInput(e.target.value, onUpdateBackground)}
            placeholder="#FFFFFF"
            className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded uppercase font-mono focus:outline-none"
          />
          <button onClick={() => onSaveColor(backgroundColor)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-[10px] font-bold uppercase whitespace-nowrap">Mémoriser</button>
        </div>
        {customColors.length > 0 && (
          <div className="grid grid-cols-8 gap-1 pt-2">
            {customColors.map((c, i) => (
              <button key={`${c}-${i}`} onClick={() => onUpdateBackground(c)} className={`w-full aspect-square rounded-sm border ${backgroundColor.toLowerCase() === c.toLowerCase() ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        )}
      </section>

      {/* Selected Element Controls / Arrangement */}
      <section className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {selectionCount > 0 ? 'Agencement' : 'Aucune sélection'}
          </h2>
          <div className="flex gap-1">
            {selectionCount >= 2 && (
              <button onClick={onGroup} title="Grouper (Ctrl+G)" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded flex items-center gap-1 text-[10px] font-bold">
                <Copy size={16} /> G
              </button>
            )}
            {(selectedElement?.groupId || selectedIds.some(id => elements?.find(e => e.id === id)?.groupId)) && (
              <button onClick={onUngroup} title="Dégrouper (Ctrl+Maj+G)" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded flex items-center gap-1 text-[10px] font-bold">
                <LayoutTemplate size={16} className="opacity-50" /> U
              </button>
            )}
            {selectionCount > 0 && (
              <button onClick={onDuplicate} title="Dupliquer (Ctrl+D)" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Copy size={16} /></button>
            )}
            {selectionCount > 0 && (
              <button onClick={() => selectedIds.forEach(id => onRemoveElement(id))} title="Supprimer (Suppr)" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
            )}
          </div>
        </div>

        {selectionCount > 0 ? (
          <div className="space-y-4">
            {/* Z-Order */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-gray-50 rounded border border-gray-200">
              <button onClick={() => selectedIds.forEach(id => onBringToFront(id))} className="p-2 hover:bg-white rounded transition-all flex justify-center text-gray-700" title="Tout devant"><ArrowUp size={14} /></button>
              <button onClick={() => selectedIds.forEach(id => onBringForward(id))} className="p-2 hover:bg-white rounded transition-all flex justify-center text-gray-700" title="Avancer"><ChevronUp size={14} /></button>
              <button onClick={() => selectedIds.forEach(id => onSendBackward(id))} className="p-2 hover:bg-white rounded transition-all flex justify-center text-gray-700" title="Reculer"><ChevronDown size={14} /></button>
              <button onClick={() => selectedIds.forEach(id => onSendToBack(id))} className="p-2 hover:bg-white rounded transition-all flex justify-center text-gray-700" title="Tout derrière"><ArrowDown size={14} /></button>
            </div>

            {/* Flip controls */}
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Retourner</span>
              <div className="flex gap-2">
                <button onClick={() => onFlip('horizontal', selectedIds)} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-gray-200 text-gray-600 flex items-center gap-1 text-[10px] font-bold" title="H-Flip"><FlipHorizontal size={14} /> H</button>
                <button onClick={() => onFlip('vertical', selectedIds)} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-gray-200 text-gray-600 flex items-center gap-1 text-[10px] font-bold" title="V-Flip"><FlipVertical size={14} /> V</button>
              </div>
            </div>

            {selectedElement && selectionCount === 1 ? (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Propriétés</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-gray-400 block mb-1">X POSITION</label><input type="number" value={Math.round(selectedElement.x)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { x: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Y POSITION</label><input type="number" value={Math.round(selectedElement.y)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { y: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1 flex items-center gap-2"><RotateCcw size={10} /> ROTATION</label>
                  <input type="range" min="0" max="360" value={selectedElement.rotation} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { rotation: Number(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
                  <div className="text-[10px] text-right mt-1 font-mono">{Math.round(selectedElement.rotation)}°</div>
                </div>

                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">OPACITÉ</label><input type="range" min="0" max="1" step="0.01" value={selectedElement.opacity} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { opacity: Number(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /><div className="text-[10px] text-right mt-1 font-mono">{Math.round(selectedElement.opacity * 100)}%</div></div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-gray-400 block mb-1 flex items-center gap-2"><MoveHorizontal size={10} /> ÉCHELLE X</label><input type="number" step="0.1" value={selectedElement.scaleX} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { scaleX: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 block mb-1 flex items-center gap-2"><MoveVertical size={10} /> ÉCHELLE Y</label><input type="number" step="0.1" value={selectedElement.scaleY} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { scaleY: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">COULEUR</label>
                  <div className="flex gap-2 mb-2">
                    <div className="relative w-10 h-10 shrink-0 overflow-hidden rounded border border-gray-200 bg-white">
                      <input type="color" value={ensureFullHex(selectedElement.color)} onMouseDown={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { color: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer" />
                    </div>
                    <input type="text" value={selectedElement.color} onChange={(e) => handleColorInput(e.target.value, (color) => onUpdateElement(selectedElement.id, { color }))} placeholder="#000000" className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded uppercase font-mono" />
                    <button onClick={() => onSaveColor(selectedElement.color)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-[10px] font-bold uppercase whitespace-nowrap">Mémoriser</button>
                  </div>
                  {customColors.length > 0 && (
                    <div className="grid grid-cols-8 gap-1 mb-2">
                      {customColors.map((c, i) => (
                        <button key={`${c}-el-${i}`} onClick={() => onUpdateElement(selectedElement.id, { color: c })} className={`w-full aspect-square rounded-sm border ${selectedElement.color.toLowerCase() === c.toLowerCase() ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                </div>

                {selectedElement.type === 'text' && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div><label className="text-[10px] font-bold text-gray-400 block mb-1">TEXTE</label><textarea value={selectedElement.text} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { text: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded min-h-[60px]" /></div>
                    <select value={selectedElement.fontFamily} onChange={(e) => onUpdateElement(selectedElement.id, { fontFamily: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-medium">
                      <optgroup label="Système & Google">
                        <option value="sans-serif">Sans Serif</option>
                        <option value="'Inter', sans-serif">Inter</option>
                        <option value="'Montserrat', sans-serif">Montserrat</option>
                        <option value="'Outfit', sans-serif">Outfit</option>
                        <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
                        <option value="'Syne', sans-serif">Syne</option>
                        <option value="'Archivo Black', sans-serif">Archivo Black</option>
                        <option value="'Playfair Display', serif">Playfair Display</option>
                        <option value="'Libre Baskerville', serif">Libre Baskerville</option>
                      </optgroup>
                      {customFonts.length > 0 && (
                        <optgroup label="Mes Polices">
                          {customFonts.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="number" value={selectedElement.fontSize} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { fontSize: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" title="Taille" />
                      <select value={selectedElement.fontWeight} onChange={(e) => onUpdateElement(selectedElement.id, { fontWeight: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded">
                        <option value="normal">Normal</option><option value="bold">Gras</option><option value="100">Thin</option><option value="300">Light</option><option value="500">Medium</option><option value="700">Bold</option><option value="900">Black</option>
                      </select>
                    </div>

                    {/* Alignement et Style de texte */}
                    <div className="flex gap-1 p-1 bg-gray-50 rounded border border-gray-200">
                      <button
                        onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'start' })}
                        className={`flex-1 flex justify-center p-1.5 rounded ${selectedElement.textAlign === 'start' ? 'bg-white shadow-sm' : 'hover:bg-gray-100 opacity-60'}`}
                        title="Gauche"
                      ><AlignLeft size={14} /></button>
                      <button
                        onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'middle' })}
                        className={`flex-1 flex justify-center p-1.5 rounded ${(!selectedElement.textAlign || selectedElement.textAlign === 'middle') ? 'bg-white shadow-sm' : 'hover:bg-gray-100 opacity-60'}`}
                        title="Centre"
                      ><AlignCenter size={14} /></button>
                      <button
                        onClick={() => onUpdateElement(selectedElement.id, { textAlign: 'end' })}
                        className={`flex-1 flex justify-center p-1.5 rounded ${selectedElement.textAlign === 'end' ? 'bg-white shadow-sm' : 'hover:bg-gray-100 opacity-60'}`}
                        title="Droite"
                      ><AlignRight size={14} /></button>
                      <div className="w-px h-4 bg-gray-200 self-center mx-1" />
                      <button
                        onClick={() => onUpdateElement(selectedElement.id, { italic: !selectedElement.italic })}
                        className={`flex-1 flex justify-center p-1.5 rounded ${selectedElement.italic ? 'bg-white shadow-sm text-blue-600' : 'hover:bg-gray-100 opacity-60'}`}
                        title="Italique"
                      ><Italic size={14} /></button>
                      <button
                        onClick={() => onUpdateElement(selectedElement.id, { textTransform: selectedElement.textTransform === 'uppercase' ? 'none' : 'uppercase' })}
                        className={`flex-1 flex justify-center p-1.5 rounded ${selectedElement.textTransform === 'uppercase' ? 'bg-white shadow-sm text-blue-600' : 'hover:bg-gray-100 opacity-60'}`}
                        title="Majuscules"
                      ><CaseSensitive size={14} /></button>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[10px] font-bold text-gray-400 block uppercase">Interlettrage</label>
                        <span className="text-[10px] font-mono text-gray-400">{selectedElement.letterSpacing ?? 0}px</span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="50"
                        step="0.5"
                        value={selectedElement.letterSpacing ?? 0}
                        onMouseDown={onBeginHistory}
                        onChange={(e) => onUpdateElementLive(selectedElement.id, { letterSpacing: Number(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[10px] font-bold text-gray-400 block uppercase">Interligne</label>
                        <span className="text-[10px] font-mono text-gray-400">{selectedElement.lineHeight ?? 1.2}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={selectedElement.lineHeight ?? 1.2}
                        onMouseDown={onBeginHistory}
                        onChange={(e) => onUpdateElementLive(selectedElement.id, { lineHeight: Number(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                      />
                    </div>
                  </div>
                )}

                {selectedElement.type !== 'text' && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div><label className="text-[10px] font-bold text-gray-400 block mb-1">LARGEUR</label><input type="number" value={Math.round(selectedElement.width)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { width: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 block mb-1">HAUTEUR</label><input type="number" value={Math.round(selectedElement.height)} onFocus={onBeginHistory} onChange={(e) => onUpdateElementLive(selectedElement.id, { height: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-lg">
            <p className="text-gray-300 text-xs text-center px-4 italic">Sélectionnez un ou plusieurs éléments sur le canvas pour les agencer.</p>
          </div>
        )}
      </section>

      <section className="pt-4 border-t border-gray-200">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2"><Download size={14} /> Exporter</h2>
        <div className="flex flex-col gap-2">
          <button onClick={() => onExport('svg')} className="w-full bg-gray-900 text-white text-xs font-bold py-2 rounded hover:bg-black uppercase tracking-widest transition-colors">SVG</button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onExport('png')} className="w-full bg-gray-100 text-gray-900 text-xs font-bold py-2 rounded hover:bg-gray-200 uppercase tracking-widest transition-colors">PNG</button>
            <button onClick={() => onExport('jpg')} className="w-full bg-gray-100 text-gray-900 text-xs font-bold py-2 rounded hover:bg-gray-200 uppercase tracking-widest transition-colors">JPG</button>
          </div>
        </div>
        <button onClick={onClearCanvas} className="w-full mt-4 py-2 text-red-500 text-[10px] font-bold uppercase hover:bg-red-50 rounded transition-colors">Vider le canvas</button>
      </section>
    </div>
  );
};
