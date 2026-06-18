import React from 'react';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizeRotateHandlesProps {
  /** Boîte (coords canvas) autour de laquelle disposer les poignées. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Constantes compensant le zoom (calculées dans Canvas). */
  hz: number;       // taille des poignées
  ho: number;       // demi-taille (offset de centrage)
  strokeZ: number;  // épaisseur de trait UI
  zoom: number;
  /** id de l'élément cible (sélection unique) ou undefined (groupe). */
  targetId?: string;
  onResize: (e: React.MouseEvent, handle: ResizeHandle, targetId?: string) => void;
  onRotate: (e: React.MouseEvent, targetId?: string) => void;
}

/**
 * Poignées de redimensionnement (8) + poignée de rotation, partagées entre la sélection
 * unique et le groupe (seule diffère la cible `targetId`). N'inclut PAS le contour de
 * sélection : chaque appelant garde le sien (bleu pour l'unique, rose pour le groupe).
 */
export const ResizeRotateHandles: React.FC<ResizeRotateHandlesProps> = ({
  x, y, w, h, hz, ho, strokeZ, zoom, targetId, onResize, onRotate,
}) => (
  <>
    {/* Poignée de rotation */}
    <line x1={x + w / 2} y1={y - ho} x2={x + w / 2} y2={y - 28 / zoom} stroke="#3b82f6" strokeWidth={strokeZ} className="pointer-events-none" />
    <circle cx={x + w / 2} cy={y - 32 / zoom} r={6 / zoom} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} style={{ cursor: 'grab' }} onMouseDown={(e) => onRotate(e, targetId)} />

    {/* Coins */}
    <rect x={x - hz} y={y - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nwse-resize" onMouseDown={(e) => onResize(e, 'nw', targetId)} />
    <rect x={x + w} y={y - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nesw-resize" onMouseDown={(e) => onResize(e, 'ne', targetId)} />
    <rect x={x - hz} y={y + h} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nesw-resize" onMouseDown={(e) => onResize(e, 'sw', targetId)} />
    <rect x={x + w} y={y + h} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-nwse-resize" onMouseDown={(e) => onResize(e, 'se', targetId)} />

    {/* Milieux */}
    <rect x={x + w / 2 - ho} y={y - hz} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ns-resize" onMouseDown={(e) => onResize(e, 'n', targetId)} />
    <rect x={x + w / 2 - ho} y={y + h} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ns-resize" onMouseDown={(e) => onResize(e, 's', targetId)} />
    <rect x={x - hz} y={y + h / 2 - ho} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ew-resize" onMouseDown={(e) => onResize(e, 'w', targetId)} />
    <rect x={x + w} y={y + h / 2 - ho} width={hz} height={hz} fill="white" stroke="#3b82f6" strokeWidth={strokeZ} className="cursor-ew-resize" onMouseDown={(e) => onResize(e, 'e', targetId)} />
  </>
);
