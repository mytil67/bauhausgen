import React from 'react';
import type { CompositionElement, ElementBounds } from '../types';
import { FALLBACK_BBOX, buildElementDefs, renderElementContent, computeElementVisuals } from './canvas/render';
import { CanvasContextMenu } from './canvas/CanvasContextMenu';
import { ResizeRotateHandles } from './canvas/SelectionHandles';
import { GuidesOverlay } from './canvas/GuidesOverlay';
import { ManualGuides } from './canvas/ManualGuides';
import { useCanvasGestures } from './canvas/useCanvasGestures';

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
  // Toute l'interaction (drag/resize/rotate, marquee, repères, édition inline, menu
  // contextuel, mesure des bbox, smart guides) vit dans ce hook. Canvas = rendu pur.
  const {
    svgRef, elementRefs, editInputRef,
    bboxes, groupAABB, singleSelected, selectionCount,
    dragMode, activeGuides, measurements, marquee,
    editingId, setEditingId,
    contextMenu, handleContextMenu, closeContextMenu,
    setGuideDrag,
    handleCanvasMouseDown, handleCanvasTouchStart,
    handleMouseDown, handleTouchStart, handleResizeMouseDown, handleRotateMouseDown,
    startEditing,
  } = useCanvasGestures({
    elements, selectedIds, width, height, gridSize, snapToGrid, guides,
    onSelect, onSelectMany, onUpdateLive, onUpdateElementsLive, onNudge,
    onRemoveSelection, onBeginHistory, onBoundsChange, onGuidesChange, measureRef,
  });

  // Constantes compensant le zoom pour la taille des éléments d'interface UI
  const hz = 10 / zoom;         // Taille des poignées
  const ho = 5 / zoom;          // Offset des poignées
  const strokeZ = 1.5 / zoom;   // Épaisseur de trait standard UI
  const strokeGuide = 1 / zoom; // Épaisseur des guides

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

          const { sx, sy, sw, sh, filterUrl, fill, textShadowCss } = computeElementVisuals(el, bbox);

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
                cursor: el.locked ? 'not-allowed' : dragMode === 'move' && isSelected ? 'grabbing' : 'grab',
                opacity: el.opacity,
                mixBlendMode: el.blendMode as React.CSSProperties['mixBlendMode'] ?? 'normal',
              }}
            >
              <g transform={innerTransform}>
                {renderElementContent({ el, fill, textShadowCss, bboxes, editingId, onUpdateLive, setEditingId, editInputRef })}
              </g>

              {/* Contour de sélection (toujours visible si sélectionné) */}
              {isSelected && (
                <rect x={sx - ho} y={sy - ho} width={sw + hz} height={sh + hz} fill="none" stroke={el.locked ? '#f59e0b' : '#3b82f6'} strokeWidth={strokeZ} strokeDasharray={el.locked ? `${2 / zoom} ${2 / zoom}` : showHandles ? '4' : '2'} className="pointer-events-none export-ignore" />
              )}

              {/* Indicateur cadenas (éléments verrouillés) */}
              {el.locked && isSelected && (
                <g transform={`translate(${sx + sw + 4 / zoom}, ${sy - 4 / zoom}) scale(${1 / zoom})`} className="pointer-events-none export-ignore">
                  <rect x="-10" y="-10" width="20" height="20" rx="4" fill="#f59e0b" opacity="0.9" />
                  <path d="M-4,-2 V-4 a4,4 0 0,1 8,0 V-2 M-5,-2 h10 a1,1 0 0,1 1,1 v6 a1,1 0 0,1-1,1 h-10 a1,1 0 0,1-1,-1 v-6 a1,1 0 0,1 1,-1z" fill="white" />
                </g>
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
        {guides && (
          <ManualGuides
            guides={guides}
            width={width}
            height={height}
            strokeGuide={strokeGuide}
            zoom={zoom}
            onStartDrag={(axis, index) => setGuideDrag({ axis, index })}
          />
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
