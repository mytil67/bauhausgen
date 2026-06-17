import React, { useRef, useState } from 'react';
import type { CompositionElement, ElementType, ShapeType, AlignDirection } from '../types';
import {
  Type, Image as ImageIcon, Copy, Trash2,
  Palette, CaseUpper, Ruler, Layers as LayersIcon, Sparkles, Move, PenTool, Grid3x3,
  ChevronUp, ChevronDown, ArrowUp, ArrowDown, FlipHorizontal, FlipVertical,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Plus, MoreHorizontal, Droplet,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Undo2, Redo2, Download,
  Underline, Strikethrough,
} from 'lucide-react';

// Constantes locales (compactes pour le mobile)
const PALETTES: string[][] = [
  ['#e63946', '#f4a261', '#1d3557', '#1a1a1a', '#f1faee'],
  ['#d62828', '#fcbf49', '#003049', '#2a9d8f', '#ffffff'],
  ['#e76f51', '#e9c46a', '#264653', '#8a8a8a', '#000000'],
];
const FONTS = [
  "'Inter', sans-serif", "'Montserrat', sans-serif", "'Outfit', sans-serif", "'Space Grotesk', sans-serif",
  "'Syne', sans-serif", "'Archivo Black', sans-serif", "'Playfair Display', serif", "'Oswald', sans-serif",
  "'Bebas Neue', sans-serif", "'Anton', sans-serif", "'Righteous', display", "'Poppins', sans-serif",
];
const PATTERNS: { type: 'none' | 'stripes' | 'dots' | 'grid' | 'checker'; label: string }[] = [
  { type: 'none', label: 'Aucun' }, { type: 'stripes', label: 'Rayures' },
  { type: 'dots', label: 'Points' }, { type: 'grid', label: 'Grille' }, { type: 'checker', label: 'Damier' },
];
const ADD_SHAPES: ShapeType[] = ['rect', 'circle', 'triangle', 'semicircle', 'quarter', 'ring', 'line', 'hexagon', 'diamond', 'star', 'cross', 'arrow'];

