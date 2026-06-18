import React from 'react';

interface ManualGuidesProps {
  /** Positions des repères manuels en coords canvas. */
  guides: { x: number[]; y: number[] };
  width: number;
  height: number;
  /** Épaisseur de trait compensée du zoom (1 / zoom). */
  strokeGuide: number;
  zoom: number;
  /** Démarre le déplacement d'un repère (la logique de drag vit dans Canvas). */
  onStartDrag: (axis: 'x' | 'y', index: number) => void;
}

/**
 * Repères manuels (guides) déplaçables. Chaque repère = une ligne fine visible (teal) +
 * une ligne large transparente qui capte le pointeur pour le drag. La logique de
 * déplacement / suppression hors canvas reste dans Canvas (effet `guideDrag`).
 */
export const ManualGuides: React.FC<ManualGuidesProps> = ({
  guides, width, height, strokeGuide, zoom, onStartDrag,
}) => {
  if (guides.x.length === 0 && guides.y.length === 0) return null;
  return (
    <g className="export-ignore">
      {guides.x.map((gx, i) => (
        <React.Fragment key={`guide-x-${i}`}>
          <line x1={gx} y1={0} x2={gx} y2={height} stroke="#14b8a6" strokeWidth={strokeGuide} className="pointer-events-none" />
          <line x1={gx} y1={0} x2={gx} y2={height} stroke="#14b8a6" strokeOpacity={0} strokeWidth={14 / zoom}
            style={{ cursor: 'ew-resize', pointerEvents: 'stroke' }}
            onMouseDown={(e) => { e.stopPropagation(); onStartDrag('x', i); }}
            onTouchStart={(e) => { e.stopPropagation(); onStartDrag('x', i); }} />
        </React.Fragment>
      ))}
      {guides.y.map((gy, i) => (
        <React.Fragment key={`guide-y-${i}`}>
          <line x1={0} y1={gy} x2={width} y2={gy} stroke="#14b8a6" strokeWidth={strokeGuide} className="pointer-events-none" />
          <line x1={0} y1={gy} x2={width} y2={gy} stroke="#14b8a6" strokeOpacity={0} strokeWidth={14 / zoom}
            style={{ cursor: 'ns-resize', pointerEvents: 'stroke' }}
            onMouseDown={(e) => { e.stopPropagation(); onStartDrag('y', i); }}
            onTouchStart={(e) => { e.stopPropagation(); onStartDrag('y', i); }} />
        </React.Fragment>
      ))}
    </g>
  );
};
