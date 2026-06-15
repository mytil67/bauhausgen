import React, { useRef } from 'react';
import type { CompositionElement, ElementType } from '../types';
import { 
  Square, 
  Circle, 
  Triangle, 
  Type, 
  Trash2, 
  Download, 
  MoveHorizontal, 
  MoveVertical, 
  RotateCcw,
  Layers,
  AlignCenter,
  AlignJustify,
  ArrowUp,
  ArrowDown,
  Upload
} from 'lucide-react';

interface SidebarProps {
  selectedElement: CompositionElement | null;
  backgroundColor: string;
  customColors: string[];
  customFonts: string[];
  canvasWidth: number;
  canvasHeight: number;
  onAddElement: (type: ElementType) => void;
  onUpdateElement: (id: string, updates: Partial<CompositionElement>) => void;
  onRemoveElement: (id: string) => void;
  onUpdateBackground: (color: string) => void;
  onSaveColor: (color: string) => void;
  onAddCustomFont: (fontName: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onExport: (format: 'svg' | 'png' | 'jpg') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedElement,
  backgroundColor,
  customColors,
  customFonts,
  canvasWidth,
  canvasHeight,
  onAddElement,
  onUpdateElement,
  onRemoveElement,
  onUpdateBackground,
  onSaveColor,
  onAddCustomFont,
  onBringToFront,
  onSendToBack,
  onExport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const fontFace = new FontFace(fontName, arrayBuffer);
      
      try {
        await fontFace.load();
        document.fonts.add(fontFace);
        onAddCustomFont(fontName);
        if (selectedElement?.type === 'text') {
          onUpdateElement(selectedElement.id, { fontFamily: fontName });
        }
      } catch (err) {
        console.error('Erreur chargement police:', err);
        alert('Impossible de charger cette police.');
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="w-80 h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto p-4 gap-6 shadow-lg">
      <h1 className="text-2xl font-bold tracking-tighter text-gray-900 border-b pb-2">BAUHAUS GEN</h1>
      
      {/* Add Elements Section */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Layers size={14} /> Ajouter Éléments
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onAddElement('text')} className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-sm transition-colors"><Type size={16} /> Texte</button>
          <button onClick={() => onAddElement('rect')} className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-sm transition-colors"><Square size={16} /> Rect</button>
          <button onClick={() => onAddElement('circle')} className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-sm transition-colors"><Circle size={16} /> Cercle</button>
          <button onClick={() => onAddElement('triangle')} className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 text-sm transition-colors"><Triangle size={16} /> Triangle</button>
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
          <input type="color" value={backgroundColor} onChange={(e) => onUpdateBackground(e.target.value)} className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0" />
          <input type="text" value={backgroundColor} onChange={(e) => { const val = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) onUpdateBackground(val); }} placeholder="#FFFFFF" className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded uppercase font-mono focus:outline-none" />
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

      {/* Selected Element Controls */}
      <section className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{selectedElement ? `Propriétés : ${selectedElement.type}` : 'Aucune sélection'}</h2>
          {selectedElement && <button onClick={() => onRemoveElement(selectedElement.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>}
        </div>

        {selectedElement ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-1 p-1 bg-gray-50 rounded border border-gray-200">
              <button onClick={() => onUpdateElement(selectedElement.id, { x: canvasWidth / 2 })} className="p-2 hover:bg-white rounded transition-all flex justify-center" title="Centrer H"><AlignCenter size={14} /></button>
              <button onClick={() => onUpdateElement(selectedElement.id, { y: canvasHeight / 2 })} className="p-2 hover:bg-white rounded transition-all flex justify-center" title="Centrer V"><AlignJustify size={14} className="rotate-90" /></button>
              <button onClick={() => onBringToFront(selectedElement.id)} className="p-2 hover:bg-white rounded transition-all flex justify-center" title="Premier plan"><ArrowUp size={14} /></button>
              <button onClick={() => onSendToBack(selectedElement.id)} className="p-2 hover:bg-white rounded transition-all flex justify-center" title="Arrière-plan"><ArrowDown size={14} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-bold text-gray-400 block mb-1">X POSITION</label><input type="number" value={selectedElement.x} onChange={(e) => onUpdateElement(selectedElement.id, { x: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Y POSITION</label><input type="number" value={selectedElement.y} onChange={(e) => onUpdateElement(selectedElement.id, { y: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
            </div>

            <div><label className="text-[10px] font-bold text-gray-400 block mb-1 flex items-center gap-2"><RotateCcw size={10} /> ROTATION</label><input type="range" min="0" max="360" value={selectedElement.rotation} onChange={(e) => onUpdateElement(selectedElement.id, { rotation: Number(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /><div className="text-[10px] text-right mt-1 font-mono">{selectedElement.rotation}°</div></div>

            <div><label className="text-[10px] font-bold text-gray-400 block mb-1">OPACITÉ</label><input type="range" min="0" max="1" step="0.01" value={selectedElement.opacity} onChange={(e) => onUpdateElement(selectedElement.id, { opacity: Number(e.target.value) })} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" /><div className="text-[10px] text-right mt-1 font-mono">{Math.round(selectedElement.opacity * 100)}%</div></div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-bold text-gray-400 block mb-1 flex items-center gap-2"><MoveHorizontal size={10} /> LARGEUR</label><input type="number" step="0.1" value={selectedElement.scaleX} onChange={(e) => onUpdateElement(selectedElement.id, { scaleX: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 block mb-1 flex items-center gap-2"><MoveVertical size={10} /> HAUTEUR</label><input type="number" step="0.1" value={selectedElement.scaleY} onChange={(e) => onUpdateElement(selectedElement.id, { scaleY: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">COULEUR</label>
              <div className="flex gap-2 mb-2">
                <input type="color" value={selectedElement.color} onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })} className="w-10 h-10 rounded border border-gray-200 p-0.5 cursor-pointer bg-white" />
                <input type="text" value={selectedElement.color} onChange={(e) => { const val = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) onUpdateElement(selectedElement.id, { color: val }); }} placeholder="#000000" className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded uppercase font-mono" />
                <button onClick={() => onSaveColor(selectedElement.color)} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-[10px] font-bold uppercase whitespace-nowrap">Mémoriser</button>
              </div>
              {customColors.length > 0 && (
                <div className="grid grid-cols-8 gap-1 mb-2">
                  {customColors.map((c, i) => (
                    <button key={`${c}-el-${i}`} onClick={() => onUpdateElement(selectedElement.id, { color: c })} className={`w-full aspect-square rounded-sm border ${selectedElement.color.toLowerCase() === c.toLowerCase() ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-8 gap-1 border-t border-gray-100 pt-2">
                {['#000000', '#ffffff', '#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#f4a261'].map(c => (
                  <button key={c} onClick={() => onUpdateElement(selectedElement.id, { color: c })} className={`w-full aspect-square rounded-sm border ${selectedElement.color.toLowerCase() === c.toLowerCase() ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            {selectedElement.type === 'text' && (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">CONTENU DU TEXTE</label><textarea value={selectedElement.text} onChange={(e) => onUpdateElement(selectedElement.id, { text: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded min-h-[60px]" /></div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">POLICE DE CARACTÈRE</label>
                  <select value={selectedElement.fontFamily} onChange={(e) => onUpdateElement(selectedElement.id, { fontFamily: e.target.value })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-medium">
                    <optgroup label="Système & Google">
                      <option value="sans-serif">Sans Serif</option>
                      <option value="'Montserrat', sans-serif">Montserrat</option>
                      <option value="'Outfit', sans-serif">Outfit</option>
                      <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
                      <option value="'Syne', sans-serif">Syne</option>
                    </optgroup>
                    {customFonts.length > 0 && (
                      <optgroup label="Mes Polices">
                        {customFonts.map(f => <option key={f} value={f}>{f}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">TAILLE DE POLICE</label><input type="number" value={selectedElement.fontSize} onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
              </div>
            )}

            {selectedElement.type !== 'text' && (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-gray-400 block mb-1">WIDTH (PX)</label><input type="number" value={selectedElement.width} onChange={(e) => onUpdateElement(selectedElement.id, { width: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 block mb-1">HEIGHT (PX)</label><input type="number" value={selectedElement.height} onChange={(e) => onUpdateElement(selectedElement.id, { height: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" /></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-lg">
            <p className="text-gray-300 text-xs text-center px-4 italic">Sélectionnez un élément sur le canvas.</p>
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
      </section>
    </div>
  );
};