const ensureHex = (c: string) => (/^#[0-9A-Fa-f]{6}$/.test(c) ? c : /^#[0-9A-Fa-f]{3}$/.test(c) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : '#000000');

interface MobileToolbarProps {
  selectedElement: CompositionElement | null;
  selectedIds: string[];
  customColors: string[];
  customFonts: { name: string; data: string }[];
  canUndo: boolean;
  canRedo: boolean;
  onUpdateElement: (id: string, u: Partial<CompositionElement>) => void;
  onUpdateElementLive: (id: string, u: Partial<CompositionElement>) => void;
  onBeginHistory: () => void;
  onApplyColor: (color: string) => void;
  onSaveColor: (color: string) => void;
  onAddElement: (type: ElementType) => void;
  onImportImage: (file: File) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onFlip: (axis: 'horizontal' | 'vertical', ids: string[]) => void;
  onAlign: (dir: AlignDirection, toPage: boolean) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onOpenLayers: () => void;
  onOpenFull: () => void;
}

type Cat = { id: string; label: string; icon: React.ReactNode };

export const MobileToolbar: React.FC<MobileToolbarProps> = (p) => {
  const { selectedElement: el } = p;
  const [panel, setPanel] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const isText = el?.type === 'text';
  const isImage = el?.type === 'image';

  const toggle = (id: string) => setPanel((cur) => (cur === id ? null : id));

  // Catégories contextuelles
  let cats: Cat[];
  if (!el) {
    cats = [
      { id: 'add', label: 'Ajouter', icon: <Plus size={20} /> },
      { id: 'bg', label: 'Fond', icon: <Palette size={20} /> },
    ];
  } else if (isText) {
    cats = [
      { id: 'color', label: 'Couleur', icon: <Palette size={20} /> },
      { id: 'font', label: 'Police', icon: <Type size={20} /> },
      { id: 'size', label: 'Taille', icon: <Ruler size={20} /> },
      { id: 'text', label: 'Texte', icon: <CaseUpper size={20} /> },
      { id: 'stroke', label: 'Contour', icon: <PenTool size={20} /> },
      { id: 'fx', label: 'Effets', icon: <Sparkles size={20} /> },
      { id: 'pos', label: 'Position', icon: <Move size={20} /> },
    ];
  } else if (isImage) {
    cats = [
      { id: 'opacity', label: 'Opacité', icon: <Droplet size={20} /> },
      { id: 'fx', label: 'Effets', icon: <Sparkles size={20} /> },
      { id: 'pos', label: 'Position', icon: <Move size={20} /> },
    ];
  } else {
    cats = [
      { id: 'color', label: 'Couleur', icon: <Palette size={20} /> },
      { id: 'stroke', label: 'Contour', icon: <PenTool size={20} /> },
      { id: 'pattern', label: 'Motif', icon: <Grid3x3 size={20} /> },
      { id: 'fx', label: 'Effets', icon: <Sparkles size={20} /> },
      { id: 'pos', label: 'Position', icon: <Move size={20} /> },
    ];
  }

  const upd = (u: Partial<CompositionElement>) => el && p.onUpdateElement(el.id, u);
  const updLive = (u: Partial<CompositionElement>) => el && p.onUpdateElementLive(el.id, u);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onImportImage(f); e.target.value = ''; if (panel === 'add') setPanel(null); }} />

      {/* ── PANNEAU FOCALISÉ ── */}
      {panel && (
        <div className="bg-white border-t border-gray-100 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] max-h-[44vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 duration-150">
          <div className="px-4 py-3">
            {panel === 'add' && (
              <Section title="Ajouter un élément">
                <div className="grid grid-cols-5 gap-2">
                  <AddBtn icon={<Type size={20} />} label="Texte" onClick={() => { p.onAddElement('text'); setPanel(null); }} />
                  {ADD_SHAPES.map((s) => <AddBtn key={s} icon={<ShapeMini type={s} />} label="" onClick={() => { p.onAddElement(s); setPanel(null); }} />)}
                  <AddBtn icon={<ImageIcon size={20} />} label="Image" onClick={() => imgRef.current?.click()} />
                </div>
              </Section>
            )}

            {panel === 'bg' && (
              <Section title="Couleur de fond">
                <Swatches colors={[...PALETTES.flat(), ...p.customColors]} onPick={(c) => p.onApplyColor(c)} />
                <button onClick={p.onOpenFull} className="mt-3 w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold active:bg-gray-200">Dégradé, formats, modèles…</button>
              </Section>
            )}

            {el && panel === 'color' && (
              <Section title="Couleur">
                <Swatches colors={[...PALETTES.flat(), ...p.customColors]} current={el.color} onPick={(c) => upd({ color: c })} />
                <div className="mt-3 flex items-center gap-2">
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                    <input type="color" value={ensureHex(el.color)} onChange={(e) => updLive({ color: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" />
                  </div>
                  <input value={el.color} onChange={(e) => { let v = e.target.value.trim(); if (v && !v.startsWith('#')) v = '#' + v; if (v === '' || /^#[0-9A-Fa-f]{0,6}$/.test(v)) updLive({ color: v }); }} placeholder="#000000" className="flex-1 px-3 py-2.5 text-base font-mono uppercase border border-gray-200 rounded-xl bg-gray-50" />
                  <button onClick={() => p.onSaveColor(el.color)} className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold active:bg-gray-200 shrink-0">Mém.</button>
                </div>

                {/* Dégradé */}
                <div className="mt-4">
                  {!el.gradient ? (
                    <button onClick={() => upd({ gradient: { type: 'linear', rotation: 0, colors: [{ offset: 0, color: el.color, opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 1 }] } })} className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-bold active:border-blue-300 active:text-blue-500">+ Dégradé</button>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                          <Seg active={el.gradient.type === 'linear'} onClick={() => upd({ gradient: { ...el.gradient!, type: 'linear' } })}><span className="text-xs font-bold px-2">Linéaire</span></Seg>
                          <Seg active={el.gradient.type === 'radial'} onClick={() => upd({ gradient: { ...el.gradient!, type: 'radial' } })}><span className="text-xs font-bold px-2">Radial</span></Seg>
                        </div>
                        <button onClick={() => upd({ gradient: undefined })} className="text-xs text-red-500 font-bold uppercase px-2">Retirer</button>
                      </div>
                      <div className="flex items-center gap-2">
                        {el.gradient.colors.map((c, i) => (
                          <div key={i} className="relative w-10 h-10 rounded-xl overflow-hidden border border-gray-200">
                            <input type="color" value={ensureHex(c.color)} onChange={(e) => { const nc = [...el.gradient!.colors]; nc[i] = { ...nc[i], color: e.target.value }; updLive({ gradient: { ...el.gradient!, colors: nc } }); }} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" />
                          </div>
                        ))}
                        <button onClick={() => upd({ gradient: { ...el.gradient!, colors: [...el.gradient!.colors, { offset: 1, color: '#000000', opacity: 1 }] } })} className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-400 text-xl active:bg-gray-100">+</button>
                      </div>
                      {el.gradient.type === 'linear' && (
                        <Slider label="Angle" min={0} max={360} step={1} value={el.gradient.rotation} onBegin={p.onBeginHistory} onChange={(v) => updLive({ gradient: { ...el.gradient!, rotation: v } })} />
                      )}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {isText && el.type === 'text' && panel === 'font' && (
              <Section title="Police">
                {/* Graisse + style */}
                <div className="flex gap-1.5 mb-2">
                  {([['Light', '300'], ['Normal', 'normal'], ['Gras', 'bold'], ['Black', '900']] as const).map(([lbl, v]) => (
                    <Seg key={v} active={el.fontWeight === v} onClick={() => upd({ fontWeight: v })}><span className="text-[11px] font-bold">{lbl}</span></Seg>
                  ))}
                </div>
                <div className="flex gap-1.5 mb-3">
                  <Seg active={!!el.italic} onClick={() => upd({ italic: !el.italic })}><Italic size={18} /></Seg>
                  <Seg active={el.fontVariant === 'small-caps'} onClick={() => upd({ fontVariant: el.fontVariant === 'small-caps' ? 'normal' : 'small-caps' })}><span className="text-xs font-bold">Pᴇᴛɪᴛᴇs ᴄᴀᴘs</span></Seg>
                </div>
                <div className="mb-3"><Slider label="Étirement (largeur)" min={50} max={200} step={1} value={el.fontWidth ?? 100} onBegin={p.onBeginHistory} onChange={(v) => updLive({ fontWidth: v })} /></div>
                {/* Liste des polices */}
                <div className="space-y-1.5">
                  {[...FONTS.map((f) => ({ v: f, n: f.split(',')[0].replace(/['"]/g, '') })), ...p.customFonts.map((f) => ({ v: f.name, n: f.name }))].map((f) => (
                    <button key={f.v} onClick={() => upd({ fontFamily: f.v })} style={{ fontFamily: f.v }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-lg active:bg-blue-50 ${el.fontFamily === f.v ? 'bg-blue-50 text-blue-600 font-bold' : 'bg-gray-50'}`}>{f.n}</button>
                  ))}
                </div>
              </Section>
            )}

            {isText && panel === 'size' && el.type === 'text' && (
              <Section title="Taille">
                <div className="flex items-center gap-3">
                  <StepBtn label="−" onClick={() => updLive({ fontSize: Math.max(4, el.fontSize - 2) })} />
                  <span className="flex-1 text-center text-2xl font-bold font-mono">{Math.round(el.fontSize)}</span>
                  <StepBtn label="+" onClick={() => updLive({ fontSize: el.fontSize + 2 })} />
                </div>
                <input type="range" min="8" max="400" value={el.fontSize} onMouseDown={p.onBeginHistory} onTouchStart={p.onBeginHistory} onChange={(e) => updLive({ fontSize: Number(e.target.value) })} className="w-full mt-4 h-2 bg-gray-200 rounded-lg appearance-none accent-blue-500" />
                <div className="mt-4"><Slider label="Interligne" min={0.5} max={3} step={0.1} value={el.lineHeight ?? 1.2} onBegin={p.onBeginHistory} onChange={(v) => updLive({ lineHeight: v })} /></div>
              </Section>
            )}

            {isText && panel === 'text' && el.type === 'text' && (
              <Section title="Texte">
                <textarea value={el.text} onFocus={p.onBeginHistory} onChange={(e) => updLive({ text: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-base min-h-[56px] mb-3" />
                <div className="flex gap-1.5 mb-3">
                  <Seg active={el.textAlign === 'start'} onClick={() => upd({ textAlign: 'start' })}><AlignLeft size={18} /></Seg>
                  <Seg active={!el.textAlign || el.textAlign === 'middle'} onClick={() => upd({ textAlign: 'middle' })}><AlignCenter size={18} /></Seg>
                  <Seg active={el.textAlign === 'end'} onClick={() => upd({ textAlign: 'end' })}><AlignRight size={18} /></Seg>
                  <div className="w-px bg-gray-200 mx-0.5" />
                  <Seg active={el.fontWeight === 'bold' || el.fontWeight === '700' || el.fontWeight === '900'} onClick={() => upd({ fontWeight: (el.fontWeight === 'bold' || el.fontWeight === '700' || el.fontWeight === '900') ? 'normal' : 'bold' })}><Bold size={18} /></Seg>
                  <Seg active={!!el.italic} onClick={() => upd({ italic: !el.italic })}><Italic size={18} /></Seg>
                  <Seg active={el.textTransform === 'uppercase'} onClick={() => upd({ textTransform: el.textTransform === 'uppercase' ? 'none' : 'uppercase' })}><span className="text-xs font-bold">AA</span></Seg>
                </div>
                <div className="space-y-3">
                  <Slider label="Interlettrage" min={-10} max={50} step={0.5} value={el.letterSpacing ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ letterSpacing: v })} />
                  <Slider label="Espacement des mots" min={-10} max={50} step={0.5} value={el.wordSpacing ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ wordSpacing: v })} />
                  <Slider label="Interligne" min={0.5} max={3} step={0.1} value={el.lineHeight ?? 1.2} onBegin={p.onBeginHistory} onChange={(v) => updLive({ lineHeight: v })} />
                </div>
                {/* Décoration & sens */}
                <div className="flex gap-1.5 mt-3">
                  <Seg active={el.textDecoration === 'underline'} onClick={() => upd({ textDecoration: el.textDecoration === 'underline' ? 'none' : 'underline' })}><Underline size={18} /></Seg>
                  <Seg active={el.textDecoration === 'line-through'} onClick={() => upd({ textDecoration: el.textDecoration === 'line-through' ? 'none' : 'line-through' })}><Strikethrough size={18} /></Seg>
                  <Seg active={el.textDecoration === 'overline'} onClick={() => upd({ textDecoration: el.textDecoration === 'overline' ? 'none' : 'overline' })}><span className="text-sm font-bold" style={{ textDecoration: 'overline' }}>O</span></Seg>
                  <Seg active={el.writingMode === 'vertical'} onClick={() => upd({ writingMode: el.writingMode === 'vertical' ? 'horizontal' : 'vertical' })}><span className="text-sm font-bold" style={{ writingMode: 'vertical-rl' as React.CSSProperties['writingMode'] }}>A</span></Seg>
                </div>
                {/* Courbure */}
                <div className="mt-3"><Slider label="Courbure" min={-100} max={100} step={1} value={el.curve ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ curve: v })} /></div>
                {Math.abs(el.curve ?? 0) > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    <Seg active={(el.curveType ?? 'arc') === 'arc'} onClick={() => upd({ curveType: 'arc' })}><span className="text-[11px] font-bold">Arc</span></Seg>
                    <Seg active={el.curveType === 'circle'} onClick={() => upd({ curveType: 'circle' })}><span className="text-[11px] font-bold">Cercle 360°</span></Seg>
                    <Seg active={!!el.curveInvert} onClick={() => upd({ curveInvert: !el.curveInvert })}><span className="text-[11px] font-bold">Inverser</span></Seg>
                  </div>
                )}
              </Section>
            )}

            {el && panel === 'stroke' && (
              <Section title="Contour">
                <Slider label="Épaisseur" min={0} max={20} step={0.5} value={el.strokeWidth ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ strokeWidth: v })} />
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 uppercase w-14">Couleur</span>
                  <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-gray-200">
                    <input type="color" value={ensureHex(el.strokeColor ?? '#000000')} onChange={(e) => updLive({ strokeColor: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" />
                  </div>
                </div>
                {!isText && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {(['inside', 'center', 'outside'] as const).map((a) => (
                      <Seg key={a} active={(el.strokeAlign ?? 'center') === a} onClick={() => upd({ strokeAlign: a })}>
                        <span className="text-xs font-bold">{a === 'inside' ? 'Intér.' : a === 'outside' ? 'Extér.' : 'Centre'}</span>
                      </Seg>
                    ))}
                  </div>
                )}
                {!isText && (
                  <label className="mt-3 flex items-center gap-2 text-sm font-bold text-gray-600">
                    <input type="checkbox" checked={!!el.noFill} onChange={(e) => upd({ noFill: e.target.checked })} className="w-5 h-5 accent-blue-500" /> Sans remplissage
                  </label>
                )}
              </Section>
            )}

            {!isText && !isImage && panel === 'pattern' && el && (
              <Section title="Motif">
                <div className="grid grid-cols-5 gap-1.5">
                  {PATTERNS.map((pt) => (
                    <Seg key={pt.type} active={(el.pattern?.type ?? 'none') === pt.type}
                      onClick={() => pt.type === 'none' ? upd({ pattern: undefined }) : upd({ pattern: { type: pt.type, color: el.pattern?.color ?? '#1a1a1a', background: el.pattern?.background ?? el.color, scale: el.pattern?.scale ?? 1, angle: el.pattern?.angle ?? 0 } })}>
                      <span className="text-[10px] font-bold">{pt.label}</span>
                    </Seg>
                  ))}
                </div>
                {el.pattern && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase w-14">Motif</span>
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-gray-200"><input type="color" value={ensureHex(el.pattern.color)} onChange={(e) => updLive({ pattern: { ...el.pattern!, color: e.target.value } })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" /></div>
                      <span className="text-xs font-bold text-gray-400 uppercase w-10">Fond</span>
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-gray-200"><input type="color" value={ensureHex(el.pattern.background === 'transparent' ? '#ffffff' : el.pattern.background)} onChange={(e) => updLive({ pattern: { ...el.pattern!, background: e.target.value } })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" /></div>
                    </div>
                    <Slider label="Échelle" min={0.25} max={3} step={0.05} value={el.pattern.scale} onBegin={p.onBeginHistory} onChange={(v) => updLive({ pattern: { ...el.pattern!, scale: v } })} />
                    <Slider label="Angle" min={0} max={360} step={1} value={el.pattern.angle} onBegin={p.onBeginHistory} onChange={(v) => updLive({ pattern: { ...el.pattern!, angle: v } })} />
                  </div>
                )}
              </Section>
            )}

            {el && panel === 'opacity' && (
              <Section title="Opacité">
                <Slider label="Opacité" min={0} max={1} step={0.01} value={el.opacity} onBegin={p.onBeginHistory} onChange={(v) => updLive({ opacity: v })} pct />
              </Section>
            )}

            {el && panel === 'fx' && (
              <Section title="Effets">
                <Slider label="Opacité" min={0} max={1} step={0.01} value={el.opacity} onBegin={p.onBeginHistory} onChange={(v) => updLive({ opacity: v })} pct />
                <div className="mt-3">
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Mode de fusion</div>
                  <select value={el.blendMode ?? 'normal'} onChange={(e) => upd({ blendMode: e.target.value as CompositionElement['blendMode'] })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    <option value="normal">Normal</option><option value="multiply">Produit</option><option value="screen">Superposition</option><option value="overlay">Incrustation</option><option value="darken">Obscurcir</option><option value="lighten">Éclaircir</option><option value="difference">Différence</option><option value="exclusion">Exclusion</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Slider label="Inclinaison X" min={-45} max={45} step={1} value={el.skewX ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ skewX: v })} />
                  <Slider label="Inclinaison Y" min={-45} max={45} step={1} value={el.skewY ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ skewY: v })} />
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600">Ombre portée</span>
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-gray-200"><input type="color" value={ensureHex(el.shadowColor ?? '#000000')} onChange={(e) => updLive({ shadowColor: e.target.value })} className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" /></div>
                  </div>
                  <Slider label="Flou" min={0} max={50} step={1} value={el.shadowBlur ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ shadowBlur: v })} />
                  <Slider label="Opacité ombre" min={0} max={1} step={0.01} value={el.shadowOpacity ?? 0.5} onBegin={p.onBeginHistory} onChange={(v) => updLive({ shadowOpacity: v })} pct />
                  <div className="grid grid-cols-2 gap-2">
                    <Slider label="Décalage X" min={-40} max={40} step={1} value={el.shadowOffsetX ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ shadowOffsetX: v })} />
                    <Slider label="Décalage Y" min={-40} max={40} step={1} value={el.shadowOffsetY ?? 0} onBegin={p.onBeginHistory} onChange={(v) => updLive({ shadowOffsetY: v })} />
                  </div>
                </div>
                <button onClick={p.onOpenFull} className="mt-3 w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold active:bg-gray-200">Plus d'effets (dégradé, knockout…)</button>
              </Section>
            )}

            {el && panel === 'pos' && (
              <Section title="Position">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-xl px-3 py-2"><label className="text-[9px] font-bold text-gray-400 uppercase block">X</label><input type="number" value={Math.round(el.x)} onFocus={p.onBeginHistory} onChange={(e) => updLive({ x: Number(e.target.value) })} className="w-full bg-transparent text-base font-mono outline-none" /></div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2"><label className="text-[9px] font-bold text-gray-400 uppercase block">Y</label><input type="number" value={Math.round(el.y)} onFocus={p.onBeginHistory} onChange={(e) => updLive({ y: Number(e.target.value) })} className="w-full bg-transparent text-base font-mono outline-none" /></div>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  <Seg onClick={p.onBringToFront}><ArrowUp size={18} /></Seg>
                  <Seg onClick={p.onBringForward}><ChevronUp size={18} /></Seg>
                  <Seg onClick={p.onSendBackward}><ChevronDown size={18} /></Seg>
                  <Seg onClick={p.onSendToBack}><ArrowDown size={18} /></Seg>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button onClick={() => p.onFlip('horizontal', p.selectedIds)} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 text-gray-600 text-sm font-bold active:bg-gray-100"><FlipHorizontal size={16} /> Miroir H</button>
                  <button onClick={() => p.onFlip('vertical', p.selectedIds)} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 text-gray-600 text-sm font-bold active:bg-gray-100"><FlipVertical size={16} /> Miroir V</button>
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase mb-1.5">Aligner sur la page</div>
                <div className="grid grid-cols-6 gap-1.5 mb-3">
                  <Seg onClick={() => p.onAlign('left', true)}><AlignStartVertical size={16} /></Seg>
                  <Seg onClick={() => p.onAlign('center', true)}><AlignCenterVertical size={16} /></Seg>
                  <Seg onClick={() => p.onAlign('right', true)}><AlignEndVertical size={16} /></Seg>
                  <Seg onClick={() => p.onAlign('top', true)}><AlignStartHorizontal size={16} /></Seg>
                  <Seg onClick={() => p.onAlign('middle', true)}><AlignCenterHorizontal size={16} /></Seg>
                  <Seg onClick={() => p.onAlign('bottom', true)}><AlignEndHorizontal size={16} /></Seg>
                </div>
                <Slider label="Rotation" min={0} max={360} step={1} value={el.rotation} onBegin={p.onBeginHistory} onChange={(v) => updLive({ rotation: v })} />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Slider label="Échelle X" min={0.1} max={4} step={0.05} value={el.scaleX} onBegin={p.onBeginHistory} onChange={(v) => updLive({ scaleX: v })} />
                  <Slider label="Échelle Y" min={0.1} max={4} step={0.05} value={el.scaleY} onBegin={p.onBeginHistory} onChange={(v) => updLive({ scaleY: v })} />
                </div>
              </Section>
            )}
          </div>
        </div>
      )}

      {/* ── BARRE DE CATÉGORIES ── */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-gray-100 flex items-stretch">
        <div className="flex-1 flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto no-scrollbar">
          {cats.map((c) => (
            <button key={c.id} onClick={() => toggle(c.id)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl shrink-0 min-w-[58px] ${panel === c.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 active:bg-gray-100'}`}>
              {c.icon}
              <span className="text-[9px] font-bold">{c.label}</span>
            </button>
          ))}
          {el && (
            <>
              <button onClick={p.onDuplicate} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl shrink-0 min-w-[58px] text-gray-500 active:bg-gray-100"><Copy size={20} /><span className="text-[9px] font-bold">Dupliquer</span></button>
              <button onClick={p.onOpenFull} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl shrink-0 min-w-[58px] text-gray-500 active:bg-gray-100"><MoreHorizontal size={20} /><span className="text-[9px] font-bold">Plus</span></button>
              <button onClick={p.onRemove} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl shrink-0 min-w-[58px] text-red-500 active:bg-red-50"><Trash2 size={20} /><span className="text-[9px] font-bold">Suppr.</span></button>
            </>
          )}
          {!el && (
            <>
              <button onClick={p.onOpenLayers} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl shrink-0 min-w-[58px] text-gray-500 active:bg-gray-100"><LayersIcon size={20} /><span className="text-[9px] font-bold">Calques</span></button>
              <button onClick={p.onExport} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl shrink-0 min-w-[58px] text-gray-500 active:bg-gray-100"><Download size={20} /><span className="text-[9px] font-bold">Export</span></button>
            </>
          )}
        </div>
        {/* Annuler / Rétablir collés à droite */}
        <div className="flex items-center border-l border-gray-100 px-1">
          <button onClick={p.onUndo} disabled={!p.canUndo} className="p-2.5 rounded-xl text-gray-500 disabled:opacity-25 active:bg-gray-100"><Undo2 size={20} /></button>
          <button onClick={p.onRedo} disabled={!p.canRedo} className="p-2.5 rounded-xl text-gray-500 disabled:opacity-25 active:bg-gray-100"><Redo2 size={20} /></button>
        </div>
      </div>
    </div>
  );
};

/* ── Sous-composants ── */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</h3>
    {children}
  </div>
);

const Swatches: React.FC<{ colors: string[]; current?: string; onPick: (c: string) => void }> = ({ colors, current, onPick }) => (
  <div className="grid grid-cols-8 gap-2">
    {[...new Set(colors)].map((c, i) => (
      <button key={`${c}-${i}`} onClick={() => onPick(c)} style={{ backgroundColor: c }}
        className={`aspect-square rounded-lg border ${current?.toLowerCase() === c.toLowerCase() ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}`} />
    ))}
  </div>
);

const Seg: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center py-2.5 rounded-xl ${active ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-600 active:bg-gray-100'}`}>{children}</button>
);

const StepBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} className="w-12 h-12 rounded-xl bg-gray-100 text-2xl font-bold text-gray-700 active:bg-gray-200">{label}</button>
);

const AddBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center gap-1 aspect-square rounded-xl bg-gray-50 text-gray-600 active:bg-blue-50">
    {icon}{label && <span className="text-[9px] font-bold">{label}</span>}
  </button>
);

const Slider: React.FC<{ label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; onBegin: () => void; pct?: boolean }> = ({ label, min, max, step, value, onChange, onBegin, pct }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-bold text-gray-400 uppercase">{label}</span>
      <span className="text-xs font-mono text-gray-500">{pct ? `${Math.round(value * 100)}%` : Math.round(value * 100) / 100}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onMouseDown={onBegin} onTouchStart={onBegin} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none accent-blue-500" />
  </div>
);

const ShapeMini: React.FC<{ type: ShapeType }> = ({ type }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
    {type === 'rect' && <rect x="3" y="5" width="14" height="10" />}
    {type === 'circle' && <circle cx="10" cy="10" r="7" />}
    {type === 'triangle' && <polygon points="10,3 17,17 3,17" />}
    {type === 'semicircle' && <path d="M3,13 A7,7 0 0 1 17,13 Z" />}
    {type === 'quarter' && <path d="M4,16 L16,16 A12,12 0 0 0 4,4 Z" />}
    {type === 'ring' && <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="3" />}
    {type === 'line' && <rect x="3" y="9" width="14" height="2" />}
    {type === 'hexagon' && <polygon points="3,10 6.5,3.5 13.5,3.5 17,10 13.5,16.5 6.5,16.5" />}
    {type === 'diamond' && <polygon points="10,2 18,10 10,18 2,10" />}
    {type === 'star' && <polygon points="10,2 12.2,7.6 18,7.9 13.5,11.6 15,17.2 10,14 5,17.2 6.5,11.6 2,7.9 7.8,7.6" />}
    {type === 'cross' && <polygon points="7.5,2 12.5,2 12.5,7.5 18,7.5 18,12.5 12.5,12.5 12.5,18 7.5,18 7.5,12.5 2,12.5 2,7.5 7.5,7.5" />}
    {type === 'arrow' && <polygon points="2,7 10,7 10,4 18,10 10,16 10,13 2,13" />}
  </svg>
);
